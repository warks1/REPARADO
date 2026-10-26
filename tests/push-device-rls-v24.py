#!/usr/bin/env python3
"""REPARADO V24: aislamiento de tokens con PostgreSQL LOCAL y usuarios ficticios.
Ejecutar tras roles V11, reseñas V15 y permisos V19; NUNCA en Supabase real.
"""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg

dsn=os.getenv('REPARADO_TEST_DATABASE_URL','')
if not dsn or psycopg.conninfo.conninfo_to_dict(dsn).get('host') not in ('localhost','127.0.0.1'):
    raise SystemExit('REPARADO V24: pruebas permitidas SOLO en PostgreSQL local.')
root=Path(__file__).resolve().parents[1]
C1='00000000-0000-4000-8000-000000000001'
C2='00000000-0000-4000-8000-000000000002'
A='reparado-device-token-alpha-sufficiently-long-00000001'
B='reparado-device-token-beta-sufficiently-long-00000002'
C='reparado-device-token-gamma-sufficiently-long-00000003'

@contextmanager
def user(uid=None,role='authenticated'):
    with psycopg.connect(dsn) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or '',))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

def denied(db,sql,args=()):
    try:
        with db.transaction():
            db.execute(sql,args)
    except psycopg.Error as exc:
        assert exc.sqlstate=='42501',(exc.sqlstate,str(exc))
        return
    raise AssertionError('Permiso peligroso aceptado: '+sql)

with psycopg.connect(dsn) as db:
    sql=(root/'supabase/migration-v24.sql').read_text(encoding='utf8')
    db.execute(sql)
    db.execute(sql)  # Repetible: ni columnas ni políticas peligrosas.
    for role in ('anon','authenticated'):
        for privilege in ('INSERT','UPDATE','DELETE','TRUNCATE','SELECT'):
            assert not db.execute(
                'select has_table_privilege(%s,%s,%s)',
                (role,'public.device_tokens',privilege)
            ).fetchone()[0],(role,privilege)
    for fn in ('reparado_register_device(text,text)','reparado_revoke_device(text)'):
        assert not db.execute("select has_function_privilege('anon',%s,'EXECUTE')",('public.'+fn,)).fetchone()[0]
        assert db.execute("select has_function_privilege('authenticated',%s,'EXECUTE')",('public.'+fn,)).fetchone()[0]

with user(C1) as db:
    assert db.execute('select public.reparado_register_device(%s,%s)',(A,'ios')).fetchone()[0] is True
    assert db.execute('select public.reparado_register_device(%s,%s)',(B,'android')).fetchone()[0] is True
    assert db.execute('select public.reparado_register_device(%s,%s)',('short','ios')).fetchone()[0] is False
    assert db.execute('select public.reparado_register_device(%s,%s)',(C,'web')).fetchone()[0] is False
    denied(db,'delete from public.device_tokens where token=%s',(A,))
    denied(db,'select token from public.device_tokens')
with user(C2) as db:
    assert db.execute('select public.reparado_revoke_device(%s)',(A,)).fetchone()[0] is False
    # El móvil ha cambiado de cliente: sólo el nuevo poseedor del token lo re-vincula.
    assert db.execute('select public.reparado_register_device(%s,%s)',(A,'android')).fetchone()[0] is True
with psycopg.connect(dsn) as db:
    rows=db.execute('select token,user_id::text from public.device_tokens where token in (%s,%s)',(A,B)).fetchall()
    assert dict(rows)=={A:C2,B:C1},rows

with user(C1) as db:
    assert db.execute('select public.reparado_revoke_device(%s)',(A,)).fetchone()[0] is False
    assert db.execute('select public.reparado_revoke_device(%s)',(B,)).fetchone()[0] is True
    assert db.execute('select public.reparado_register_device(%s,%s)',(C,'ios')).fetchone()[0] is True
with user(C2) as db:
    assert db.execute('select public.reparado_revoke_device(%s)',(A,)).fetchone()[0] is True
with user(None,'anon') as db:
    denied(db,'select public.reparado_register_device(%s,%s)',(C,'ios'))
    denied(db,'select public.reparado_revoke_device(%s)',(C,))
with psycopg.connect(dsn) as db:
    assert db.execute('select user_id::text from public.device_tokens where token=%s',(C,)).fetchone()[0]==C1
    assert db.execute('select count(*) from public.device_tokens where token in (%s,%s)',(A,B)).fetchone()[0]==0

print('V24 OK: tokens privados, reasignación A→B, revocación propia, otros móviles intactos, anon sin RPC.',flush=True)
