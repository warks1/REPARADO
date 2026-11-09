-- REPARADO V90 · Bandeja de conversaciones privadas del propietario.
-- MIGRACIÓN ADITIVA: no modifica mensajes existentes, permisos de tablas,
-- ni materializa chats o datos de clientes.
-- Ejecutar primero en REPARADO Test. SECURITY INVOKER + RLS obligatorias.
do $preflight$
begin
  if to_regclass('public.messages') is null
     or to_regprocedure('public.is_reparado_admin()') is null
  then
    raise exception 'REPARADO_V90_REQUIRES_MESSAGES_AND_ADMIN';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid='public.messages'::regclass)
  then
    raise exception 'REPARADO_V90_MESSAGES_RLS_REQUIRED';
  end if;
end
$preflight$;

create or replace function public.reparado_owner_conversations(
  p_offset integer default 0,
  p_limit integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $inbox$
declare
  response jsonb;
begin
  -- La RLS de messages también se evalúa: SECURITY INVOKER no la evita.
  if (select auth.uid()) is null or
     not coalesce((select public.is_reparado_admin()),false) then
    raise exception using errcode='42501',
      message='REPARADO_OWNER_INBOX_ADMIN_REQUIRED';
  end if;
  if p_offset is null or p_limit is null or
     p_offset<0 or p_offset>3000000 or
     p_limit<1 or p_limit>30 then
    raise exception using errcode='22023',
      message='REPARADO_OWNER_INBOX_INVALID_PAGE';
  end if;

  with latest as (
    -- Un solo mensaje por cliente, desempate estable cuando la hora coincide.
    select distinct on (m.customer_id)
      m.customer_id,m.id as last_message_id,m.sender_id,
      m.created_at as last_message_at,
      left(m.body,500) as last_body
    from public.messages m
    order by m.customer_id,m.created_at desc,m.id desc
  ),
  page as (
    select l.*
    from latest l
    order by l.last_message_at desc,l.last_message_id desc
    limit p_limit offset p_offset
  )
  select pg_catalog.jsonb_build_object(
    'total',(select count(*) from latest),
    'rows',coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)
        order by p.last_message_at desc,p.last_message_id desc)
      from page p
    ),'[]'::jsonb)
  ) into response;
  return response;
end
$inbox$;

revoke all on function public.reparado_owner_conversations(integer,integer)
  from public,anon,authenticated;
grant execute on function public.reparado_owner_conversations(integer,integer)
  to authenticated;

do $verify$
begin
  if has_function_privilege(
     'anon','public.reparado_owner_conversations(integer,integer)','EXECUTE'
     ) or not has_function_privilege(
     'authenticated','public.reparado_owner_conversations(integer,integer)','EXECUTE'
     ) or (select p.prosecdef from pg_proc p
        where p.oid='public.reparado_owner_conversations(integer,integer)'::regprocedure)
  then raise exception 'REPARADO_V90_INBOX_PERMISSIONS_INVALID';
  end if;
end
$verify$;
