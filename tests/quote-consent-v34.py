#!/usr/bin/env python3
"""V34: proteger precio y consentimiento, contra admin y carreras de modificación.
SOLO una base efímera local después de tests/supabase-roles-rls.py.
"""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg

DSN=os.getenv('REPARADO_TEST_DATABASE_URL','')
if not DSN or psycopg.conninfo.conninfo_to_dict(DSN).get('host') not in ('127.0.0.1','localhost'):
    raise SystemExit('REPARADO V34: SOLO PostgreSQL desechable local')
ROOT=Path(__file__).resolve().parents[1]
C1='00000000-0000-4000-8000-000000000001'
C2='00000000-0000-4000-8000-000000000002'
OP='00000000-0000-4000-8000-000000000003'
ADM='00000000-0000-4000-8000-000000000004'
R1='10000000-0000-4000-8000-000000000001'
R2='10000000-0000-4000-8000-000000000002'

@contextmanager
def as_user(uid=None,role='authenticated'):
    with psycopg.connect(DSN) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or '',))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

def denied(db,query,params=(),code='23514'):
    try:
        with db.transaction():
            db.execute(query,params)
    except psycopg.Error as e:
        assert e.sqlstate==code,(e.sqlstate,str(e))
    else:
        raise AssertionError('Operación prohibida permitida: '+query)

with psycopg.connect(DSN) as db:
    migration=(ROOT/'supabase/migration-v34.sql').read_text(encoding='utf8')
    db.execute(migration)
    db.execute(migration)
    assert db.execute("""select count(*) from pg_trigger where
      tgrelid='public.service_requests'::regclass
      and tgname='reparado_guard_quote_consent_v34' and not tgisinternal""").fetchone()[0]==1
    assert not db.execute("select has_function_privilege('authenticated','public.accept_reparado_quote(uuid)','EXECUTE')").fetchone()[0]
    assert db.execute("select has_function_privilege('authenticated','public.accept_reparado_quote(uuid,numeric)','EXECUTE')").fetchone()[0]
    assert not db.execute("select has_function_privilege('anon','public.accept_reparado_quote(uuid,numeric)','EXECUTE')").fetchone()[0]

with as_user(ADM) as db:
    # Un administrador NO puede fingir aceptación ni programar sin consentimiento.
    denied(db,"update public.service_requests set status='accepted' where id=%s",(R2,))
    denied(db,"update public.service_requests set status='scheduled',operator_id=%s,scheduled_at='2026-10-27 09:00+00' where id=%s",(OP,R2))
    denied(db,"update public.service_requests set status='quoted' where id=%s",(R1,))
    assert db.execute("select status::text from public.service_requests where id=%s",(R2,)).fetchone()[0]=='quoted'
    # Hasta la aceptación, puede elaborar/corregir el presupuesto.
    db.execute("update public.service_requests set price=65.50 where id=%s",(R2,))

with as_user(C1) as db:
    assert db.execute("select public.accept_reparado_quote(%s,%s::numeric)",(R2,65.50)).fetchone()[0] is False
with as_user(C2) as db:
    # La RPC antigua sin cantidad es inaccesible, aunque se conozca su nombre.
    denied(db,"select public.accept_reparado_quote(%s)",(R2,),code='42501')
    assert db.execute("select public.accept_reparado_quote(%s,%s::numeric)",(R2,60)).fetchone()[0] is False
    assert db.execute("select public.accept_reparado_quote(%s,%s::numeric)",(R2,65.50)).fetchone()[0] is True
    assert db.execute("select public.accept_reparado_quote(%s,%s::numeric)",(R2,65.50)).fetchone()[0] is False

with as_user(ADM) as db:
    denied(db,"update public.service_requests set price=999 where id=%s",(R2,))
    denied(db,"update public.service_requests set price=999,status='quoted' where id=%s",(R2,))
    # La aceptación ya prestada no se puede reabrir/re-cotizar unilateralmente.
    denied(db,"update public.service_requests set status='quoted' where id=%s",(R2,))

with as_user(ADM) as db:
    db.execute("""update public.service_requests
      set operator_id=%s,operator_name='Operario de pruebas',
        status='scheduled',scheduled_at='2026-10-27 10:00+00'
      where id=%s""",(OP,R2))
    denied(db,"update public.service_requests set price=90 where id=%s",(R2,))

with as_user(OP) as db:
    db.execute("update public.service_requests set status='in_progress' where id=%s",(R2,))
    db.execute("update public.service_requests set status='completed' where id=%s",(R2,))

with as_user(ADM) as db:
    denied(db,"update public.service_requests set price=90 where id=%s",(R1,))
    denied(db,"update public.service_requests set price=90 where id=%s",(R2,))
    assert db.execute("select price,status::text from public.service_requests where id=%s",(R2,)).fetchone()==(65.50,'completed')

with as_user(None,'anon') as db:
    denied(db,"select public.accept_reparado_quote(%s,%s::numeric)",(R2,65.50),code='42501')

print('V34 OK: 5 roles, precio exacto, sin RPC heredada; admin no puede aceptar ni programar sin cliente; sin recotización posterior ni cambio de precio.',flush=True)
