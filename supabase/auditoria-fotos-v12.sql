-- REPARADO Test | Auditoría de fotografías V12, solo lectura.
-- Complementa los 20 controles de auditoria-readonly-v9.sql.
-- No consulta el contenido de ninguna fotografía ni datos de clientes.
with checks(control,ok,detalle) as (
 select 'Bucket de fotos privado',
  exists(select 1 from storage.buckets
    where id='request-photos' and public is false),
  'El bucket de solicitudes debe seguir siendo privado.'
 union all
 select 'Subidas: cliente y solicitud obligatorios',
  exists(select 1 from pg_policies p
    where p.schemaname='storage' and p.tablename='objects'
      and p.policyname='reparado photo upload own folder'
      and p.cmd='INSERT'
      and 'authenticated'=any(p.roles)
      and p.with_check ilike '%customer_id%'
      and p.with_check ilike '%cardinality(storage.foldername%'
      and p.with_check ilike '%service_requests%'),
  'La subida debe restringirse al cliente de una solicitud existente.'
 union all
 select 'Lecturas: vinculadas al cliente de la solicitud',
  exists(select 1 from pg_policies p
    where p.schemaname='storage' and p.tablename='objects'
      and p.policyname='reparado photo read own or staff'
      and p.cmd='SELECT'
      and 'authenticated'=any(p.roles)
      and p.qual ilike '%customer_id%'
      and p.qual ilike '%service_requests%'
      and p.qual ilike '%operator_id%'
      and p.qual ilike '%cardinality(storage.foldername%'),
  'La lectura exige relación coherente entre la ruta, cliente, solicitud y rol.'
 union all
 select 'Solo dos políticas de REPARADO para Storage',
  (select count(*)=2 from pg_policies p
   where p.schemaname='storage' and p.tablename='objects'
     and p.policyname in (
       'reparado photo upload own folder',
       'reparado photo read own or staff')),
  'La app no introduce políticas de borrado o modificación de fotos.'
)
select control, case when ok then 'OK' else 'PENDIENTE' end as resultado,detalle
from checks order by control;
