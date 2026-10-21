-- REPARADO · auditoría de SOLO LECTURA para Supabase, tras migraciones V4–V10.
-- Ejecutar en SQL Editor de un proyecto de pruebas, sin claves en ChatGPT.
-- No crea tablas, no instala funciones, no altera ni muestra datos privados:
-- solo indica presencia de protecciones y cuenta incidencias agregadas.
-- Ejecutar DESPUÉS de schema.sql y migraciones V4–V9.
--
-- Todas las filas deben mostrar 'OK' antes de permitir usuarios reales.
-- Esta auditoría NO comprueba por sí sola Storage privado, APNs/FCM,
-- datos fiscales, consentimiento ni los flujos completos en dispositivos.

with auditoria as (
 select 10 as orden,'RLS de perfiles'::text as control,
   (select relrowsecurity from pg_class where oid='public.profiles'::regclass) as correcto,
   'Los perfiles deben estar protegidos por políticas RLS.'::text as accion
 union all select 20,'RLS de solicitudes',
   (select relrowsecurity from pg_class where oid='public.service_requests'::regclass),
   'Los clientes y operarios solo deben consultar solicitudes permitidas.'
 union all select 30,'RLS de avisos',
   (select relrowsecurity from pg_class where oid='public.notifications'::regclass),
   'Los avisos son privados de cada usuario.'
 union all select 40,'RLS de facturas',
   (select relrowsecurity from pg_class where oid='public.invoices'::regclass),
   'Las facturas requieren políticas RLS y permisos de solo lectura.'
 union all select 50,'Política de facturas V6',
   exists(select 1 from pg_policies where schemaname='public'
      and tablename='invoices' and policyname='invoice customer and admin'),
   'El cliente no puede ver borradores ni facturas ajenas.'
 union all select 60,'Trigger agenda V7',
   exists(select 1 from pg_trigger where tgrelid='public.service_requests'::regclass
     and tgname='reparado_guard_operator_schedule_v7' and not tgisinternal and tgenabled<>'D'),
   'Instalar migration-v7.sql antes de recibir solicitudes.'
 union all select 70,'Trigger avisos V8',
   exists(select 1 from pg_trigger where tgrelid='public.service_requests'::regclass
     and tgname='reparado_notify_operator_assignment_v8' and not tgisinternal and tgenabled<>'D'),
   'Instalar migration-v8.sql y probar los avisos de operarios.'
 union all select 80,'Trigger facturas V9',
   exists(select 1 from pg_trigger where tgrelid='public.invoices'::regclass
     and tgname='reparado_guard_invoice_v9' and not tgisinternal and tgenabled<>'D'),
   'Instalar migration-v9.sql y no emitir facturas fiscales desde la beta.'
 union all select 90,'Número único factura V9',
   exists(select 1 from pg_class c
     join pg_index i on i.indexrelid=c.oid
     where c.relname='reparado_invoice_final_number_unique_v9'
       and i.indrelid='public.invoices'::regclass and i.indisunique and i.indisvalid),
   'Se exige un índice único de numeración de documentos finales.'
 union all select 100,'Clientes sin escritura de facturas',
   not has_table_privilege('authenticated','public.invoices','INSERT')
   and not has_table_privilege('authenticated','public.invoices','UPDATE')
   and not has_table_privilege('authenticated','public.invoices','DELETE'),
   'Revocar INSERT, UPDATE y DELETE del frontend para facturación.'
 union all select 110,'Agenda: operario/fecha',
   not exists(select 1 from public.service_requests r
     where r.status in ('scheduled','in_progress')
       and (r.operator_id is null or r.scheduled_at is null)),
   'Revisar visitas activas sin operario o fecha.'
 union all select 120,'Agenda: sin conflictos de 60 min',
   not exists(select 1 from public.service_requests a
     join public.service_requests b on a.operator_id=b.operator_id
       and a.id<b.id
       and a.status in ('scheduled','in_progress')
       and b.status in ('scheduled','in_progress')
       and a.scheduled_at is not null and b.scheduled_at is not null
       and abs(extract(epoch from (a.scheduled_at-b.scheduled_at)))<3600),
   'Resolver manualmente las visitas incompatibles del mismo operario.'
 union all select 130,'Facturas: números finales sin duplicados',
   not exists(select 1 from public.invoices
     where status<>'draft'
     group by upper(btrim(number)) having count(*)>1),
   'Resolver números duplicados de facturas registradas.'
 union all select 140,'Facturas: IVA y total',
   not exists(select 1 from public.invoices
     where status<>'draft' and
       (subtotal is null or vat is null or total is null
        or subtotal<0 or vat<0 or total<0
        or abs(subtotal+vat-total)>0.01
        or abs(vat-round(subtotal*0.21,2))>0.01)),
   'Validar desglose al 21 % antes de registrar documentos.'
 union all select 150,'Facturas: cliente correcto',
   not exists(select 1 from public.invoices f
     left join public.service_requests r on r.id=f.request_id
     where f.status<>'draft'
       and (r.id is null or f.customer_id is distinct from r.customer_id)),
   'Cada factura debe estar ligada al cliente de su solicitud.'
 union all select 160,'V10: funciones anónimas sin acceso',
   not exists(select 1 from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef
        and has_function_privilege('anon',p.oid,'EXECUTE')),
   'Revocar EXECUTE anónimo a todas las funciones internas SECURITY DEFINER.'
 union all select 170,'V10: triggers internos no públicos',
   not exists(select 1 from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef and
      p.proname not in ('accept_reparado_quote','is_reparado_admin','is_reparado_staff')
      and has_function_privilege('authenticated',p.oid,'EXECUTE')),
   'Revocar acceso directo a las funciones internas del servidor.'
 union all select 180,'V10: funciones de usuario disponibles',
   has_function_privilege('authenticated','public.accept_reparado_quote(uuid)','EXECUTE')
   and has_function_privilege('authenticated','public.is_reparado_admin()','EXECUTE')
   and has_function_privilege('authenticated','public.is_reparado_staff()','EXECUTE'),
   'Restituir únicamente las tres funciones requeridas por presupuestos y RLS.'
 union all select 190,'V10: siete índices de acceso',
   (select count(*)=7 from pg_indexes i
     where i.schemaname='public' and i.indexname in (
       'reparado_requests_customer_created_v10',
       'reparado_messages_customer_created_v10',
       'reparado_messages_sender_v10',
       'reparado_notifications_user_created_v10',
       'reparado_tokens_user_v10',
       'reparado_invoices_customer_created_v10',
       'reparado_invoices_request_v10')),
   'Crear índices de usuario y claves externas para solicitudes, mensajes, avisos, tokens y facturas.'
)
select control,case when correcto then 'OK' else 'PENDIENTE' end as resultado,
       case when correcto then 'Comprobación superada.' else accion end as detalle
from auditoria
order by orden;
