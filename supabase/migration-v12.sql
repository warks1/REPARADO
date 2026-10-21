-- REPARADO V12 · Seguridad de fotografías por solicitud y propietario.
-- Ejecutar tras V11 y después de supabase/storage-photos.sql.
-- Todas las fotos conservan la ruta:
-- <customer_uuid>/<request_uuid>/<filename>.
-- Solo lectura/subida para identidades autorizadas sobre esa misma solicitud.
-- Cambia políticas RLS; NO modifica, copia ni elimina objetos.
--
-- Antes de instalar en un entorno con fotos preexistentes, comprueba que
-- los objetos antiguos usen rutas coherentes (carpeta de cliente y solicitud).
-- Los objetos con rutas inconsistentes dejarán de ser accesibles.

drop policy if exists "reparado photo upload own folder" on storage.objects;
drop policy if exists "reparado photo read own or staff" on storage.objects;

create policy "reparado photo upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id='request-photos'
  and cardinality(storage.foldername(name))=2
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (
    select 1 from public.service_requests r
    where r.id::text=(storage.foldername(name))[2]
      and r.customer_id=(select auth.uid())
      and r.customer_id::text=(storage.foldername(name))[1]
  )
);

create policy "reparado photo read own or staff"
on storage.objects for select to authenticated
using (
  bucket_id='request-photos'
  and cardinality(storage.foldername(name))=2
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
