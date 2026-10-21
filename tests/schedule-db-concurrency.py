#!/usr/bin/env python3
"""Integración PostgreSQL V7 en un contenedor EFÍMERO de GitHub Actions.

NO ejecutar contra Supabase de producción: el script crea y borra tablas
de prueba. Solo admite conexiones locales a 127.0.0.1/localhost.
Comprueba serialización real de dos conexiones concurrentes.
"""
import os
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import psycopg

DSN=os.environ.get("REPARADO_TEST_DATABASE_URL","")
if not DSN:
    raise SystemExit("Falta REPARADO_TEST_DATABASE_URL para PostgreSQL local.")
parsed=psycopg.conninfo.conninfo_to_dict(DSN)
if parsed.get("host") not in ("localhost","127.0.0.1"):
    raise SystemExit("Solo se permite ejecutar este test en PostgreSQL local efímero.")

MIGRATION=Path(__file__).resolve().parents[1].joinpath("supabase/migration-v7.sql").read_text(encoding="utf8")
OP="00000000-0000-4000-8000-000000000001"
OP2="00000000-0000-4000-8000-000000000002"
ADMIN="00000000-0000-4000-8000-000000000003"

def connect():
    return psycopg.connect(DSN)

def check_raises_code(connection, query, values, expected):
    try:
        with connection.transaction():
            if values:
                connection.execute(query,values)
            else:
                connection.execute(query)
    except psycopg.Error as error:
        assert error.sqlstate==expected,(error.sqlstate,expected,str(error))
    else:
        raise AssertionError("Debió rechazarse: "+query[:100])

with connect() as db:
    db.execute("""DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    END $$;""")
    db.execute("drop table if exists public.service_requests cascade")
    db.execute("drop table if exists public.profiles cascade")
    db.execute("create table public.profiles(id uuid primary key, role text not null)")
    db.execute("""create table public.service_requests(
      id uuid primary key default gen_random_uuid(),
      operator_id uuid references public.profiles(id),
      scheduled_at timestamptz,
      status text not null default 'new'
    )""")
    for uid,role in [(OP,"operator"),(OP2,"operator"),(ADMIN,"admin")]:
        db.execute("insert into public.profiles values (%s,%s)",(uid,role))

    # Preflight: no dejar habilitar garantías nuevas sin corregir datos históricos.
    db.execute("""insert into public.service_requests(id,operator_id,scheduled_at,status)
      values('10000000-0000-4000-8000-000000000001',%s,'2026-10-25 08:00Z','scheduled'),
            ('10000000-0000-4000-8000-000000000002',%s,'2026-10-25 08:45Z','scheduled')""",
            (OP,OP))
    check_raises_code(db,MIGRATION,(), "23P01")
    db.execute("delete from public.service_requests")

    # V7 debe ser repetible. CREATE OR REPLACE y DROP/CREATE TRIGGER.
    with db.transaction():
        db.execute(MIGRATION)
        db.execute(MIGRATION)
    count=db.execute("""select count(*) from pg_trigger
      where tgname='reparado_guard_operator_schedule_v7' and not tgisinternal""").fetchone()[0]
    assert count==1,f"Trigger duplicado: {count}"

    def insert(ident,op,at,status):
        db.execute("""insert into public.service_requests(id,operator_id,scheduled_at,status)
          values(%s,%s,%s,%s)""",(ident,op,at,status))

    insert("10000000-0000-4000-8000-000000000001",OP,"2026-10-25 08:00Z","scheduled")
    # 59 minutos no vale.
    check_raises_code(db,"""insert into public.service_requests(id,operator_id,scheduled_at,status)
      values('10000000-0000-4000-8000-000000000002',%s,'2026-10-25 08:59Z','scheduled')""",(OP,), "23P01")
    # Exactamente 60 minutos vale y otro operario puede empezar a la misma hora.
    insert("10000000-0000-4000-8000-000000000002",OP,"2026-10-25 09:00Z","scheduled")
    insert("10000000-0000-4000-8000-000000000003",OP2,"2026-10-25 08:15Z","scheduled")
    # Estado cancelado/completado queda fuera de la protección.
    insert("10000000-0000-4000-8000-000000000004",OP,"2026-10-25 08:10Z","cancelled")
    insert("10000000-0000-4000-8000-000000000005",OP,"2026-10-25 08:20Z","completed")
    check_raises_code(db,"""insert into public.service_requests(operator_id,scheduled_at,status)
      values(null,'2026-10-25 11:00Z','scheduled')""",(),"23514")
    check_raises_code(db,"""insert into public.service_requests(operator_id,scheduled_at,status)
      values(%s,null,'in_progress')""",(OP,),"23514")
    check_raises_code(db,"""insert into public.service_requests(operator_id,scheduled_at,status)
      values(%s,'2026-10-25 11:00Z','scheduled')""",(ADMIN,),"23514")

    insert("10000000-0000-4000-8000-000000000006",OP,None,"accepted")
    check_raises_code(db,"""update public.service_requests
      set scheduled_at='2026-10-25 08:30Z',status='scheduled'
      where id='10000000-0000-4000-8000-000000000006'""",(),"23P01")
    db.execute("""update public.service_requests
      set scheduled_at='2026-10-25 10:00Z',status='scheduled'
      where id='10000000-0000-4000-8000-000000000006'""")
    # Cambio de estado del mismo trabajo no se considera autocoincidencia.
    db.execute("""update public.service_requests set status='in_progress'
      where id='10000000-0000-4000-8000-000000000006'""")
    print("V7 PostgreSQL: permisos, preflight, frontera 60m, otros operarios, ROL y UPDATE correctos",flush=True)

