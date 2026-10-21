-- REPARADO Test · Comprobación de cuatro cuentas de pruebas (solo lectura).
-- Ejecutar DESPUÉS de haber creado las cuentas vía Supabase Auth y de
-- haber asignado el rol de operario y administrador autorizados.
--
-- Únicamente devuelve recuentos y OK/REVISAR. No muestra nombres,
-- correos, contraseñas, tokens ni identificadores de los usuarios.
-- NO comprueba si Supabase Auth tiene desactivado el registro público,
-- ni si el correo real de invitación fue enviado/recibido.
--
-- Las condiciones "exactamente 4" son para el entorno TEST inicial,
-- NO para la futura base de producción ni para cuando se añadan usuarios.

with comprobaciones as (
  select 10 as orden, 'Cuatro cuentas en Auth'::text as control,
    (select count(*)=4 from auth.users) as ok,
    'Entorno de pruebas inicial, sin contar las cuentas de otros proyectos.'::text as detalle
  union all select 20, 'Cuatro correos confirmados',
    (select count(*)=4 from auth.users where email_confirmed_at is not null),
    'La confirmación no demuestra que se enviara o aceptara una invitación.'
  union all select 30, 'Cuatro perfiles enlazados',
    (select count(*)=4 from public.profiles p
      join auth.users u on u.id=p.id),
    'Cada cuenta de Auth debe tener su perfil de aplicación.'
  union all select 40, 'Dos clientes',
    (select count(*)=2 from public.profiles where role='customer'),
    'Ambas cuentas cliente sin privilegios de personal.'
  union all select 50, 'Un operario',
    (select count(*)=1 from public.profiles where role='operator'),
    'Permisos limitados a los servicios que le asignen.'
  union all select 60, 'Un administrador',
    (select count(*)=1 from public.profiles where role='admin'),
    'Único perfil autorizado para asignación de trabajos.'
  union all select 70, 'RLS de seis tablas',
    (select count(*)=6 from pg_class c
       join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public'
         and c.relname in ('profiles','service_requests','messages',
              'notifications','device_tokens','invoices')
         and c.relkind='r' and c.relrowsecurity),
    'Todas las tablas de la aplicación deben tener RLS.'
  union all select 80, 'Sin permisos anónimos de datos',
    not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname in ('profiles','service_requests','messages',
             'notifications','device_tokens','invoices')
        and (has_table_privilege('anon',c.oid,'SELECT')
          or has_table_privilege('anon',c.oid,'INSERT')
          or has_table_privilege('anon',c.oid,'UPDATE')
          or has_table_privilege('anon',c.oid,'DELETE'))),
    'V11 debe revocar los accesos del rol anon.'
  union all select 90, 'Fotografías en bucket privado',
    (select count(*)=1 from storage.buckets where id='request-photos' and public=false),
    'Las fotos nunca deben estar en un bucket público.'
  union all select 100, 'RPC mínimas para usuarios conectados',
    has_function_privilege('authenticated','public.accept_reparado_quote(uuid)','EXECUTE')
    and has_function_privilege('authenticated','public.is_reparado_admin()','EXECUTE')
    and has_function_privilege('authenticated','public.is_reparado_staff()','EXECUTE')
    and not has_function_privilege('anon','public.accept_reparado_quote(uuid)','EXECUTE'),
    'Presupuestos y comprobación de rol disponibles solo con sesión.'
)
select control, case when ok then 'OK' else 'REVISAR' end as resultado, detalle
from comprobaciones order by orden;
