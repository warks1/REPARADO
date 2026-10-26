#!/usr/bin/env python3
"""V27: reintentos sin duplicados, RLS de propietario, permisos mínimos.
Ejecutar exclusivamente en PostgreSQL temporal local tras setup V11 + V19.
"""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg

dsn=os.environ.get('REPARADO_TEST_DATABASE_URL','')
if not dsn or psycopg.conninfo.conninfo_to_dict(dsn).get('host') not in ('localhost','127.0.0.1'):
    raise SystemExit('V27: pruebas SOLO con base local desechable')
root=Path(__file__).resolve().parents[1]
A='00000000-0000-4000-8000-000000000001'
B='00000000-0000-4000-8000-000000000002'
KEY='57730960-c227-4bdb-bdbc-72fa034c74e5'
KEY_B='57730960-c227-4bdb-bdbc-72fa034c74e6'
FIELDS='customer_id,service_name,category,street,address_number,postal_code,city,phone,client_submission_id'
VALUES='(%s,%s,%s,%s,%s,%s,%s,%s,%s)'
def args(uid,key):
    return (uid,'Reparación de fuga','Fontanería','Calle de prueba','2','08001','Barcelona','000000000',key)

@contextmanager
def user(uid=None,role='authenticated'):
    with psycopg.connect(dsn) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or '',))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

with psycopg.connect(dsn) as db:
    migration=(root/'supabase/migration-v27.sql').read_text(encoding='utf8')
    db.execute(migration)
    db.execute(migration)
    assert db.execute("select relrowsecurity from pg_class where oid='public.service_requests'::regclass").fetchone()[0]
    assert not db.execute("select has_column_privilege('anon','public.service_requests','client_submission_id','INSERT')").fetchone()[0]
    assert db.execute("select has_column_privilege('authenticated','public.service_requests','client_submission_id','INSERT')").fetchone()[0]
    assert not db.execute("select has_column_privilege('authenticated','public.service_requests','client_submission_id','UPDATE')").fetchone()[0]
    assert db.execute("select count(*) from public.service_requests where client_submission_id is null").fetchone()[0]>=2

stmt=f'insert into public.service_requests({FIELDS}) values {VALUES} returning id'
with user(A) as db:
    initial=db.execute(stmt,args(A,KEY)).fetchone()[0]
    assert initial
    try:
        with db.transaction():
            db.execute(stmt,args(A,KEY))
    except psycopg.Error as e:
        assert e.sqlstate=='23505',str(e)
    else: raise AssertionError('No se impidió trabajo repetido')
    assert db.execute('select id from public.service_requests where customer_id=%s and client_submission_id=%s',(A,KEY)).fetchone()[0]==initial
    try:
        with db.transaction():
            db.execute('update public.service_requests set client_submission_id=%s where id=%s',(KEY_B,initial))
    except psycopg.Error as e:
        assert e.sqlstate=='42501',str(e)
    else: raise AssertionError('Cliente pudo cambiar clave inmutable')
with user(B) as db:
    assert db.execute('select id from public.service_requests where client_submission_id=%s',(KEY,)).fetchone() is None
    other=db.execute(stmt,args(B,KEY)).fetchone()[0]
    assert other!=initial # clave puede coincidir SOLO entre clientes distintos.
    try:
        with db.transaction():
            db.execute(stmt,args(A,KEY_B))
    except psycopg.Error as e:
        assert e.sqlstate=='42501',str(e)
    else: raise AssertionError('Cliente introdujo solicitud ajena')
with user(None,'anon') as db:
    try:
        with db.transaction():db.execute(stmt,args(A,KEY_B))
    except psycopg.Error as e:assert e.sqlstate=='42501',str(e)
    else:raise AssertionError('Anónimo pudo insertar un trabajo')
print('V27 OK: unicidad cliente/intento, sin duplicados, RLS, permisos mínimos, compatibilidad histórica',flush=True)
