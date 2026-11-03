#!/usr/bin/env python3
"""V66: fecha preferida protegida en PostgreSQL. SOLO base desechable local."""
import os
from datetime import timedelta
from pathlib import Path
from contextlib import contextmanager
import psycopg

DSN=os.getenv('REPARADO_TEST_DATABASE_URL','')
if not DSN or psycopg.conninfo.conninfo_to_dict(DSN).get('host') not in ('127.0.0.1','localhost'):
    raise SystemExit('V66: prohibido usar una base remota para este ensayo')
ROOT=Path(__file__).resolve().parents[1]
CUSTOMER='00000000-0000-4000-8000-000000000001'

@contextmanager
def customer_session():
    with psycopg.connect(DSN) as db:
        db.execute('set role authenticated')
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(CUSTOMER,))
        db.execute("select set_config('request.jwt.claim.role','authenticated',false)")
        yield db

with psycopg.connect(DSN) as db:
    for sqlfile in ('migration-v65-service-area.sql','migration-v66-preferred-date.sql',
                    'migration-v66-preferred-date.sql'):
        db.execute((ROOT/'supabase'/sqlfile).read_text(encoding='utf-8'))
    row=db.execute("""
        select t.tgtype,
               (select relrowsecurity from pg_class
                where oid='public.service_requests'::regclass)
        from pg_trigger t
        where t.tgrelid='public.service_requests'::regclass
          and t.tgname='reparado_guard_preferred_date_v66'
          and not t.tgisinternal and t.tgenabled<>'D'
    """).fetchone()
    assert row is not None and row[1] and row[0]&4 and not row[0]&16
    for role in ('anon','authenticated'):
        assert not db.execute("""
           select has_function_privilege(%s,
             'public.reparado_guard_preferred_date_v66()','EXECUTE')
        """,(role,)).fetchone()[0]

with customer_session() as db:
    today=db.execute("select (statement_timestamp() at time zone 'Europe/Madrid')::date").fetchone()[0]
    query="""insert into public.service_requests(
      customer_id,service_name,category,street,address_number,postal_code,city,phone,preferred_date
      ) values (%s,'Reparación de fuga','Fontanería','Calle prueba','5','08001',
                'Barcelona','000000000',%s) returning id"""
    try:
        with db.transaction():
            db.execute(query,(CUSTOMER,today-timedelta(days=1)))
    except psycopg.Error as error:
        assert error.sqlstate=='23514' and 'REPARADO_V66_PREFERRED_DATE_PAST' in str(error)
    else:
        raise AssertionError('La API aceptó una fecha preferida pasada')

    # Fecha opcional, hoy y mañana se permiten. Todos los datos son ficticios
    # dentro de la base efímera; no usan el Supabase del usuario.
    ids=[]
    for preferred in (None,today,today+timedelta(days=1)):
        ids.append(db.execute(query,(CUSTOMER,preferred)).fetchone()[0])
    assert len(set(ids))==3
    assert db.execute("""select count(*) from public.service_requests
       where id=any(%s)""",(ids,)).fetchone()[0]==3

print('V66 OK: API rechaza ayer; acepta hoy, mañana y sin fecha; RLS y triggers siguen protegidos.',flush=True)
