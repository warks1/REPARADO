-- REPARADO V19 · Privilegios mínimos para proteger datos personales.
-- Primero aplicar y verificar en REPARADO Test; sin cambios en filas ni usuarios.
-- RLS no protege TRUNCATE: estos permisos sobrantes eran especialmente peligrosos.
-- Se conservan SELECT con RLS y los INSERT/UPDATE que usa el cliente.
do $reparado_v19_preflight$
begin
  if to_regclass('public.customer_reviews') is null
     or to_regclass('public.service_requests') is null
     or to_regclass('public.messages') is null
     or to_regclass('public.device_tokens') is null then
    raise exception 'REPARADO_V19_REQUIRES_V15';
  end if;
end
$reparado_v19_preflight$;

revoke truncate, trigger, references, delete on table
  public.profiles, public.service_requests, public.messages,
  public.notifications, public.device_tokens, public.invoices,
  public.customer_reviews
from public, anon, authenticated;

-- El chat nunca necesita editar/borrar mensajes ni falsificar la fecha.
revoke insert, update on table public.messages from public, anon, authenticated;
grant insert (customer_id, sender_id, body) on public.messages to authenticated;

-- La creación de perfiles la hace el trigger de Auth, no los clientes.
revoke insert on table public.profiles from public, anon, authenticated;

-- Un dispositivo solo registra token, plataforma y propietario. El servidor
-- genera id y created_at. Se mantiene upsert sobre token para notificaciones.
revoke insert, update on table public.device_tokens from public, anon, authenticated;
grant insert (user_id, token, platform) on public.device_tokens to authenticated;
grant update (user_id, token, platform) on public.device_tokens to authenticated;

-- Mantener únicamente status como escritura autorizada de reseñas.
-- La aprobación sigue requiriendo RLS de administrador y estado pending.
revoke update on table public.customer_reviews from public, anon, authenticated;
grant update (status) on public.customer_reviews to authenticated;

-- Verificar en el propio servidor, no confiar en botones ocultos.
do $reparado_v19_verify$
declare tbl text;
begin
  foreach tbl in array array[
    'profiles', 'service_requests', 'messages', 'notifications',
    'device_tokens', 'invoices', 'customer_reviews'
  ] loop
    if has_table_privilege('authenticated','public.'||tbl,'TRUNCATE')
       or has_table_privilege('authenticated','public.'||tbl,'TRIGGER')
       or has_table_privilege('authenticated','public.'||tbl,'REFERENCES')
       or has_table_privilege('authenticated','public.'||tbl,'DELETE')
       or has_table_privilege('anon','public.'||tbl,'TRUNCATE')
       or has_table_privilege('anon','public.'||tbl,'DELETE') then
      raise exception 'REPARADO_V19_DANGEROUS_PRIVILEGE: %',tbl;
    end if;
    if not (select c.relrowsecurity from pg_class c where c.oid=('public.'||tbl)::regclass) then
      raise exception 'REPARADO_V19_RLS_DISABLED: %',tbl;
    end if;
  end loop;
  if has_table_privilege('authenticated','public.messages','UPDATE')
    or has_table_privilege('authenticated','public.profiles','INSERT')
    or has_column_privilege('authenticated','public.device_tokens','created_at','UPDATE')
    or has_column_privilege('authenticated','public.device_tokens','id','INSERT')
    or not has_column_privilege('authenticated','public.device_tokens','token','UPDATE')
    or not has_column_privilege('authenticated','public.customer_reviews','status','UPDATE')
  then
    raise exception 'REPARADO_V19_UNEXPECTED_COLUMN_PRIVILEGES';
  end if;
end
$reparado_v19_verify$;
