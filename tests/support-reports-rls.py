#!/usr/bin/env python3
"""Control real de RLS de informes de clientes, SOLO en PostgreSQL local."""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg
dsn=os.getenv('REPARADO_TEST_DATABASE_URL','')
if not dsn or psycopg.conninfo.conninfo_to_dict(dsn).get('host') not in ('127.0.0.1','localhost'):
    raise SystemExit('REPARADO: pruebas de soporte permitidas solo en PostgreSQL local.')
C1='00000000-0000-4000-8000-000000000001'
C2='00000000-0000-4000-8000-000000000002'
OP='00000000-0000-4000-8000-000000000003'
ADM='00000000-0000-4000-8000-000000000004'
root=Path(__file__).resolve().parents[1]

@contextmanager
def user(uid,role='authenticated'):
    with psycopg.connect(dsn) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or '',))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

with psycopg.connect(dsn) as db:
    db.execute((root/'supabase/migration-support-reports.sql').read_text(encoding='utf8'))
    for table in ['support_reports','support_email_outbox']:
        assert db.execute("select relrowsecurity from pg_class where oid=%s::regclass",('public.'+table,)).fetchone()[0]
        assert not db.execute("select has_table_privilege('authenticated',%s,'DELETE')",('public.'+table,)).fetchone()[0]
        assert not db.execute("select has_table_privilege('authenticated',%s,'TRUNCATE')",('public.'+table,)).fetchone()[0]
    assert not db.execute("select has_table_privilege('anon','public.support_reports','SELECT')").fetchone()[0]
    assert not db.execute("select has_table_privilege('authenticated','public.support_email_outbox','SELECT')").fetchone()[0]
    assert not db.execute("select has_function_privilege('authenticated','public.reparado_claim_support_email()','EXECUTE')").fetchone()[0]

with user(C1) as db:
    rid=db.execute("""insert into public.support_reports (user_id,subject,description,context)
       values (%s,'Error con foto','Al abrir una imagen de prueba falla la vista','solicitud')
       returning id""",(C1,)).fetchone()[0]
    assert db.execute("select id from public.support_reports").fetchone()[0]==rid
    assert db.execute("update public.support_reports set status='resolved' where id=%s returning id",(rid,)).fetchall()==[]

with user(C2) as db:
    assert db.execute("select id from public.support_reports").fetchall()==[]
    assert db.execute("update public.support_reports set status='resolved' where id=%s returning id",(rid,)).fetchall()==[]

with user(OP) as db:
    assert db.execute("select id from public.support_reports").fetchall()==[]

with user(ADM) as db:
    assert db.execute("select id from public.support_reports").fetchone()[0]==rid
    assert db.execute("update public.support_reports set status='reviewing' where id=%s returning status",(rid,)).fetchone()==('reviewing',)

with psycopg.connect(dsn) as db:
    assert db.execute("select count(*) from public.support_email_outbox where report_id=%s",(rid,)).fetchone()[0]==1
    db.execute('set role service_role')
    item=db.execute('select outbox_id,report_id,try_number from public.reparado_claim_support_email()').fetchone()
    assert item is not None and item[1]==rid and item[2]==1
    assert db.execute('select report_id from public.reparado_claim_support_email()').fetchall()==[]

print('Soporte REPARADO: RLS cliente/operario/admin, cola privada y reclamación única correctos.',flush=True)
