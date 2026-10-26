#!/usr/bin/env python3
"""V32: preservar permisos/RLS y mejorar auth.uid() sin datos reales.
Se ejecuta después de tests/supabase-roles-rls.py en PostgreSQL LOCAL efímero.
"""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg

DSN=os.getenv('REPARADO_TEST_DATABASE_URL','')
if not DSN or psycopg.conninfo.conninfo_to_dict(DSN).get('host') not in ('localhost','127.0.0.1'):
    raise SystemExit('V32 sólo se admite contra PostgreSQL local desechable.')
ROOT=Path(__file__).resolve().parents[1]
C1="00000000-0000-4000-8000-000000000001"
C2="00000000-0000-4000-8000-000000000002"
OP="00000000-0000-4000-8000-000000000003"
ADM="00000000-0000-4000-8000-000000000004"
R1="10000000-0000-4000-8000-000000000001"
R2="10000000-0000-4000-8000-000000000002"
POLICIES={
    ('profiles','profile own read'),('profiles','profile own update'),
    ('device_tokens','tokens own'),('invoices','invoice customer and admin'),
    ('messages','message own insert'),('messages','message participants'),
    ('notifications','notifications mark own'),('notifications','notifications read own'),
    ('service_requests','request customer create'),
    ('service_requests','request customer read'),('service_requests','request staff update')
}

def snapshot(db):
    policies=db.execute("""
      select tablename,policyname,permissive,roles::text,cmd
      from pg_policies where schemaname='public'
      order by tablename,policyname""").fetchall()
    grants=db.execute("""
      select t.relname,r.rolname,p.privilege_type
      from pg_class t cross join
       (values ('anon'),('authenticated')) r(rolname) cross join
       (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
               ('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege_type)
      where t.relnamespace='public'::regnamespace
        and t.relkind in ('r','p') and
        has_table_privilege(r.rolname, t.oid, p.privilege_type)
      order by t.relname,r.rolname,p.privilege_type""").fetchall()
    return policies,grants

@contextmanager
def user(uid,role='authenticated'):
    with psycopg.connect(DSN) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or '',))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

def check_isolation():
    with user(C1) as db:
        assert {str(row[0]) for row in db.execute(
            'select id from public.service_requests').fetchall()}=={R1}
        assert len(db.execute('select id from public.profiles').fetchall())==1
        assert db.execute('select count(*) from public.invoices').fetchone()[0]==1
        # R1 completado, y su factura final sigue visible para el cliente.
        assert db.execute('select count(*) from public.notifications').fetchone()[0]>=1
    with user(C2) as db:
        assert {str(row[0]) for row in db.execute(
            'select id from public.service_requests').fetchall()}=={R2}
        assert len(db.execute('select id from public.profiles').fetchall())==1
        assert db.execute('select count(*) from public.invoices').fetchone()[0]==1
        assert db.execute('select count(*) from public.notifications').fetchone()[0]==1
    with user(OP) as db:
        assert {str(row[0]) for row in db.execute(
            'select id from public.service_requests').fetchall()}=={R1}
        assert db.execute('select count(*) from public.invoices').fetchone()[0]==0
    with user(ADM) as db:
        assert len(db.execute('select id from public.profiles').fetchall())==4
        assert {str(row[0]) for row in db.execute(
            'select id from public.service_requests').fetchall()}=={R1,R2}
    with user(None,'anon') as db:
        try:
            db.execute('select id from public.service_requests').fetchall()
        except psycopg.Error as error:
            assert error.sqlstate=='42501'
        else:raise AssertionError('Anon gained permission to see requests')

with psycopg.connect(DSN) as db:
    before=snapshot(db)
    migration=(ROOT/'supabase/migration-v32.sql').read_text(encoding='utf-8')
    db.execute(migration)
    after=snapshot(db)
    assert after==before,'V32 accidentally changed roles, policies or base GRANTs'
    current=db.execute("""
      select tablename,policyname,coalesce(qual,''),coalesce(with_check,'')
      from pg_policies where schemaname='public'""").fetchall()
    affected={(tab,pol) for tab,pol,q,c in current if (tab,pol) in POLICIES}
    assert affected==POLICIES,('Policy missing',POLICIES-affected)
    assert all('SELECT auth.uid()' in (q+' '+c) for tab,pol,q,c in current
               if (tab,pol) in POLICIES),(current,)
    predicates={(tab,pol):(q,c) for tab,pol,q,c in current}
    db.execute(migration)
    assert snapshot(db)==before,'Re-applying V32 changed grants or policy identities'
    current2=db.execute("""
      select tablename,policyname,coalesce(qual,''),coalesce(with_check,'')
      from pg_policies where schemaname='public'""").fetchall()
    assert predicates=={(tab,pol):(q,c) for tab,pol,q,c in current2},'V32 is not idempotent'
check_isolation()
print('V32 OK: 11 políticas optimizadas; permisos y roles idénticos, A/B/operario/admin/anon aislados, repetible.',flush=True)
