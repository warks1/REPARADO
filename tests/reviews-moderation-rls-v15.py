#!/usr/bin/env python3
"""Prueba SQL V13/V15 sobre PostgreSQL LOCAL, con cuatro identidades ficticias.
Ejecutar después de tests/supabase-roles-rls.py. No usar con proyectos alojados."""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg

dsn=os.environ.get('REPARADO_TEST_DATABASE_URL','')
if not dsn or psycopg.conninfo.conninfo_to_dict(dsn).get('host') not in ('127.0.0.1','localhost'):
    raise SystemExit('REPARADO: pruebas RLS permitidas SOLO con PostgreSQL local.')
root=Path(__file__).resolve().parents[1]
C1='00000000-0000-4000-8000-000000000001'
C2='00000000-0000-4000-8000-000000000002'
OP='00000000-0000-4000-8000-000000000003'
ADM='00000000-0000-4000-8000-000000000004'
R1='10000000-0000-4000-8000-000000000001'

@contextmanager
def as_user(uid=None, role='authenticated'):
    with psycopg.connect(dsn) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or '',))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

with psycopg.connect(dsn) as db:
    assert db.execute("select status::text from public.service_requests where id=%s",(R1,)).fetchone()[0]=='completed'
    db.execute((root/'supabase/migration-v13.sql').read_text(encoding='utf8'))
    db.execute((root/'supabase/migration-v15.sql').read_text(encoding='utf8'))
    assert db.execute("select relrowsecurity from pg_class where oid='public.customer_reviews'::regclass").fetchone()[0]
    assert not db.execute("select has_column_privilege('authenticated','public.customer_reviews','customer_id','SELECT')").fetchone()[0]
    assert not db.execute("select has_column_privilege('anon','public.customer_reviews','request_id','SELECT')").fetchone()[0]
    assert db.execute("select has_column_privilege('authenticated','public.customer_reviews','status','UPDATE')").fetchone()[0]
    assert not db.execute("select has_column_privilege('authenticated','public.customer_reviews','rating','UPDATE')").fetchone()[0]

with as_user(C1) as db:
    review_id=db.execute("""insert into public.customer_reviews(customer_id,request_id,rating,comment)
        values (%s,%s,3,'Atencion razonable y acabado correcto.')
        returning id""",(C1,R1)).fetchone()[0]
    assert db.execute("select status from public.customer_reviews where id=%s",(review_id,)).fetchone()[0]=='pending'
    assert db.execute("update public.customer_reviews set status='approved' where id=%s returning id",(review_id,)).fetchall()==[]

with as_user(C2) as db:
    assert db.execute("select id from public.customer_reviews where status='pending'").fetchall()==[]
    assert db.execute("update public.customer_reviews set status='approved' where id=%s returning id",(review_id,)).fetchall()==[]

with as_user(OP) as db:
    assert db.execute("select id from public.customer_reviews where status='pending'").fetchall()==[]
    assert db.execute("update public.customer_reviews set status='rejected' where id=%s returning id",(review_id,)).fetchall()==[]

with as_user(ADM) as db:
    assert db.execute("select id from public.customer_reviews where status='pending'").fetchall()[0][0]==review_id
    row=db.execute("update public.customer_reviews set status='approved' where id=%s and status='pending' returning id,status",(review_id,)).fetchone()
    assert row==(review_id,'approved')
    assert db.execute("update public.customer_reviews set status='rejected' where id=%s returning id",(review_id,)).fetchall()==[]

with as_user(C2) as db:
    assert db.execute("select id,rating from public.customer_reviews where status='approved'").fetchone()==(review_id,3)
    assert db.execute("update public.customer_reviews set status='rejected' where id=%s returning id",(review_id,)).fetchall()==[]

with as_user(None,'anon') as db:
    assert db.execute("select id,rating from public.customer_reviews where status='approved'").fetchone()==(review_id,3)
    try:
        db.execute("update public.customer_reviews set status='rejected' where id=%s",(review_id,))
        raise AssertionError('Anon pudo moderar una reseña.')
    except psycopg.errors.InsufficientPrivilege:
        pass

print('V15 OK: cliente, ajeno, operario, administrador y anónimo; aprobación única, RLS y columnas privadas.',flush=True)
