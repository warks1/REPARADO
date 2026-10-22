#!/usr/bin/env python3
"""Prueba SOLO sobre PostgreSQL LOCAL: SQL real Storage, datos ficticios.

Se ejecuta después de tests/supabase-roles-rls.py, que crea esquema,
migraciones V4-V11 y cuatro identidades simuladas. Nunca conecta a
Supabase alojado ni modifica metadatos reales de Storage.
"""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg

DSN=os.environ.get("REPARADO_TEST_DATABASE_URL","")
if not DSN:
    raise SystemExit("Falta REPARADO_TEST_DATABASE_URL (solo PostgreSQL local).")
if psycopg.conninfo.conninfo_to_dict(DSN).get("host") not in ("localhost","127.0.0.1"):
    raise SystemExit("Prueba bloqueada: no se admiten bases remotas.")

ROOT=Path(__file__).resolve().parents[1]
C1="00000000-0000-4000-8000-000000000001"
C2="00000000-0000-4000-8000-000000000002"
OP="00000000-0000-4000-8000-000000000003"
ADM="00000000-0000-4000-8000-000000000004"
R1="10000000-0000-4000-8000-000000000001"
R2="10000000-0000-4000-8000-000000000002"
B="request-photos"
valid_c1=f"{C1}/{R1}/grifo.webp"
valid_c2=f"{C2}/{R2}/sifon.webp"
spoof_c1=f"{C1}/{R2}/foto-ajena.webp"
spoof_c2=f"{C2}/{R1}/carpeta-no-coincide.webp"
orphan=f"{C1}/10000000-0000-4000-8000-000000000099/huérfano.webp"
extra=f"{C1}/{R1}/subdirectorio/invalido.webp"

def connect():
    return psycopg.connect(DSN)

@contextmanager
def acting_as(uid=None,role="authenticated"):
    with connect() as db:
        db.execute("set role "+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or "",))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

def names(db):
    return {row[0] for row in db.execute("select name from storage.objects").fetchall()}

def rejected(db,statement,params=()):
    try:
        with db.transaction():
            db.execute(statement,params)
    except psycopg.Error as error:
        assert error.sqlstate in ("42501","23514"),(error.sqlstate,str(error))
        return
    raise AssertionError("Escritura ajena indebidamente aceptada: "+statement)

with connect() as db:
    count=db.execute("select count(*) from auth.users").fetchone()[0]
    assert count==4,("Ejecutar primero tests/supabase-roles-rls.py",count)
    assert db.execute("select operator_id from public.service_requests where id=%s",(R1,)).fetchone()[0] is not None
    db.execute("create schema storage")
    db.execute("""create table storage.buckets (
      id text primary key,name text not null,public boolean not null,
      file_size_limit bigint,allowed_mime_types text[])""")
    db.execute("""create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null,
      name text not null)""")
    db.execute("""create or replace function storage.foldername(path text)
      returns text[] language sql immutable as $f$
        select case when strpos(path,'/')=0 then array[]::text[]
          else string_to_array(left(path,length(path)-strpos(reverse(path),'/')),'/')
          end
      $f$""")
    db.execute("""create or replace function storage.filename(path text)
      returns text language sql immutable as $f$
        select reverse(split_part(reverse(path),'/',1))
      $f$""")
    db.execute("alter table storage.objects enable row level security")
    db.execute("grant usage on schema storage to anon,authenticated")
    db.execute("grant execute on all functions in schema storage to authenticated")
    db.execute("grant select,insert on storage.objects to authenticated")
    db.execute((ROOT/"supabase/storage-photos.sql").read_text(encoding="utf8"))
    db.execute("""insert into storage.objects(bucket_id,name)
      values (%s,%s),(%s,%s),(%s,%s),(%s,%s),(%s,%s),(%s,%s),(%s,%s)""",
      (B,valid_c1,B,valid_c2,B,spoof_c1,B,spoof_c2,B,orphan,B,extra,
       "unrelated-bucket",f"{C1}/{R1}/otra-imagen.webp"))
    assert db.execute("select public from storage.buckets where id=%s",(B,)).fetchone()[0] is False

# Regresión que reproduce el problema anterior: un nombre con carpeta
# propiedad de C1 permitía consultar metadatos de otra solicitud.
with acting_as(C1) as db:
    leaked=names(db)
    assert spoof_c1 in leaked and orphan in leaked and extra in leaked,leaked
print("V12: vulnerabilidad de rutas históricas reproducida con objetos ficticios",flush=True)

with connect() as db:
    db.execute((ROOT/"supabase/migration-v12.sql").read_text(encoding="utf8"))
    # Confirmar que no se modificaron ni eliminaron objetos ficticios.
    assert db.execute("select count(*) from storage.objects").fetchone()[0]==7
    policies=db.execute("""select policyname from pg_policies
       where schemaname='storage' and tablename='objects'""").fetchall()
    assert len(policies)==2,policies

with acting_as(C1) as db:
    assert names(db)=={valid_c1},names(db)
    assert db.execute("insert into storage.objects(bucket_id,name) values(%s,%s) returning name",(B,f"{C1}/{R1}/nueva.webp")).fetchone()[0].endswith("/nueva.webp")
    rejected(db,"insert into storage.objects(bucket_id,name) values(%s,%s)",(B,spoof_c1))
    rejected(db,"insert into storage.objects(bucket_id,name) values(%s,%s)",(B,valid_c2))
    rejected(db,"insert into storage.objects(bucket_id,name) values(%s,%s)",(B,extra))
    rejected(db,"insert into storage.objects(bucket_id,name) values(%s,%s)",(B,orphan))
    assert not db.execute("select has_table_privilege(current_user,'storage.objects','DELETE')").fetchone()[0]

with acting_as(C2) as db:
    assert names(db)=={valid_c2},names(db)
    rejected(db,"insert into storage.objects(bucket_id,name) values(%s,%s)",(B,spoof_c2))

with acting_as(OP) as db:
    assert names(db)=={valid_c1},names(db)
    rejected(db,"insert into storage.objects(bucket_id,name) values(%s,%s)",(B,valid_c1))

with acting_as(ADM) as db:
    assert names(db)=={valid_c1,valid_c2},names(db)
    rejected(db,"insert into storage.objects(bucket_id,name) values(%s,%s)",(B,valid_c2))

with acting_as(None,role="anon") as db:
    assert not db.execute("select has_table_privilege(current_user,'storage.objects','SELECT')").fetchone()[0]

print("V12 OK: clientes aislados, operario asignado, admin, anon, subida propia y rutas inválidas",flush=True)
