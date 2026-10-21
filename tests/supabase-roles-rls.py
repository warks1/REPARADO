#!/usr/bin/env python3
"""Pruebas de permisos REPARADO sobre un PostgreSQL 16 TEMPORAL.

Ejecuta el esquema original más V4–V11; simula auth.uid() / auth.role()
de Supabase y las identidades customer, operator y admin. No se conecta
nunca a la cuenta ni a la base real del usuario.
"""
import os
from uuid import UUID
from pathlib import Path
from contextlib import contextmanager
import psycopg

DSN=os.environ.get("REPARADO_TEST_DATABASE_URL","")
if not DSN:
    raise SystemExit("Falta REPARADO_TEST_DATABASE_URL. Solo PostgreSQL local.")
host=psycopg.conninfo.conninfo_to_dict(DSN).get("host")
if host not in ("localhost","127.0.0.1"):
    raise SystemExit("Prueba bloqueada: no se admite ninguna base remota.")

ROOT=Path(__file__).resolve().parents[1]
C1="00000000-0000-4000-8000-000000000001"
C2="00000000-0000-4000-8000-000000000002"
OP="00000000-0000-4000-8000-000000000003"
ADM="00000000-0000-4000-8000-000000000004"
R1="10000000-0000-4000-8000-000000000001"
R2="10000000-0000-4000-8000-000000000002"

def connect():
    return psycopg.connect(DSN)

@contextmanager
def as_user(uid, role="authenticated"):
    with connect() as db:
        db.execute("set role "+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or "",))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

def rejected(db,statement,args=(),error_code=None):
    try:
        with db.transaction():
            if args:db.execute(statement,args)
            else:db.execute(statement)
    except psycopg.Error as e:
        if error_code and e.sqlstate!=error_code:
            raise AssertionError(f"Se esperaba {error_code}, llegó {e.sqlstate}: {e}") from e
        return e.sqlstate
    raise AssertionError("Operación no autorizada aceptada: "+statement[:105])

def ids(db,table,where=""):
    return {str(x[0]) for x in db.execute("select id from "+table+" "+where).fetchall()}

with connect() as db:
    db.execute("""do $setup$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
    end $setup$""")
    db.execute("create schema if not exists auth")
    db.execute("""create table if not exists auth.users (
       id uuid primary key,raw_user_meta_data jsonb not null default '{}'::jsonb)""")
    db.execute("""create or replace function auth.uid() returns uuid
       language sql stable as $f$
       select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
       $f$""")
    db.execute("""create or replace function auth.role() returns text
       language sql stable as $f$
       select nullif(current_setting('request.jwt.claim.role',true),'')
       $f$""")
    db.execute("grant usage on schema auth to anon,authenticated")
    db.execute("grant execute on function auth.uid() to anon,authenticated")
    db.execute("grant execute on function auth.role() to anon,authenticated")
    db.execute((ROOT/"schema.sql").read_text(encoding="utf8"))
    for version in range(4,12):
        db.execute((ROOT/f"supabase/migration-v{version}.sql").read_text(encoding="utf8"))
    db.execute("grant usage on schema public to anon,authenticated")
    # En Supabase estos permisos básicos son los valores por defecto del
    # esquema public; en PostgreSQL limpio se simulan explícitamente.
    db.execute("""grant select on public.profiles,public.service_requests,
      public.messages,public.notifications,public.device_tokens,
      public.invoices to authenticated""")
    # La app necesita leer datos de perfiles y solicitudes; las políticas
    # RLS definen las filas que ve cada rol, no el privilegio base.
    users=[(C1,"customer"),(C2,"customer"),(OP,"operator"),(ADM,"admin")]
    for uid,_ in users:
        db.execute("insert into auth.users(id) values(%s)",(uid,))
    for uid,role in users:
        db.execute("update public.profiles set role=%s where id=%s",(role,uid))
    db.execute("""insert into public.service_requests(
      id,customer_id,service_name,category,price,street,address_number,
      postal_code,city,phone,status)
      values(%s,%s,'Cambio de grifo','Fontanería',121,
             'Calle de prueba','12','08001','Barcelona','000000000','quoted')""",(R1,C1))
    db.execute("""insert into public.service_requests(
      id,customer_id,service_name,category,price,street,address_number,
      postal_code,city,phone,status)
      values(%s,%s,'Cambio de sifón','Fontanería',60,
             'Calle de prueba','14','08002','Barcelona','000000000','quoted')""",(R2,C2))
    db.execute("""insert into public.invoices(
      request_id,customer_id,number,subtotal,vat,total,status)
      values (%s,%s,'TEST-2026-001',100,21,121,'issued'),
             (%s,%s,'TEST-2026-002',49.59,10.41,60,'issued'),
             (%s,%s,'BORRADOR',0,0,0,'draft')""",(R1,C1,R2,C2,R1,C1))
    # Cada identidad recibe un aviso privado, sin datos personales.
    db.execute("""insert into public.notifications(user_id,title,body)
      values(%s,'Aviso 1','Privado'),(%s,'Aviso 2','Privado'),
            (%s,'Aviso operario','Privado'),(%s,'Aviso admin','Privado')""",(C1,C2,OP,ADM))
    assert all(db.execute("select relrowsecurity from pg_class where oid=%s::regclass",(f"public.{table}",)).fetchone()[0]
               for table in ("profiles","service_requests","messages","notifications","device_tokens","invoices"))
    assert db.execute("""select count(*) from pg_trigger where tgname in
      ('reparado_guard_operator_schedule_v7',
       'reparado_notify_operator_assignment_v8',
       'reparado_guard_invoice_v9') and not tgisinternal""").fetchone()[0]==3
    functions=db.execute("""select p.proname,
      has_function_privilege('anon',p.oid,'EXECUTE'),
      has_function_privilege('authenticated',p.oid,'EXECUTE')
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef
      order by p.proname""").fetchall()
    assert len(functions)>=11,functions
    assert all(not anonymous for _,anonymous,_ in functions),functions
    safe_rpc={'accept_reparado_quote','is_reparado_admin','is_reparado_staff'}
    assert all(authenticated==(name in safe_rpc)
               for name,_,authenticated in functions),functions
    print("V10: 0 funciones SECURITY DEFINER anónimas; 3 RPC autenticadas; 8 triggers internos",flush=True)

    # Informe de puesta en marcha sin datos personales. Debe ser seguro
    # repetirlo porque solo utiliza consultas SELECT sobre la base.
    audit=(ROOT/"supabase/auditoria-readonly-v9.sql").read_text(encoding="utf8")
    audit_result=db.execute(audit).fetchall()
    assert len(audit_result)==20,audit_result
    pending=[row for row in audit_result if row[1]!='OK']
    assert not pending,("Auditoría pendiente",pending)
    assert db.execute(audit).fetchall()==audit_result
    print(f"Auditoría Supabase: {len(audit_result)} comprobaciones correctas y ninguna escritura",flush=True)

