#!/usr/bin/env python3
"""REPARADO V33: equivalencia exacta de lectura pública/privada RLS.
Sólo PostgreSQL local temporal, DESPUÉS de reviews-moderation-rls-v15.py.
"""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg

DSN=os.environ.get('REPARADO_TEST_DATABASE_URL','')
if not DSN or psycopg.conninfo.conninfo_to_dict(DSN).get('host') not in ('localhost','127.0.0.1'):
    raise SystemExit('REPARADO V33: sólo base PostgreSQL local desechable')
ROOT=Path(__file__).resolve().parents[1]
C1='00000000-0000-4000-8000-000000000001'
C2='00000000-0000-4000-8000-000000000002'
OP='00000000-0000-4000-8000-000000000003'
ADM='00000000-0000-4000-8000-000000000004'
R2='10000000-0000-4000-8000-000000000002'
PENDING='20000000-0000-4000-8000-000000000002'

@contextmanager
def user(uid=None,role='authenticated'):
    with psycopg.connect(DSN) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or '',))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

def policy_snapshot(db):
    return db.execute("""
      select policyname,permissive,roles::text,cmd,
             coalesce(qual,''),coalesce(with_check,'')
      from pg_policies
      where schemaname='public' and tablename='customer_reviews'
        and cmd in ('INSERT','UPDATE')
      order by policyname
    """).fetchall()

def privileges(db):
    return db.execute("""
      select role, privilege, column_name,
        has_column_privilege(role,'public.customer_reviews',column_name,privilege)
      from (values ('anon'),('authenticated')) r(role),
        (values ('SELECT'),('INSERT'),('UPDATE')) p(privilege),
        (values ('id'),('customer_id'),('request_id'),('rating'),
                ('comment'),('status'),('created_at')) c(column_name)
      order by role,privilege,column_name
    """).fetchall()

def view_rows(uid=None, role='authenticated'):
    with user(uid,role) as db:
        return {str(row[0]) for row in db.execute('select id from public.customer_reviews').fetchall()}

with psycopg.connect(DSN) as db:
    # Sólo una fila de ensayo adicional en una base desechable: simula reseña
    # propia pendiente para cliente B, sin tocar datos reales del usuario.
    db.execute("""insert into public.customer_reviews
      (id,customer_id,request_id,rating,comment,status)
      values (%s,%s,%s,4,'Trabajo terminado pendiente de moderación','pending')
      on conflict(id) do nothing""",(PENDING,C2,R2))
    before_nonselect=policy_snapshot(db)
    before_grants=privileges(db)
    initial=db.execute("""select count(*) from pg_policies
      where schemaname='public' and tablename='customer_reviews'
        and cmd='SELECT'""").fetchone()[0]
    assert initial==3,initial

before={str(i):view_rows(i) for i in (C1,C2,OP,ADM)}
before['anon']=view_rows(None,'anon')
assert len(before['anon'])==1,before
assert PENDING not in before[C1] and PENDING in before[C2]
assert before[OP]==before['anon']
assert PENDING in before[ADM]

with psycopg.connect(DSN) as db:
    migration=(ROOT/'supabase/migration-v33.sql').read_text(encoding='utf8')
    db.execute(migration)
    assert policy_snapshot(db)==before_nonselect,'Políticas INSERT/UPDATE modificadas'
    assert privileges(db)==before_grants,'Permisos de columnas cambiados'
    assert db.execute("""select count(*) from pg_policies
      where schemaname='public' and tablename='customer_reviews' and cmd='SELECT'""").fetchone()[0]==2

after={str(i):view_rows(i) for i in (C1,C2,OP,ADM)}
after['anon']=view_rows(None,'anon')
assert before==after,('V33 modificó visibilidad de reseñas',before,after)

with psycopg.connect(DSN) as db:
    db.execute(migration)
    assert policy_snapshot(db)==before_nonselect
    assert privileges(db)==before_grants

with user(C2) as db:
    assert db.execute(
        "update public.customer_reviews set status='approved' where id=%s returning id",
        (PENDING,)).fetchall()==[],'Cliente pudo aprobar reseña propia'
with user(ADM) as db:
    result=db.execute(
        "update public.customer_reviews set status='approved' where id=%s and status='pending' returning id,status",
        (PENDING,)).fetchall()
    # psycopg devuelve UUID nativo: comparar el valor serializado con el fixture.
    assert result and str(result[0][0])==PENDING,'Admin perdió moderación'
assert PENDING in view_rows(None,'anon'),'Reseña aprobada no visible públicamente'
print('V33 OK: igual visibilidad para clientes A/B, operario, admin y anon; moderación y columnas privadas intactas.',flush=True)
