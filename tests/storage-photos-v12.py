#!/usr/bin/env python3
"""Aislamiento Storage REPARADO V12 en PostgreSQL 16 temporal, NUNCA remoto.

Prueba las políticas SQL originales y migración V12 con sustitutos mínimos
de storage.objects, storage.buckets y storage.foldername de Supabase.
No ejecuta operaciones Storage API ni modifica el proyecto del usuario.
"""
import os
from pathlib import Path
from contextlib import contextmanager
import psycopg

DSN=os.getenv("REPARADO_TEST_DATABASE_URL","")
if not DSN: raise SystemExit("Falta REPARADO_TEST_DATABASE_URL")
host=psycopg.conninfo.conninfo_to_dict(DSN).get("host")
if host not in ("localhost","127.0.0.1"):
    raise SystemExit("Prohibido ejecutar pruebas Storage contra bases remotas")

ROOT=Path(__file__).resolve().parents[1]
C1="00000000-0000-4000-8000-000000000001"
C2="00000000-0000-4000-8000-000000000002"
OP="00000000-0000-4000-8000-000000000003"
ADM="00000000-0000-4000-8000-000000000004"
R1="10000000-0000-4000-8000-000000000001"
R2="10000000-0000-4000-8000-000000000002"

@contextmanager
def as_user(uid=None,role="authenticated"):
    with psycopg.connect(DSN) as db:
        db.execute("set role "+role)
        db.execute("select set_config('request.jwt.claim.sub',%s,false)",(uid or "",))
        db.execute("select set_config('request.jwt.claim.role',%s,false)",(role,))
        yield db

def reject(db,statement,args=()):
    try:
        with db.transaction():
            db.execute(statement,args)
    except psycopg.Error as ex:
        assert ex.sqlstate=="42501",(ex.sqlstate,str(ex))
        return
    raise AssertionError("Almacenamiento sin autorización aceptado: "+statement)

with psycopg.connect(DSN) as db:
    db.execute("""do $setup$ begin
      if not exists(select 1 from pg_roles where rolname='anon')
        then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated')
        then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='service_role')
        then create role service_role; end if;
    end $setup$""")
    db.execute("create schema if not exists auth")
    db.execute("""create table auth.users (
      id uuid primary key,raw_user_meta_data jsonb not null default '{}'::jsonb)""")
    db.execute("""create function auth.uid() returns uuid language sql stable as $f$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $f$""")
    db.execute("""create function auth.role() returns text language sql stable as $f$
      select nullif(current_setting('request.jwt.claim.role',true),'')
    $f$""")
    db.execute("grant usage on schema auth to authenticated,anon")
    db.execute("grant execute on function auth.uid() to authenticated,anon")
    db.execute("grant execute on function auth.role() to authenticated,anon")
    db.execute((ROOT/"schema.sql").read_text(encoding="utf8"))
    for n in range(4,12):
        if n==11:
            db.execute("""grant select,insert,update,delete on public.profiles,
              public.service_requests,public.messages,public.notifications,
              public.device_tokens,public.invoices to anon""")
            db.execute("""grant select on public.profiles,public.service_requests,
              public.messages,public.notifications,public.device_tokens,
              public.invoices to authenticated""")
        db.execute((ROOT/f"supabase/migration-v{n}.sql").read_text(encoding="utf8"))
    db.execute("grant usage on schema public to authenticated,anon")
    db.execute("grant select on public.service_requests,public.profiles to authenticated")
    for uid,role in [(C1,"customer"),(C2,"customer"),(OP,"operator"),(ADM,"admin")]:
        db.execute("insert into auth.users(id) values(%s)",(uid,))
        db.execute("update public.profiles set role=%s where id=%s",(role,uid))
    db.execute("""insert into public.service_requests
      (id,customer_id,service_name,category,street,address_number,
       postal_code,city,phone,status)
       values(%s,%s,'Foto A','Fontanería','Calle prueba','1','08001',
         'Barcelona','000000000','quoted')""",(R1,C1))
    db.execute("""insert into public.service_requests
      (id,customer_id,service_name,category,street,address_number,
       postal_code,city,phone,status)
       values(%s,%s,'Foto B','Fontanería','Calle prueba','2','08001',
         'Barcelona','000000000','quoted')""",(R2,C2))
    db.execute("update public.service_requests set operator_id=%s where id=%s",(OP,R1))

    # Simular solo las piezas de Supabase Storage que usan las políticas.
    db.execute("create schema storage")
    db.execute("""create table storage.buckets (
       id text primary key,name text,public boolean,file_size_limit bigint,
       allowed_mime_types text[])""")
    db.execute("""create table storage.objects (
       id uuid primary key default gen_random_uuid(),
       bucket_id text not null,name text not null)""")
    db.execute("alter table storage.objects enable row level security")
    db.execute("""create function storage.foldername(p_name text)
       returns text[] language sql immutable as $f$
       select case when strpos(p_name,'/')=0 then array[]::text[]
         else string_to_array(
           substring(p_name for length(p_name)-strpos(reverse(p_name),'/')),
           '/'
         )
       end
       $f$""")
    db.execute("grant usage on schema storage to authenticated,anon")
    db.execute("grant execute on function storage.foldername(text) to authenticated,anon")
    db.execute("grant select,insert,update,delete on storage.objects to authenticated,anon")
    db.execute((ROOT/"supabase/storage-photos.sql").read_text(encoding="utf8"))
    # La migración siempre devuelve el bucket a PRIVADO.
    db.execute("update storage.buckets set public=true where id='request-photos'")
    db.execute((ROOT/"supabase/migration-v12.sql").read_text(encoding="utf8"))
    assert db.execute("""select public from storage.buckets where id='request-photos'""").fetchone()[0] is False
    # Repetir la migración no debe fallar ni abrir accesos.
    db.execute((ROOT/"supabase/migration-v12.sql").read_text(encoding="utf8"))

    # Datos mal formados HISTÓRICOS solo para probar visibilidad RLS:
    # no se introducen mediante API Storage ni bajo el rol de cliente.
    db.execute("""insert into storage.objects(bucket_id,name) values
      ('request-photos',%s),('request-photos',%s),
      ('request-photos',%s),('request-photos',%s),
      ('request-photos',%s),('foreign-bucket',%s)""",(
        f"{C1}/{R1}/correcta-a.webp",
        f"{C2}/{R2}/correcta-b.webp",
        f"{C1}/{R2}/ruta-cruzada.webp",
        f"{C2}/{R1}/ruta-falsa.webp",
        f"{C1}/{R1}/carpeta-extra/foto.webp",
        f"{C1}/{R1}/otro-bucket.webp"
      ))
    rows=db.execute("""select policyname,cmd,qual,with_check from pg_policies
      where schemaname='storage' and tablename='objects'
      and policyname like 'reparado photo%'""").fetchall()
    assert len(rows)==2,rows
    select_policy=next(x for x in rows if x[1]=='SELECT')
    insert_policy=next(x for x in rows if x[1]=='INSERT')
    assert "customer_id" in select_policy[2]
    assert "cardinality" in select_policy[2]
    assert "cardinality" in insert_policy[3]
    print("Storage V12: dos políticas RLS, bucket privado y migración repetible",flush=True)

