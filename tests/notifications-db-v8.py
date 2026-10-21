#!/usr/bin/env python3
"""Prueba avisos V8 con PostgreSQL efímero, sin conexión a Supabase real.

Comprueba que la notificación está ligada a una transacción confirmada:
un cambio de agenda rechazado por V7 no envía ningún aviso al operario.
"""
import os
from pathlib import Path
import psycopg

DSN=os.environ.get("REPARADO_TEST_DATABASE_URL","")
if not DSN:
    raise SystemExit("No hay base de pruebas local.")
host=psycopg.conninfo.conninfo_to_dict(DSN).get("host")
if host not in ("localhost","127.0.0.1"):
    raise SystemExit("Está prohibido ejecutar esta prueba fuera de PostgreSQL local efímero.")
ROOT=Path(__file__).resolve().parents[1]
V7=(ROOT/"supabase/migration-v7.sql").read_text(encoding="utf8")
V8=(ROOT/"supabase/migration-v8.sql").read_text(encoding="utf8")
A="00000000-0000-4000-8000-000000000001"
B="00000000-0000-4000-8000-000000000002"
C="00000000-0000-4000-8000-000000000003"
J="10000000-0000-4000-8000-000000000001"
J2="10000000-0000-4000-8000-000000000002"

with psycopg.connect(DSN) as db:
    db.execute("""DO $$
      BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
      END $$""")
    db.execute("drop table if exists public.notifications cascade")
    db.execute("drop table if exists public.service_requests cascade")
    db.execute("drop table if exists public.profiles cascade")
    db.execute("create table public.profiles(id uuid primary key,role text not null)")
    db.execute("""create table public.service_requests(
      id uuid primary key,operator_id uuid references public.profiles(id),
      service_name text not null,status text not null default 'new',
      scheduled_at timestamptz,price numeric(10,2))""")
    db.execute("""create table public.notifications(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles(id),
      title text not null,body text not null,read boolean not null default false,
      created_at timestamptz not null default now())""")
    for uid,role in [(A,"operator"),(B,"operator"),(C,"admin")]:
        db.execute("insert into public.profiles(id,role) values(%s,%s)",(uid,role))
    db.execute(V7)
    db.execute(V8)
    db.execute(V8)  # Idempotencia: repetir no puede instalar un trigger duplicado.
    ntriggers=db.execute("""select count(*) from pg_trigger
      where tgname='reparado_notify_operator_assignment_v8' and not tgisinternal""").fetchone()[0]
    assert ntriggers==1,("Trigger duplicado",ntriggers)
    db.execute("insert into public.service_requests(id,service_name,status) values(%s,'Colocación de estantería','accepted')",(J,))

    def alerts():
        return db.execute("""select user_id::text,title,body from public.notifications
           order by created_at,id""").fetchall()
    def assert_increment(before, expected_add, recipient, title):
        new=alerts()
        assert len(new)-len(before)==expected_add,(before,new)
        if expected_add:
            added=[item for item in new if item not in before]
            assert any(r==recipient and t==title for r,t,_ in added),(title,added)
        return new

    before=alerts()
    db.execute("update public.service_requests set operator_id=%s where id=%s",(A,J))
    before=assert_increment(before,1,A,'Nuevo trabajo asignado')
    db.execute("update public.service_requests set price=100 where id=%s",(J,))
    assert alerts()==before,"No debe enviar aviso por cambio de precio."

    db.execute("update public.service_requests set status='scheduled',scheduled_at='2026-10-26 11:00Z' where id=%s",(J,))
    before=assert_increment(before,1,A,'Visita programada')
    assert any('26/10/2026 a las 12:00' in body for _,title,body in before if title=='Visita programada'),before

    db.execute("update public.service_requests set status='scheduled',scheduled_at='2026-10-26 11:00Z' where id=%s",(J,))
    assert alerts()==before,"Un UPDATE sin cambio no debe duplicar avisos."

    db.execute("update public.service_requests set scheduled_at='2026-10-26 11:30Z' where id=%s",(J,))
    before=assert_increment(before,1,A,'Visita reprogramada')
    db.execute("update public.service_requests set status='in_progress' where id=%s",(J,))
    before=assert_increment(before,1,A,'Trabajo en curso')
    db.execute("update public.service_requests set operator_id=%s where id=%s",(B,J))
    new=alerts()
    assert len(new)-len(before)==2,(before,new)
    assert any(r==A and title=='Asignación retirada' for r,title,_ in new),new
    assert any(r==B and title=='Nuevo trabajo asignado' for r,title,_ in new),new
    before=new
    db.execute("update public.service_requests set status='cancelled' where id=%s",(J,))
    before=assert_increment(before,1,B,'Visita cancelada')
    db.execute("update public.service_requests set status='cancelled' where id=%s",(J,))
    assert alerts()==before,"La cancelación repetida no debe generar avisos."

    db.execute("insert into public.service_requests(id,service_name,status) values(%s,'Reparación de fuga','accepted')",(J2,))
    before=alerts()
    try:
        with db.transaction():
            db.execute("""update public.service_requests
              set status='scheduled',operator_id=%s,scheduled_at='2026-10-26 11:00Z'
              where id=%s""",(B,J2))
    except psycopg.Error as exc:
        # El anterior trabajo de B está cancelado, por lo que el primer
        # guardado sí sería válido. No debe entrar aquí.
        raise AssertionError("Una visita nueva tras cancelación debería permitirse") from exc
    before=assert_increment(before,1,B,'Nuevo trabajo asignado')

    # Conflicto V7: una segunda visita a 11:20 del mismo operario B, y
    # ninguna notificación V8 se debe almacenar con el UPDATE rechazado.
    try:
        with db.transaction():
            db.execute("""update public.service_requests set
                operator_id=%s,status='scheduled',
                scheduled_at='2026-10-26 11:20Z' where id=%s""",(B,J))
    except psycopg.Error as exc:
        assert exc.sqlstate=='23P01',str(exc)
    else:
        raise AssertionError("La V7 permitió una cita a 20 minutos del mismo operario.")
    assert alerts()==before,"Una transacción rechazada no debe crear notificaciones."

    # Un perfil administrador nunca debe recibir avisos de operario.
    db.execute("update public.service_requests set status='accepted',operator_id=%s where id=%s",(C,J))
    assert alerts()==before,"No se debe notificar a perfiles admin como si fueran operarios."
    print("V8 OK: asignación, programación, reprogramación, cambio, inicio, cancelación, idempotencia, ROL y rollback con V7.",flush=True)