# Dos administradores guardan a la vez visitas distintas del mismo operario.
# T1 mantiene el bloqueo de la base. T2 debe esperar y quedar rechazada.
with connect() as db:
    db.execute("""insert into public.service_requests(id,status) values
      ('20000000-0000-4000-8000-000000000001','accepted'),
      ('20000000-0000-4000-8000-000000000002','accepted')""")

first_saved=threading.Event()
second_attempt=threading.Event()
outcomes={}

def first_writer():
    with connect() as cn:
        cn.execute("""update public.service_requests
          set operator_id=%s,scheduled_at='2026-10-26 13:00Z',status='scheduled'
          where id='20000000-0000-4000-8000-000000000001'""",(OP,))
        first_saved.set()
        assert second_attempt.wait(timeout=8),"La segunda conexión no arrancó."
        time.sleep(1.3)
        cn.commit()
        outcomes["first"]="committed"

def second_writer():
    assert first_saved.wait(timeout=8),"La primera conexión no adquirió el bloqueo."
    started=time.monotonic()
    second_attempt.set()
    try:
        with connect() as cn:
            cn.execute("""update public.service_requests
              set operator_id=%s,scheduled_at='2026-10-26 13:20Z',status='scheduled'
              where id='20000000-0000-4000-8000-000000000002'""",(OP,))
            cn.commit()
        outcomes["second"]="UNEXPECTED_COMMIT"
    except psycopg.Error as error:
        outcomes["second"]=error.sqlstate
        outcomes["blocked_for"]=time.monotonic()-started

with ThreadPoolExecutor(max_workers=2) as executor:
    f1=executor.submit(first_writer)
    f2=executor.submit(second_writer)
    f1.result(timeout=20)
    f2.result(timeout=20)

assert outcomes.get("first")=="committed",outcomes
assert outcomes.get("second")=="23P01",outcomes
assert outcomes.get("blocked_for",0)>=.8,outcomes
with connect() as db:
    live=db.execute("""select count(*) from public.service_requests
      where id in ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002')
        and status='scheduled'""").fetchone()[0]
    assert live==1,f"Dos reservas simultáneas aceptadas: {live}"
print(f"V7 concurrencia real: primera confirmada; segunda rechazada ({outcomes['second']}); espera {outcomes['blocked_for']:.2f} s",flush=True)
