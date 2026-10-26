#!/usr/bin/env python3
"""Pruebas de correos/cola en PostgreSQL local, nunca en Supabase alojado."""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg
dsn=os.environ.get('REPARADO_TEST_DATABASE_URL','')
if not dsn or psycopg.conninfo.conninfo_to_dict(dsn).get('host') not in ('127.0.0.1','localhost'):
    raise SystemExit('Estas pruebas solo admiten PostgreSQL LOCAL.')
root=Path(__file__).resolve().parents[1]
C1='00000000-0000-4000-8000-000000000001'
C2='00000000-0000-4000-8000-000000000002'

@contextmanager
def as_user(uid,role='authenticated'):
    with psycopg.connect(dsn) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid,))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

with psycopg.connect(dsn) as db:
    db.execute((root/'supabase/migration-request-email-outbox.sql').read_text(encoding='utf8'))
    assert db.execute("select relrowsecurity from pg_class where oid='public.request_email_outbox'::regclass").fetchone()[0]
    for role in ('anon','authenticated'):
        assert not db.execute("select has_table_privilege(%s,'public.request_email_outbox','SELECT')",(role,)).fetchone()[0]
        assert not db.execute("select has_table_privilege(%s,'public.request_email_outbox','UPDATE')",(role,)).fetchone()[0]
        assert not db.execute("select has_function_privilege(%s,'public.reparado_claim_request_email()','EXECUTE')",(role,)).fetchone()[0]
    assert db.execute("select count(*) from public.request_email_outbox").fetchone()[0]==0
with as_user(C1) as db:
    job=db.execute("""insert into public.service_requests
    (customer_id,service_name,category,street,address_number,postal_code,city,phone,description)
    values (%s,'Revisión de fuga','Fontanería','Calle Prueba','16','08001','Barcelona',
       '000000000','Prueba aislada de avisos') returning id""",(C1,)).fetchone()[0]
with psycopg.connect(dsn) as db:
    assert db.execute("select count(*) from public.request_email_outbox where request_id=%s",(job,)).fetchone()[0]==1
    db.execute("set role service_role")
    result=db.execute("select outbox_id,job_id,try_number from public.reparado_claim_request_email()").fetchone()
    assert result is not None and result[1]==job and result[2]==1,result
    assert db.execute("select outbox_id from public.reparado_claim_request_email()").fetchall()==[]
with as_user(C2) as db:
    try:
        db.execute("select id from public.request_email_outbox")
        raise AssertionError('Otro cliente puede ver la cola de correos')
    except psycopg.errors.InsufficientPrivilege:
        pass
print('Correos REPARADO OK: un aviso por nueva solicitud, reclamación atómica y ningún acceso de cliente.',flush=True)
