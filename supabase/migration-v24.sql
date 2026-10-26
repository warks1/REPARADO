-- REPARADO V24 · Reasignación y baja de tokens de dispositivos entre cuentas.
-- Aplicar tras V19 en pruebas primero; no activa el envío remoto FCM/APNs.
-- Sólo dos operaciones mínimas: asociar token presentado por el dispositivo
-- a su sesión actual y darlo de baja si todavía pertenece a esa misma cuenta.
-- RLS y permisos directos no permiten que el cliente transfiera tokens.
do $reparado_v24_preflight$
begin
  if to_regclass('public.device_tokens') is null then
    raise exception 'REPARADO_V24_REQUIRES_DEVICE_TOKENS';
  end if;
end
$reparado_v24_preflight$;

revoke select, insert, update, delete, truncate, references, trigger
  on public.device_tokens from public, anon, authenticated;

create or replace function public.reparado_register_device(p_token text, p_platform text)
returns boolean
language plpgsql security definer set search_path=''
as $reparado$
declare current_user_id uuid;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null
    or p_token is null or length(p_token)<32 or length(p_token)>4096
    or p_platform is null or p_platform not in ('ios','android')
  then
    return false;
  end if;
  -- La clave es única: el mismo token sólo puede pertenecer a una cuenta.
  -- La reasignación al entrar en otro usuario es atómica.
  insert into public.device_tokens(user_id,token,platform)
  values(current_user_id,p_token,p_platform)
  on conflict(token) do update
    set user_id=excluded.user_id, platform=excluded.platform,
        created_at=now();
  return true;
end
$reparado$;

create or replace function public.reparado_revoke_device(p_token text)
returns boolean
language plpgsql security definer set search_path=''
as $reparado$
declare current_user_id uuid;
declare removed boolean;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null or p_token is null
     or length(p_token)<32 or length(p_token)>4096 then
    return false;
  end if;
  delete from public.device_tokens
  where user_id=current_user_id and token=p_token;
  removed := found;
  return removed;
end
$reparado$;

revoke all on function public.reparado_register_device(text,text) from public,anon,authenticated;
revoke all on function public.reparado_revoke_device(text) from public,anon,authenticated;
grant execute on function public.reparado_register_device(text,text) to authenticated;
grant execute on function public.reparado_revoke_device(text) to authenticated;

-- No exponer permisos DELETE/UPDATE/INSERT de la tabla a usuarios.
do $reparado_v24_verify$
begin
  if has_table_privilege('authenticated','public.device_tokens','DELETE')
    or has_table_privilege('authenticated','public.device_tokens','UPDATE')
    or has_table_privilege('authenticated','public.device_tokens','INSERT')
    or has_table_privilege('authenticated','public.device_tokens','SELECT')
    or has_function_privilege('anon','public.reparado_register_device(text,text)','EXECUTE')
    or has_function_privilege('anon','public.reparado_revoke_device(text)','EXECUTE')
  then
    raise exception 'REPARADO_V24_PRIVILEGES_UNSAFE';
  end if;
end
$reparado_v24_verify$;
