-- REPARADO V12 · Protección de fotografías por solicitud y propietario.
-- Ejecutar después de storage-photos.sql y V11.
-- No modifica el esquema ni los metadatos internos de Supabase Storage.
-- Ruta obligatoria: <UUID_cliente>/<UUID_solicitud>/<archivo>.
--
-- Antes: bastaba que el primer directorio coincidiese con auth.uid()
-- para leer un objeto, sin comprobar si la solicitud aún pertenecía
-- a ese cliente. Un administrador también veía rutas inconsistentes.
-- Ahora toda lectura exige solicitud existente y cliente concordante.
-- Repetible; no elimina fotos. Las rutas antiguas no válidas
-- quedarán inaccesibles y deben revisarse sin difundir datos privados.

do $reparado_photo_bucket$
begin
  if not exists (
    select 1 from storage.buckets
    where id='request-photos' and public is false
  ) then
    raise exception 'REPARADO_V12_REQUIRES_PRIVATE_PHOTO_BUCKET';
  end if;
end
$reparado_photo_bucket$;

drop policy if exists "reparado photo upload own folder" on storage.objects;
drop policy if exists "reparado photo read own or staff" on storage.objects;

create policy "reparado photo upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id='request-photos'
    and cardinality(storage.foldername(name))=2
    and storage.filename(name)<>''
    and (storage.foldername(name))[1]=(select auth.uid()::text)
    and exists (
      select 1 from public.service_requests r
      where r.id::text=(storage.foldername(name))[2]
        and r.customer_id=(select auth.uid())
        and r.customer_id::text=(storage.foldername(name))[1]
    )
  );

create policy "reparado photo read own or staff" on storage.objects
  for select to authenticated
  using (
    bucket_id='request-photos'
    and cardinality(storage.foldername(name))=2
    and storage.filename(name)<>''
    and exists (
      select 1 from public.service_requests r
      where r.id::text=(storage.foldername(name))[2]
        and r.customer_id::text=(storage.foldername(name))[1]
        and (
          r.customer_id=(select auth.uid())
          or (select public.is_reparado_admin())
          or (
            r.operator_id=(select auth.uid())
            and (select public.is_reparado_staff())
          )
        )
    )
  );

-- No se concede UPDATE/DELETE a usuarios para reemplazar fotos.
-- No alterar otras políticas de otros buckets/proyectos.
