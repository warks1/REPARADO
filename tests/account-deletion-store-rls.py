#!/usr/bin/env python3
"""RLS de solicitudes de borrado en PostgreSQL local y descartable."""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg
dsn=os.environ.get('REPARADO_TEST_DATABASE_URL','')
if not dsn or psycopg.conninfo.conninfo_to_dict(dsn).get('host') not in ('localhost','127.0.0.1'):
    raise SystemExit('Pruebas SQL solo en localhost, nunca producción.')
root=Path(__file__).resolve().parents[1]
C1='00000000-0000-4000-8000-000000000001'
C2='00000000-0000-4000-8000-000000000002'

@contextmanager
def as_user(uid=None,role='authenticated'):
    with psycopg.connect(dsn) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or '',))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

with psycopg.connect(dsn) as db:
    db.execute((root/'supabase/migration-store-account-deletion.sql').read_text(encoding='utf8'))
    assert db.execute("select relrowsecurity from pg_class where oid='public.account_deletion_requests'::regclass").fetchone()[0]
    assert not db.execute("select has_table_privilege('anon','public.account_deletion_requests','SELECT')").fetchone()[0]
    assert not db.execute("select has_table_privilege('authenticated','public.account_deletion_requests','UPDATE')").fetchone()[0]
    assert not db.execute("select has_table_privilege('authenticated','public.account_deletion_requests','DELETE')").fetchone()[0]
    assert not db.execute("select has_table_privilege('authenticated','public.account_deletion_requests','TRUNCATE')").fetchone()[0]
with as_user(C1) as db:
    rid=db.execute("insert into public.account_deletion_requests(user_id) values (%s) returning id",(C1,)).fetchone()[0]
    assert db.execute("select id,status from public.account_deletion_requests").fetchone()==(rid,'requested')
with as_user(C2) as db:
    assert db.execute("select id from public.account_deletion_requests").fetchall()==[]
    assert db.execute("select id from public.account_deletion_requests where id=%s",(rid,)).fetchall()==[]
with as_user(C1) as db:
    assert db.execute("select id from public.account_deletion_requests").fetchone()[0]==rid
with as_user(None,'anon') as db:
    try:
        db.execute("select id from public.account_deletion_requests")
        raise AssertionError('Acceso anónimo a la cola')
    except psycopg.errors.InsufficientPrivilege:
        pass
print('Solicitud de borrado OK: cliente solo ve la propia, otros bloqueados, sin UPDATE/DELETE/TRUNCATE.',flush=True)
