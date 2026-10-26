#!/usr/bin/env python3
"""V31: test RLS/ACL y unicidad de soporte en PostgreSQL LOCAL desechable."""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg
dsn=os.environ.get('REPARADO_TEST_DATABASE_URL','')
if not dsn or psycopg.conninfo.conninfo_to_dict(dsn).get('host') not in ('127.0.0.1','localhost'):
    raise SystemExit('V31: solo PostgreSQL local, nunca producción')
root=Path(__file__).resolve().parents[1]
A='00000000-0000-4000-8000-000000000001'
B='00000000-0000-4000-8000-000000000002'
KEY='81ee20bb-f5f8-4ab2-a533-59f363947a31'
SECOND='81ee20bb-f5f8-4ab2-a533-59f363947a32'

@contextmanager
def as_user(uid,role='authenticated'):
    with psycopg.connect(dsn) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s, false)",(uid or '',))
        db.execute("select set_config('request.jwt.claim.role',%s, false)",(role,))
        yield db

with psycopg.connect(dsn) as db:
    sql=(root/'supabase/migration-v31.sql').read_text(encoding='utf8')
    db.execute(sql)
    db.execute(sql)
    assert db.execute("select relrowsecurity from pg_class where oid='public.support_reports'::regclass").fetchone()[0]
    assert not db.execute("select has_column_privilege('anon','public.support_reports','client_report_id','INSERT')").fetchone()[0]
    assert db.execute("select has_column_privilege('authenticated','public.support_reports','client_report_id','SELECT')").fetchone()[0]
    assert not db.execute("select has_column_privilege('authenticated','public.support_reports','client_report_id','UPDATE')").fetchone()[0]

sql="""insert into public.support_reports(user_id,subject,description,context,client_report_id)
 values (%s,'Error cargando perfil','No consigo consultar mis incidencias privadas','cuenta',%s)
 returning id"""
with as_user(A) as db:
    record=db.execute(sql,(A,KEY)).fetchone()[0]
    assert record
    try:
        with db.transaction():
            db.execute(sql,(A,KEY))
    except psycopg.Error as exc:
        assert exc.sqlstate=='23505',(exc.sqlstate,str(exc))
    else:raise AssertionError('Se admitió duplicado de una incidencia')
    assert db.execute("select id from public.support_reports where user_id=%s and client_report_id=%s",(A,KEY)).fetchone()[0]==record
    try:
        with db.transaction():
            db.execute("update public.support_reports set client_report_id=%s where id=%s",(SECOND,record))
    except psycopg.Error as exc:
        assert exc.sqlstate=='42501',(exc.sqlstate,str(exc))
    else:raise AssertionError('Cliente pudo editar clave inmutable')
with as_user(B) as db:
    assert db.execute('select id from public.support_reports where client_report_id=%s',(KEY,)).fetchone() is None
    other=db.execute(sql,(B,KEY)).fetchone()[0]
    assert other!=record
    try:
        with db.transaction():
            db.execute(sql,(A,SECOND))
    except psycopg.Error as exc:assert exc.sqlstate=='42501',(exc.sqlstate,str(exc))
    else:raise AssertionError('Cliente pudo crear soporte para otro')
with as_user(None,'anon') as db:
    try:
        with db.transaction():
            db.execute(sql,(A,SECOND))
    except psycopg.Error as exc:assert exc.sqlstate=='42501',(exc.sqlstate,str(exc))
    else:raise AssertionError('Anónimo puede crear soporte')
with psycopg.connect(dsn) as db:
    assert db.execute("select count(*) from public.support_reports where client_report_id=%s",(KEY,)).fetchone()[0]==2
    assert db.execute("select count(*) from public.support_email_outbox where report_id in (%s,%s)",(record,other)).fetchone()[0]==2
print('V31 OK: soporte idempotente, privacidad por cuenta, clave inmutable, outbox única',flush=True)
