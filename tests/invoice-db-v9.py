#!/usr/bin/env python3
"""Migración V9: pruebas en PostgreSQL 16 LOCAL y efímero.

Nunca ejecutar en un Supabase real: crea y elimina tablas de ensayo.
También comprueba dos INSERT concurrentes con numeración equivalente.
"""
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import psycopg

DSN=os.environ.get("REPARADO_TEST_DATABASE_URL","")
if not DSN: raise SystemExit("No hay conexión local de prueba.")
if psycopg.conninfo.conninfo_to_dict(DSN).get("host") not in ("localhost","127.0.0.1"):
    raise SystemExit("Se prohíbe ejecutar la prueba sobre un servidor remoto.")
SQL=(Path(__file__).resolve().parents[1]/"supabase/migration-v9.sql").read_text(encoding="utf8")
C1="00000000-0000-4000-8000-000000000001"
C2="00000000-0000-4000-8000-000000000002"
R1="10000000-0000-4000-8000-000000000001"
R2="10000000-0000-4000-8000-000000000002"
def cn():return psycopg.connect(DSN)
def reject(conn,sql,args=(),code="23514"):
    try:
        with conn.transaction():
            if args:conn.execute(sql,args)
            else:conn.execute(sql)
    except psycopg.Error as e:
        assert e.sqlstate==code,(e.sqlstate,code,str(e))
        return str(e)
    raise AssertionError("PostgreSQL aceptó una modificación prohibida")

with cn() as db:
    db.execute("""DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    END $$""")
    db.execute("drop table if exists public.invoices cascade")
    db.execute("drop table if exists public.service_requests cascade")
    db.execute("drop table if exists public.profiles cascade")
    db.execute("create table public.profiles(id uuid primary key)")
    db.execute("create table public.service_requests(id uuid primary key,customer_id uuid not null references public.profiles(id))")
    db.execute("""create table public.invoices(
      id uuid primary key default gen_random_uuid(),
      request_id uuid references public.service_requests(id),
      customer_id uuid references public.profiles(id),
      number text not null,
      subtotal numeric(10,2) not null default 0,
      vat numeric(10,2) not null default 0,
      total numeric(10,2) not null default 0,
      status text not null default 'draft',
      pdf_path text,
      created_at timestamptz not null default now())""")
    db.execute("insert into public.profiles values(%s),(%s)",(C1,C2))
    db.execute("insert into public.service_requests values(%s,%s),(%s,%s)",(R1,C1,R2,C2))
    db.execute("""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
      values(%s,%s,'RP-2026-0001',100,21,121,'issued')""",(R1,C1))
    db.execute("""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
      values(%s,%s,' rp-2026-0001 ',100,21,121,'issued')""",(R2,C2))
    # El preflight rechaza la migración si ya hay documentos con número repetido.
    reject(db,SQL,code="23505")
    db.execute("delete from public.invoices where request_id=%s",(R2,))
    db.execute(SQL)
    db.execute(SQL)
    triggers=db.execute("""select count(*) from pg_trigger
      where tgname='reparado_guard_invoice_v9' and not tgisinternal""").fetchone()[0]
    assert triggers==1,("Migración no repetible",triggers)
    assert not db.execute("select has_table_privilege('authenticated','public.invoices','INSERT')").fetchone()[0]
    assert not db.execute("select has_table_privilege('authenticated','public.invoices','UPDATE')").fetchone()[0]
    assert not db.execute("select has_table_privilege('authenticated','public.invoices','DELETE')").fetchone()[0]
    assert db.execute("select has_table_privilege('authenticated','public.invoices','SELECT')").fetchone()[0]

    # La numeración final ignora espacios/caja, no así los borradores.
    reject(db,"""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
      values(%s,%s,' RP-2026-0001 ',100,21,121,'issued')""",(R2,C2),"23505")
    db.execute("""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
      values(%s,%s,'RP-2026-0001',0,0,0,'draft')""",(R2,C2))
    # Importe incoherente, tipo de IVA incorrecto, número vacío.
    reject(db,"""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
      values(%s,%s,'RP-2026-0002',100,20,120,'issued')""",(R1,C1))
    reject(db,"""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
      values(%s,%s,'RP-2026-0002',100,21,125,'issued')""",(R1,C1))
    reject(db,"""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
      values(%s,%s,' ',100,21,121,'issued')""",(R1,C1))
    reject(db,"""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
      values(%s,%s,'RP-2026-0002',100,21,121,'issued')""",(R1,C2))
    reject(db,"""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
      values(%s,%s,'RP-2026-0002',100,21,121,'unknown')""",(R1,C1))

    # Los documentos finales quedan bloqueados contra edición, borrado y
    # cambio de estado, incluso por un usuario SQL autorizado.
    final=db.execute("select id from public.invoices where status='issued' limit 1").fetchone()[0]
    reject(db,"update public.invoices set total=122 where id=%s",(final,))
    reject(db,"update public.invoices set status='paid' where id=%s",(final,))
    reject(db,"delete from public.invoices where id=%s",(final,))
    db.execute("""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
      values(%s,%s,'RP-2026-0003',49.59,10.41,60,'issued')""",(R1,C1))
    print("V9 PostgreSQL: preflight, unicidad, IVA 21 %, referencias, idempotencia, privilegios e inmutabilidad OK.",flush=True)

# Dos conexiones usando la misma numeración final: sólo una puede confirmar.
with cn() as db:
    db.execute("delete from public.invoices where status='draft'")
barrier=threading.Barrier(2)
outcomes={}
def writer(i):
    barrier.wait(timeout=8)
    try:
        with cn() as db:
            db.execute("""insert into public.invoices(request_id,customer_id,number,subtotal,vat,total,status)
              values(%s,%s,%s,100,21,121,'issued')""",
              (R1 if i==1 else R2,C1 if i==1 else C2,
               'RP-2026-0100' if i==1 else ' rp-2026-0100 '))
            db.commit()
        outcomes[i]="committed"
    except psycopg.Error as e:
        outcomes[i]=e.sqlstate
with ThreadPoolExecutor(max_workers=2) as pool:
    pool.submit(writer,1).result(timeout=20) if False else None
    f1=pool.submit(writer,1)
    f2=pool.submit(writer,2)
    f1.result(timeout=25)
    f2.result(timeout=25)
assert sorted(outcomes.values())==["23505","committed"],outcomes
with cn() as db:
    n=db.execute("""select count(*) from public.invoices
      where upper(btrim(number))='RP-2026-0100' and status='issued'""").fetchone()[0]
    assert n==1,n
print("V9 PostgreSQL: dos facturas simultáneas con el mismo número -> una aceptada y una rechazada.",flush=True)
