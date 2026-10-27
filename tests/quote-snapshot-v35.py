#!/usr/bin/env python3
"""V35: constancia de aceptación real; SOLO PostgreSQL efímero local.
Ejecutar después de roles-rls.py y quote-consent-v34.py.
"""
import os
from pathlib import Path
from contextlib import contextmanager
from decimal import Decimal
import psycopg

DSN=os.getenv('REPARADO_TEST_DATABASE_URL','')
if not DSN or psycopg.conninfo.conninfo_to_dict(DSN).get('host') not in ('127.0.0.1','localhost'):
    raise SystemExit('V35 exige base desechable local, no Supabase remoto')
ROOT=Path(__file__).resolve().parents[1]
C1='00000000-0000-4000-8000-000000000001'
C2='00000000-0000-4000-8000-000000000002'
ADM='00000000-0000-4000-8000-000000000004'
R3='10000000-0000-4000-8000-000000000003'

@contextmanager
def as_user(uid):
    with psycopg.connect(DSN) as db:
        db.execute('set role authenticated')
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid,))
        db.execute("select set_config('request.jwt.claim.role','authenticated',false)")
        yield db

def denied(db,query,params=(),code='23514'):
    try:
        with db.transaction():
            db.execute(query,params)
    except psycopg.Error as exc:
        assert exc.sqlstate==code,(exc.sqlstate,str(exc))
    else:
        raise AssertionError('Operación prohibida permitida')

with psycopg.connect(DSN) as db:
    migration=(ROOT/'supabase/migration-v35.sql').read_text(encoding='utf8')
    db.execute(migration)
    db.execute(migration) # despliegue repetible; un único trigger
    assert db.execute("""select count(*) from pg_trigger
        where tgrelid='public.service_requests'::regclass
        and tgname='reparado_record_quote_snapshot_v35'
        and not tgisinternal""").fetchone()[0]==1
    db.execute("""insert into public.service_requests
        (id,customer_id,service_name,category,street,address_number,
         postal_code,city,phone,status,price)
        values (%s,%s,'Reparación de prueba','Fontanería','Calle Test',
        '1','08001','Barcelona','600000000','quoted',%s)""",
        (R3,C1,Decimal('105.45')))
    assert db.execute("select accepted_at,accepted_price from public.service_requests where id=%s",(R3,)).fetchone()==(None,None)
    assert not db.execute("select has_column_privilege('authenticated','public.service_requests','accepted_at','UPDATE')").fetchone()[0]

with as_user(C2) as db:
    assert db.execute("select public.accept_reparado_quote(%s,%s::numeric)",(R3,105.45)).fetchone()[0] is False
    assert db.execute("select count(*) from public.service_requests where id=%s",(R3,)).fetchone()[0]==0

with as_user(C1) as db:
    assert db.execute("select public.accept_reparado_quote(%s,%s::numeric)",(R3,105.44)).fetchone()[0] is False
    assert db.execute("select public.accept_reparado_quote(%s,%s::numeric)",(R3,105.45)).fetchone()[0] is True
    original=db.execute("""select accepted_at,accepted_price,status::text,
        abs(extract(epoch from (now()-accepted_at)))<60
        from public.service_requests where id=%s""",(R3,)).fetchone()
    assert original[0] is not None and original[1]==Decimal('105.45')
    assert original[2]=='accepted' and original[3] is True
    assert db.execute("select public.accept_reparado_quote(%s,%s::numeric)",(R3,105.45)).fetchone()[0] is False

with as_user(ADM) as db:
    denied(db,"update public.service_requests set accepted_at=now() where id=%s",(R3,),code='42501')
    denied(db,"update public.service_requests set accepted_price=9 where id=%s",(R3,),code='42501')
    denied(db,"update public.service_requests set price=90 where id=%s",(R3,))
    db.execute("update public.service_requests set status='cancelled' where id=%s",(R3,))
    row=db.execute("select accepted_at,accepted_price,status::text from public.service_requests where id=%s",(R3,)).fetchone()
    assert row==(original[0],original[1],'cancelled')

print('V35 OK: instante e importe emitidos por servidor, invisibles a otros clientes, inmutables tras cambios de estado.',flush=True)