with as_user(C1) as db:
    assert ids(db,"public.service_requests")=={R1}
    assert len(ids(db,"public.invoices"))==1 # El borrador no se muestra.
    assert len(ids(db,"public.notifications"))==1
    assert ids(db,"public.profiles")=={C1}
    assert not db.execute("select has_table_privilege(current_user,'public.invoices','INSERT')").fetchone()[0]
    assert not db.execute("select has_table_privilege(current_user,'public.invoices','UPDATE')").fetchone()[0]
    rejected(db,"update public.profiles set role='admin' where id=%s",(C1,),"42501")
    assert db.execute("update public.service_requests set price=1 where id=%s returning id",(R1,)).fetchall()==[]
    assert db.execute("select public.accept_reparado_quote(%s)",(R2,)).fetchone()[0] is False
    assert db.execute("select public.accept_reparado_quote(%s)",(R1,)).fetchone()[0] is True
    assert db.execute("select public.accept_reparado_quote(%s)",(R1,)).fetchone()[0] is False
    own_alerts=db.execute("select count(*) from public.notifications").fetchone()[0]
    assert db.execute("update public.notifications set read=true returning id").rowcount==own_alerts
    rejected(db,"update public.notifications set title='Aviso falsificado'",error_code="42501")
    print("Cliente 1: datos propios, borradores, roles, precios, presupuestos y avisos protegidos",flush=True)

with as_user(C2) as db:
    assert ids(db,"public.service_requests")=={R2}
    assert len(ids(db,"public.invoices"))==1
    assert len(ids(db,"public.notifications"))==1
    assert ids(db,"public.profiles")=={C2}
    assert db.execute("select public.accept_reparado_quote(%s)",(R1,)).fetchone()[0] is False

with as_user(OP) as db:
    assert ids(db,"public.service_requests")==set()
    assert ids(db,"public.invoices")==set()
    assert len(ids(db,"public.notifications"))==1
    assert ids(db,"public.profiles")=={OP}

with as_user(ADM) as db:
    assert ids(db,"public.service_requests")=={R1,R2}
    assert len(ids(db,"public.invoices"))==3  # El admin ve borradores.
    assert len(ids(db,"public.profiles"))==4
    # El admin recibe avisos V5 por solicitudes nuevas y presupuestos
    # aceptados, además de su aviso inicial; siempre son avisos propios.
    own=ids(db,"public.notifications")
    assert len(own)>=2
    assert db.execute("select count(*) from public.notifications where user_id<>%s",(ADM,)).fetchone()[0]==0
    assert db.execute("""update public.service_requests
      set operator_id=%s,operator_name='Técnico de pruebas',
          status='scheduled',scheduled_at='2026-10-26 10:00Z'
      where id=%s returning id""",(OP,R1)).fetchone()[0]==UUID(R1)

with as_user(OP) as db:
    assert ids(db,"public.service_requests")=={R1}
    assert ids(db,"public.invoices")==set()
    assert db.execute("update public.service_requests set status='in_progress' where id=%s returning id",(R1,)).rowcount==1
    rejected(db,"update public.service_requests set price=1 where id=%s",(R1,),"P0001")
    assert db.execute("update public.service_requests set status='completed' where id=%s returning id",(R1,)).rowcount==1

with as_user(None,role="anon") as db:
    for tab in ('profiles','service_requests','messages','notifications','device_tokens','invoices'):
        rejected(db,f"select id from public.{tab}",error_code="42501")
        assert not db.execute("select has_table_privilege('anon',%s,'INSERT')",(f"public.{tab}",)).fetchone()[0]
        assert not db.execute("select has_table_privilege('anon',%s,'UPDATE')",(f"public.{tab}",)).fetchone()[0]
        assert not db.execute("select has_table_privilege('anon',%s,'DELETE')",(f"public.{tab}",)).fetchone()[0]
    rejected(db,"select public.is_reparado_admin()",error_code="42501")
    rejected(db,"select public.accept_reparado_quote(%s)",(R1,),error_code="42501")
    print("REPARADO Test privado: anon sin permisos sobre seis tablas ni RPC",flush=True)

print("Integración RLS V4–V11: cliente, segundo cliente, operario, admin, anon, notas e invoices OK",flush=True)
