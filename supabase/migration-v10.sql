-- REPARADO V10 · Protección de ejecución RPC y rendimiento de consultas.
-- Válida tras V9. Primero probada sobre un PostgreSQL temporal.
-- No elimina datos, tablas ni políticas RLS existentes.
--
-- Supabase puede conceder EXECUTE a anon/authenticated por defecto
-- incluso cuando una migración anterior revocó el permiso a PUBLIC.
-- Revocar expresamente los tres roles; restituir solo funciones RPC
-- necesarias a una sesión autenticada.

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.reparado_guard_request_update()
  from public, anon, authenticated;
revoke execute on function public.reparado_notify_new_request()
  from public, anon, authenticated;
revoke execute on function public.reparado_notify_quote_accepted()
  from public, anon, authenticated;
revoke execute on function public.reparado_notify_request_update()
  from public, anon, authenticated;
revoke execute on function public.reparado_notify_staff_message()
  from public, anon, authenticated;
revoke execute on function public.accept_reparado_quote(uuid)
  from public, anon, authenticated;
revoke execute on function public.is_reparado_admin()
  from public, anon, authenticated;
revoke execute on function public.is_reparado_staff()
  from public, anon, authenticated;

-- RPC indispensable para el cliente: aceptación de su presupuesto.
-- Las funciones de rol son usadas por las políticas RLS internas.
grant execute on function public.accept_reparado_quote(uuid) to authenticated;
grant execute on function public.is_reparado_admin() to authenticated;
grant execute on function public.is_reparado_staff() to authenticated;

-- Resolver funciones del sistema antes del esquema de aplicación.
-- Todas las referencias a auth ya son explícitas en el código existente.
alter function public.handle_new_user() set search_path=pg_catalog,public,pg_temp;
alter function public.reparado_guard_request_update() set search_path=pg_catalog,public,pg_temp;
alter function public.reparado_notify_new_request() set search_path=pg_catalog,public,pg_temp;
alter function public.reparado_notify_quote_accepted() set search_path=pg_catalog,public,pg_temp;
alter function public.reparado_notify_request_update() set search_path=pg_catalog,public,pg_temp;
alter function public.reparado_notify_staff_message() set search_path=pg_catalog,public,pg_temp;
alter function public.accept_reparado_quote(uuid) set search_path=pg_catalog,public,pg_temp;
alter function public.is_reparado_admin() set search_path=pg_catalog,public,pg_temp;
alter function public.is_reparado_staff() set search_path=pg_catalog,public,pg_temp;

-- Índices para las FKs y consultas filtradas por usuario más habituales.
-- No se modifica el contenido ni la estructura lógica de las tablas.
create index if not exists reparado_requests_customer_created_v10
  on public.service_requests(customer_id,created_at desc);
create index if not exists reparado_messages_customer_created_v10
  on public.messages(customer_id,created_at desc);
create index if not exists reparado_messages_sender_v10
  on public.messages(sender_id);
create index if not exists reparado_notifications_user_created_v10
  on public.notifications(user_id,created_at desc);
create index if not exists reparado_tokens_user_v10
  on public.device_tokens(user_id);
create index if not exists reparado_invoices_customer_created_v10
  on public.invoices(customer_id,created_at desc);
create index if not exists reparado_invoices_request_v10
  on public.invoices(request_id);

-- Confirmar antes de terminar que no queda ninguna de estas RPC
-- ejecutable anónimamente y que el frontend autenticado conserva
-- las tres funciones imprescindibles.
do $reparado_permissions$
declare
  f regprocedure;
begin
  foreach f in array array[
    'public.handle_new_user()'::regprocedure,
    'public.reparado_guard_request_update()'::regprocedure,
    'public.reparado_notify_new_request()'::regprocedure,
    'public.reparado_notify_quote_accepted()'::regprocedure,
    'public.reparado_notify_request_update()'::regprocedure,
    'public.reparado_notify_staff_message()'::regprocedure,
    'public.accept_reparado_quote(uuid)'::regprocedure,
    'public.is_reparado_admin()'::regprocedure,
    'public.is_reparado_staff()'::regprocedure
  ] loop
    if has_function_privilege('anon',f,'EXECUTE') then
      raise exception 'REPARADO_V10_ANONYMOUS_FUNCTION_ACCESS: %',f;
    end if;
  end loop;

  if not has_function_privilege('authenticated',
       'public.accept_reparado_quote(uuid)'::regprocedure,'EXECUTE')
    or not has_function_privilege('authenticated',
       'public.is_reparado_admin()'::regprocedure,'EXECUTE')
    or not has_function_privilege('authenticated',
       'public.is_reparado_staff()'::regprocedure,'EXECUTE') then
    raise exception 'REPARADO_V10_MISSING_AUTHENTICATED_RPC';
  end if;

  foreach f in array array[
    'public.handle_new_user()'::regprocedure,
    'public.reparado_guard_request_update()'::regprocedure,
    'public.reparado_notify_new_request()'::regprocedure,
    'public.reparado_notify_quote_accepted()'::regprocedure,
    'public.reparado_notify_request_update()'::regprocedure,
    'public.reparado_notify_staff_message()'::regprocedure
  ] loop
    if has_function_privilege('authenticated',f,'EXECUTE') then
      raise exception 'REPARADO_V10_TRIGGER_FUNCTION_EXPOSED: %',f;
    end if;
  end loop;
end
$reparado_permissions$;
