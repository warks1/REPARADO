-- REPARADO V12 · auditoría exclusiva de fotografías.
-- Solo SELECT, sin mostrar nombres de archivos ni datos de clientes.
-- Ejecutar DESPUÉS de supabase/migration-v12.sql, adicional a la
-- auditoría general de 20 comprobaciones.

with controles as (
  select 10 as orden, 'Fotos: bucket privado'::text as control,
    exists(select 1 from storage.buckets b
      where b.id='request-photos' and b.public=false
        and b.file_size_limit=8388608) as correcto,
    'Crear un bucket privado, con máximo de 8 MB por fichero.'::text as accion

  union all select 20,'Fotos: solo dos políticas de acceso',
    (select count(*)=2
       from pg_policies p
       where p.schemaname='storage' and p.tablename='objects'
         and p.policyname in (
           'reparado photo upload own folder',
           'reparado photo read own or staff')
         and p.roles='{authenticated}'::name[]),
    'Mantener SELECT e INSERT limitados a cuentas autenticadas.'

  union all select 30,'Fotos: lectura exige propietario y solicitud',
    exists(select 1 from pg_policies p
      where p.schemaname='storage' and p.tablename='objects'
        and p.policyname='reparado photo read own or staff'
        and p.cmd='SELECT'
        and p.qual like '%cardinality%'
        and p.qual like '%customer_id%'
        and p.qual like '%foldername%'
        and p.qual like '%operator_id%'
        and p.qual like '%is_reparado_admin%'),
    'V12 debe comprobar que carpeta de cliente y solicitud pertenecen al mismo propietario.'

  union all select 40,'Fotos: subida exige solicitud propia y ruta exacta',
    exists(select 1 from pg_policies p
      where p.schemaname='storage' and p.tablename='objects'
        and p.policyname='reparado photo upload own folder'
        and p.cmd='INSERT'
        and p.with_check like '%cardinality%'
        and p.with_check like '%customer_id%'
        and p.with_check like '%foldername%'
        and p.with_check like '%auth.uid%'),
    'V12 debe restringir la subida a la carpeta cliente/solicitud.'

  union all select 50,'Fotos: objetos actuales pertenecen a su cliente',
    not exists(
      select 1 from storage.objects o
      where o.bucket_id='request-photos'
        and (
          cardinality(storage.foldername(o.name))<>2
          or not exists(
            select 1 from public.service_requests r
            where r.id::text=(storage.foldername(o.name))[2]
              and r.customer_id::text=(storage.foldername(o.name))[1]
          )
        )
    ),
    'Revisar archivos históricos con rutas incorrectas usando la API Storage.'
)
select control,case when correcto then 'OK' else 'PENDIENTE' end as resultado,
       case when correcto then 'Comprobación superada.' else accion end as detalle
from controles order by orden;
