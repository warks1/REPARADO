-- REPARADO V12 · Política estricta para fotos de solicitudes.
-- Ejecutar después de storage-photos.sql y migraciones V4–V11.
-- La ruta de cada objeto DEBE ser:
--   <id_cliente_uuid>/<id_solicitud_uuid>/<archivo>
--
-- Corrección: leer por coincidencia de carpeta propia NO era suficiente.
-- Ahora la carpeta cliente DEBE corresponder al customer_id de esa
-- solicitud existente, sea quien sea el lector autorizado.
-- No cambia fotografías almacenadas, datos personales ni contraseñas.

update storage.buckets
set public = false
where id = 'request-photos';

drop policy if exists "reparado photo upload own folder" on storage.objects;
drop policy if exists "reparado photo read own or staff" on storage.objects;

create policy "reparado photo upload own folder" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'request-photos'
  and cardinality(storage.foldername(name)) = 2
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.service_requests r
    where r.id::text = (storage.foldername(name))[2]
      and r.customer_id = (select auth.uid())
  )
);

create policy "reparado photo read own or staff" on storage.objects
for select to authenticated
using (
  bucket_id = 'request-photos'
  and cardinality(storage.foldername(name)) = 2
  and exists (
    select 1 from public.service_requests r
    where r.id::text = (storage.foldername(name))[2]
      and r.customer_id::text = (storage.foldername(name))[1]
      and (
        r.customer_id = (select auth.uid())
        or (select public.is_reparado_admin())
        or (
          r.operator_id = (select auth.uid())
          and (select public.is_reparado_staff())
        )
      )
  )
);

-- En un bucket de prueba vacío no hay objetos antiguos que revisar.
-- Las rutas históricas incorrectas, si las hubiera en otro entorno,
-- pueden dejar de ser visibles: deben corregirse a través de la
-- Storage API autorizada, no alterando storage.objects con SQL.