def visible(uid,role="authenticated"):
    with as_user(uid,role) as db:
        return set(x[0] for x in db.execute(
            "select name from storage.objects where bucket_id='request-photos'").fetchall())

assert visible(C1)=={f"{C1}/{R1}/correcta-a.webp"}
assert visible(C2)=={f"{C2}/{R2}/correcta-b.webp"}
assert visible(OP)=={f"{C1}/{R1}/correcta-a.webp"}
assert visible(ADM)=={f"{C1}/{R1}/correcta-a.webp",f"{C2}/{R2}/correcta-b.webp"}
assert visible(None,"anon")==set()
print("RLS lectura: cliente A/B separados, operario solo asignado, admin válido, anon bloqueado",flush=True)

with as_user(C1) as db:
    db.execute("insert into storage.objects(bucket_id,name) values('request-photos',%s)",
               (f"{C1}/{R1}/subida-legal.webp",))
    reject(db,"insert into storage.objects(bucket_id,name) values('request-photos',%s)",
           (f"{C1}/{R2}/falsa.webp",))
    reject(db,"insert into storage.objects(bucket_id,name) values('request-photos',%s)",
           (f"{C2}/{R2}/falsa.webp",))
    reject(db,"insert into storage.objects(bucket_id,name) values('request-photos',%s)",
           (f"{C1}/{R1}/subcarpeta/falsa.webp",))
    reject(db,"insert into storage.objects(bucket_id,name) values('foreign-bucket',%s)",
           (f"{C1}/{R1}/falsa.webp",))
    reject(db,"insert into storage.objects(bucket_id,name) values('request-photos',%s)",
           (f"{C1}/falsa.webp",))
    # El objeto sí fue creado, pero RLS impide borrar o modificar sin política.
    assert db.execute("delete from storage.objects returning id").fetchall()==[]
    assert db.execute("update storage.objects set name='otro.webp' returning id").fetchall()==[]

with as_user(C2) as db:
    db.execute("insert into storage.objects(bucket_id,name) values('request-photos',%s)",
               (f"{C2}/{R2}/subida-legal.webp",))
    reject(db,"insert into storage.objects(bucket_id,name) values('request-photos',%s)",
           (f"{C2}/{R1}/falsa.webp",))
with as_user(OP) as db:
    reject(db,"insert into storage.objects(bucket_id,name) values('request-photos',%s)",
           (f"{C1}/{R1}/op-no-puede-subir.webp",))
with as_user(ADM) as db:
    reject(db,"insert into storage.objects(bucket_id,name) values('request-photos',%s)",
           (f"{C1}/{R1}/admin-no-puede-hacerse-pasar.webp",))
print("Subida: solo cliente propietario, solicitud correcta, dos carpetas, bucket privado",flush=True)
print("Storage RLS V12 OK: PostgreSQL TEMPORAL, sin credenciales ni datos reales",flush=True)
