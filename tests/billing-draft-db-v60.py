#!/usr/bin/env python3
"""V60: permisos y borradores en PostgreSQL EFÍMERO local, nunca Supabase remoto.
Ejecutar después de tests/supabase-roles-rls.py.
"""
import os
from contextlib import contextmanager
from pathlib import Path
import psycopg

DSN=os.getenv('REPARADO_TEST_DATABASE_URL','')
if not DSN or psycopg.conninfo.conninfo_to_dict(DSN).get('host') not in ('localhost','127.0.0.1'):
    raise SystemExit('V60: la prueba solo permite PostgreSQL local descartable')
ROOT=Path(__file__).resolve().parents[1]
ADM='00000000-0000-4000-8000-000000000004'
C1='00000000-0000-4000-8000-000000000001'
OP='00000000-0000-4000-8000-000000000003'
R1='10000000-0000-4000-8000-000000000001'
R2='10000000-0000-4000-8000-000000000002'
stmt='''select public.reparado_save_invoice_draft(
    %s::uuid,%s::numeric,%s,%s,%s,%s,%s,%s,%s,%s::date)'''
args=(R1,121,'REPARADO EJEMPLO','B12345678','Calle prueba 1',
      'Cliente de prueba','12345678Z','Calle prueba 2','Servicio terminado','2026-10-28')

@contextmanager
def as_user(uid=None,role='authenticated'):
    with psycopg.connect(DSN) as db:
        db.execute('set role '+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or '',))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

def denied(db,sql,params=(),code='23514'):
    try:
        with db.transaction():
            db.execute(sql,params)
    except psycopg.Error as e:
        assert e.sqlstate==code,(e.sqlstate,code,str(e))
        return
    raise AssertionError('Acceso prohibido aceptado')

with psycopg.connect(DSN) as db:
    migration=(ROOT/'supabase/migration-invoice-drafts-v60.sql').read_text()
    db.execute(migration)
    db.execute(migration)
    assert db.execute("select relrowsecurity from pg_class where oid='public.invoice_drafts'::regclass").fetchone()[0]
    assert not db.execute("select has_table_privilege('authenticated','public.invoice_drafts','INSERT')").fetchone()[0]
    assert not db.execute("select has_table_privilege('authenticated','public.invoice_drafts','UPDATE')").fetchone()[0]
    assert not db.execute("select has_table_privilege('anon','public.invoice_drafts','SELECT')").fetchone()[0]
    assert not db.execute("""select has_function_privilege('anon',
       'public.reparado_save_invoice_draft(uuid,numeric,text,text,text,text,text,text,text,date)','EXECUTE')""").fetchone()[0]
    assert db.execute("select status::text,price from public.service_requests where id=%s",(R1,)).fetchone()==('completed',121)

with as_user(ADM) as db:
    first=db.execute(stmt,args).fetchone()[0]
    again=db.execute(stmt,(R1,121,'REPARADO EJEMPLO','B12345678','Calle prueba 1',
         'Cliente de prueba','12345678Z','Calle prueba 2','Servicio corregido','2026-10-28')).fetchone()[0]
    assert first==again,'Un trabajo debe conservar id de borrador, sin duplicados'
    row=db.execute("select description,base,vat,total from public.invoice_drafts where request_id=%s",(R1,)).fetchone()
    assert row==('Servicio corregido',100,21,121),row
    denied(db,stmt,(R1,130,*args[2:]))
    denied(db,stmt,(R2,60,*args[2:]))
    denied(db,stmt,(R1,121,*args[2:6],'?',*args[7:]))
    # Ni el administrador tiene permiso de SQL directo para editar los datos.
    denied(db,"update public.invoice_drafts set total=0 where request_id=%s",(R1,),code='42501')
    assert db.execute('select count(*) from public.invoice_drafts').fetchone()[0]==1

for uid in [C1,OP]:
    with as_user(uid) as db:
        assert db.execute('select count(*) from public.invoice_drafts').fetchone()[0]==0
        denied(db,stmt,args,code='42501')
        denied(db,"insert into public.invoice_drafts(request_id) values(%s)",(R1,),code='42501')

with as_user(None,'anon') as db:
    denied(db,"select * from public.invoice_drafts",code='42501')
    denied(db,stmt,args,code='42501')

with psycopg.connect(DSN) as db:
    db.execute("""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
       values(%s,%s,'V60-TEST-UNIQUE',100,21,121,'issued')""",(R1,C1))
with as_user(ADM) as db:
    denied(db,stmt,args)
    assert db.execute('select count(*) from public.invoice_drafts').fetchone()[0]==1

print('V60 OK: admin único, estado/importe, idempotencia, RLS privada, no escritura directa, no doble emisión.',flush=True)
