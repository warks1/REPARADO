-- REPARADO V11: accesos privados por defecto para el proyecto de pruebas.
-- Nunca convierte los endpoints de Supabase en una red privada:
-- impide a visitantes anónimos acceder a los datos de la aplicación.
-- Requiere V4-V10 instaladas. Compatible con clientes autenticados vía RLS.
-- No modifica usuarios, contraseñas, datos ni políticas RLS.

-- El rol anon NO tiene necesidad de consultar ni escribir información
-- en estas seis tablas, ni siquiera antes de iniciar sesión.
revoke all privileges on table
  public.profiles,
  public.service_requests,
  public.messages,
  public.notifications,
  public.device_tokens,
  public.invoices
from anon;

-- El acceso a los tokens y fotografías se controla por usuarios con sesión.
revoke all privileges on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- Evitar concesiones automáticas al anónimo para nuevos objetos creados
-- por el propietario habitual de migraciones (postgres).
-- Las futuras migraciones deben conceder explícitamente los permisos
-- que sus endpoints autenticados necesitan.
alter default privileges for role postgres in schema public
  revoke select,insert,update,delete on tables from anon;
alter default privileges for role postgres in schema public
  revoke usage,select on sequences from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

-- Conservamos los accesos autenticados que requieren los formularios y
-- procedimientos del cliente. Jamás conceder escritura de facturas a ellos.
do $private$
declare
  tab regclass;
begin
  foreach tab in array array[
    'public.profiles'::regclass,
    'public.service_requests'::regclass,
    'public.messages'::regclass,
    'public.notifications'::regclass,
    'public.device_tokens'::regclass,
    'public.invoices'::regclass
  ] loop
    if has_table_privilege('anon',tab,'SELECT')
       or has_table_privilege('anon',tab,'INSERT')
       or has_table_privilege('anon',tab,'UPDATE')
       or has_table_privilege('anon',tab,'DELETE')
    then
      raise exception 'REPARADO_V11_ANONYMOUS_TABLE_ACCESS: %',tab;
    end if;
    if not has_table_privilege('authenticated',tab,'SELECT') then
      raise exception 'REPARADO_V11_MISSING_AUTHENTICATED_READ: %',tab;
    end if;
  end loop;
  if not has_function_privilege('authenticated',
      'public.accept_reparado_quote(uuid)'::regprocedure,'EXECUTE')
    or not has_function_privilege('authenticated',
      'public.is_reparado_admin()'::regprocedure,'EXECUTE')
    or not has_function_privilege('authenticated',
      'public.is_reparado_staff()'::regprocedure,'EXECUTE') then
    raise exception 'REPARADO_V11_AUTH_REQUIRED_RPC';
  end if;
end
$private$;

-- Este esquema de clientes NO sirve para hacer el proyecto inaccesible
-- a cualquier persona en internet, desactivar nuevos registros en Auth,
-- ni ocultarlo del Dashboard a otros miembros de su organización.
-- Esas opciones se controlan desde los ajustes de Supabase.
