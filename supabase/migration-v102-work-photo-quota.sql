-- REPARADO V102 · Límite de 8 fotografías impuesto por Storage, no por la UI.
-- Aplicar tras migration-v100-operator-work-reports.sql.
-- El único proyecto conectado es REPARADO Test; ensayar y verificar allí.
-- No se modifican objetos existentes ni se conceden permisos públicos.
begin;

do $preflight$
begin
  if to_regclass('public.work_reports') is null
     or to_regclass('public.service_requests') is null
     or to_regclass('storage.objects') is null
     or not exists (select 1 from storage.buckets where id='work-photos' and not public)
  then
    raise exception 'REPARADO_V102_REQUIRES_PRIVATE_V100_STORAGE';
  end if;
  if exists (
    select 1 from storage.objects o
    where o.bucket_id='work-photos'
    group by split_part(o.name,'/',1),split_part(o.name,'/',2)
    having count(*)>8
  ) then
    raise exception 'REPARADO_V102_EXISTING_WORK_PHOTO_LIMIT_EXCEEDED';
  end if;
end
$preflight$;

-- Schema no expuesto en la API PostgREST. Función privilegiada mínima:
-- inspeccionar los metadatos de Storage sin recursión RLS y bloquear el
-- parte de trabajo durante la evaluación de la cuota concurrente.
create schema if not exists reparado_private;
revoke all on schema reparado_private from public, anon;
grant usage on schema reparado_private to authenticated;

create or replace function reparado_private.work_photo_slot_available_v102(
  p_object_name text
) returns boolean
language plpgsql volatile security definer
set search_path = pg_catalog, public, storage, pg_temp
as $quota$
declare
  v_operator uuid;
  v_request uuid;
  v_folders text[];
  v_filename text;
  v_count bigint;
begin
  v_operator := auth.uid();
  if v_operator is null or p_object_name is null then return false; end if;
  v_folders := storage.foldername(p_object_name);
  v_filename := storage.filename(p_object_name);
  if cardinality(v_folders)<>2
     or v_folders[1]<>v_operator::text
     or v_folders[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_filename !~ '^foto-[a-f0-9]{64}\.(jpg|png|webp|heic)$'
  then return false; end if;
  v_request := v_folders[2]::uuid;

  -- Bloqueo transaccional: dos subidas simultáneas al mismo parte esperan
  -- al otro y el recuento se hace DESPUÉS de adquirir el bloqueo.
  perform 1
  from public.work_reports w
  join public.service_requests r on r.id=w.request_id
  join public.profiles p on p.id=w.operator_id
  where w.request_id=v_request
    and w.operator_id=v_operator
    and r.operator_id=v_operator
    and r.status='in_progress'
    and p.role='operator'
  for update of w;
  if not found then return false; end if;

  select count(*) into v_count
  from storage.objects o
  where o.bucket_id='work-photos'
    and o.name like v_operator::text||'/'||v_request::text||'/%';

  return v_count<8;
end;
$quota$;

revoke all on function reparado_private.work_photo_slot_available_v102(text)
  from public, anon, authenticated;
grant execute on function reparado_private.work_photo_slot_available_v102(text)
  to authenticated;

-- No política permisiva global: sólo INSERT de fotos del operario y su
-- servicio en curso. El chequeo en servidor se ejecuta por cada objeto.
drop policy if exists "reparado work photos upload" on storage.objects;
create policy "reparado work photos upload" on storage.objects
for insert to authenticated
with check (
  bucket_id='work-photos'
  and cardinality(storage.foldername(name))=2
  and (storage.foldername(name))[1]=(select auth.uid()::text)
  and storage.filename(name) ~ '^foto-[a-f0-9]{64}\.(jpg|png|webp|heic)$'
  and (select public.is_reparado_staff())
  and exists (
    select 1 from public.service_requests r
    join public.work_reports w on w.request_id=r.id
    where r.id::text=(storage.foldername(name))[2]
      and w.operator_id=(select auth.uid())
      and r.operator_id=(select auth.uid())
      and r.status='in_progress'
  )
  and reparado_private.work_photo_slot_available_v102(name)
);

comment on function reparado_private.work_photo_slot_available_v102(text) is
  'V102: quota máximo 8 fotos/parte; rol operario, servicio en curso y bloqueo concurrente; sólo callable por RLS de Storage.';

-- Fallar si la función por error queda publicada como SECURITY DEFINER
-- dentro de public, o si el bucket deja de ser privado.
do $verify$
begin
 if exists (select 1 from storage.buckets where id='work-photos' and public)
    or not exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='reparado_private'
        and p.proname='work_photo_slot_available_v102'
        and p.prosecdef
    )
 then raise exception 'REPARADO_V102_PRIVATE_QUOTA_NOT_PROTECTED'; end if;
end $verify$;
commit;
