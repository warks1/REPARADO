-- REPARADO: bucket PRIVADO de fotos (ejecutar en Supabase SQL Editor como administrador).
-- Los objetos tienen ruta: <auth.uid()>/<id_solicitud>/<nombre_fichero>.
-- Máximo 8 MB por imagen. No usar bucket público.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('request-photos','request-photos',false,8388608,array['image/jpeg','image/png','image/webp','image/heic'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "reparado photo upload own folder" on storage.objects;
drop policy if exists "reparado photo read own or staff" on storage.objects;
create policy "reparado photo upload own folder" on storage.objects
for insert to authenticated with check (
 bucket_id='request-photos' and
 (storage.foldername(name))[1] = (select auth.uid()::text) and
 exists (
  select 1 from public.service_requests r
  where r.id::text=(storage.foldername(name))[2] and r.customer_id=auth.uid()
 )
);
create policy "reparado photo read own or staff" on storage.objects
for select to authenticated using (
 bucket_id='request-photos' and
 ((storage.foldername(name))[1]=(select auth.uid()::text)
 or public.is_reparado_admin()
 or exists (
   select 1 from public.service_requests r
   where r.id::text=(storage.foldername(name))[2]
   and r.operator_id=auth.uid() and public.is_reparado_staff()
 ))
);
