#!/usr/bin/env python3
"""Test ACL V19 only against disposable local PostgreSQL, NEVER hosted Supabase."""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg
dsn=os.getenv('REPARADO_TEST_DATABASE_URL','')
if not dsn or psycopg.conninfo.conninfo_to_dict(dsn).get('host') not in ('localhost','127.0.0.1'):
    raise SystemExit('Solo se admiten bases PostgreSQL locales.')
root=Path(__file__).resolve().parents[1]
C1='00000000-0000-4000-8000-000000000001'
C2='00000000-0000-4000-8000-000000000002'
tables=['profiles','service_requests','messages','notifications','device_tokens','invoices','customer_reviews']

@contextmanager
def as_user(uid,role='authenticated'):
    with psycopg.connect(dsn) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or '',))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

with psycopg.connect(dsn) as db:
    # Reproduce the overly broad historic privileges seen in hosted Test.
    db.execute("grant truncate, trigger, references, delete on " +
        ','.join('public.'+t for t in tables) +" to authenticated")
    db.execute("grant insert on public.profiles to authenticated")
    db.execute("grant insert,update on public.device_tokens,public.messages to authenticated")
    assert db.execute("select has_table_privilege('authenticated','public.invoices','TRUNCATE')").fetchone()[0]
    db.execute((root/'supabase/migration-v19.sql').read_text(encoding='utf8'))
    for tbl in tables:
        for priv in ('TRUNCATE','TRIGGER','REFERENCES','DELETE'):
            assert not db.execute("select has_table_privilege('authenticated',%s,%s)",('public.'+tbl,priv)).fetchone()[0],(tbl,priv)
        assert db.execute("select relrowsecurity from pg_class where oid=%s::regclass",('public.'+tbl,)).fetchone()[0],tbl
    assert db.execute("select has_column_privilege('authenticated','public.customer_reviews','status','UPDATE')").fetchone()[0]
    for tbl in ('messages','device_tokens'):
        assert not db.execute("select has_column_privilege('authenticated',%s,'created_at','INSERT')",('public.'+tbl,)).fetchone()[0]
    assert not db.execute("select has_table_privilege('authenticated','public.messages','UPDATE')").fetchone()[0]
    assert not db.execute("select has_table_privilege('authenticated','public.profiles','INSERT')").fetchone()[0]

with as_user(C1) as db:
    db.execute("insert into public.messages(customer_id,sender_id,body) values(%s,%s,%s)",
               (C1,C1,'Mensaje autorizado de prueba'))
    db.execute("insert into public.device_tokens(user_id,token,platform) values(%s,%s,%s)",
               (C1,'token-v19-provisional','ios'))
    db.execute("insert into public.device_tokens(user_id,token,platform) values(%s,%s,%s) on conflict(token) do update set user_id=excluded.user_id, platform=excluded.platform",
               (C1,'token-v19-provisional','android'))
    assert db.execute("select platform from public.device_tokens where user_id=%s",(C1,)).fetchone()[0]=='android'
    assert db.execute("select count(*) from public.messages where customer_id=%s",(C1,)).fetchone()[0]>=1

with as_user(C2) as db:
    assert db.execute("select count(*) from public.messages where customer_id=%s",(C1,)).fetchone()[0]==0
    assert db.execute("select count(*) from public.device_tokens where user_id=%s",(C1,)).fetchone()[0]==0
    assert not db.execute("select has_table_privilege(current_user,'public.invoices','TRUNCATE')").fetchone()[0]

with as_user(None,'anon') as db:
    for tbl in tables:
        assert not db.execute("select has_table_privilege('anon',%s,'TRUNCATE')",('public.'+tbl,)).fetchone()[0]
        assert not db.execute("select has_table_privilege('anon',%s,'DELETE')",('public.'+tbl,)).fetchone()[0]

print('V19 OK: no TRUNCATE/DELETE/TRIGGER/REFERENCES; chat y push conservados, RLS cliente ajeno aislado.',flush=True)
