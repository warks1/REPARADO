-- REPARADO V98 · Recuento de conversaciones auténticamente pendientes para el titular.
-- Aditivo. Requiere V91. No altera mensajes ni marcas de lectura.
do $preflight$
begin
  if to_regclass('public.messages') is null
     or to_regclass('public.owner_conversation_reads') is null
     or to_regprocedure('public.is_reparado_admin()') is null
  then raise exception 'REPARADO_V98_REQUIRES_V91'; end if;
  if not (select relrowsecurity from pg_class where oid='public.messages'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.owner_conversation_reads'::regclass)
  then raise exception 'REPARADO_V98_RLS_REQUIRED'; end if;
end
$preflight$;

create or replace function public.reparado_owner_unread_conversations()
returns bigint
language plpgsql
security invoker
set search_path=''
stable
as $unread$
declare
  total bigint;
begin
  if (select auth.uid()) is null or
     not coalesce((select public.is_reparado_admin()),false) then
    raise exception using errcode='42501',
      message='REPARADO_OWNER_UNREAD_ADMIN_REQUIRED';
  end if;

  -- Último mensaje entrante por cliente, desempate por ID.
  -- La marca es individual de cada administrador. RLS se aplica a todas
  -- las tablas porque la función es SECURITY INVOKER.
  with latest_incoming as (
    select distinct on (m.customer_id)
      m.customer_id,m.id,m.created_at
    from public.messages m
    where m.sender_id=m.customer_id
    order by m.customer_id,m.created_at desc,m.id desc
  )
  select count(*) into total
  from latest_incoming incoming
  left join public.owner_conversation_reads readmark
    on readmark.customer_id=incoming.customer_id
   and readmark.admin_id=(select auth.uid())
  left join public.messages previous
    on previous.id=readmark.last_read_message_id
  where readmark.last_read_message_id is null
     or (incoming.created_at,incoming.id)>(previous.created_at,previous.id);

  return total;
end
$unread$;

revoke all on function public.reparado_owner_unread_conversations()
  from public,anon,authenticated;
grant execute on function public.reparado_owner_unread_conversations()
  to authenticated;

do $verify$
begin
  if has_function_privilege('anon',
       'public.reparado_owner_unread_conversations()','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.reparado_owner_unread_conversations()','EXECUTE')
     or (select p.prosecdef from pg_proc p where
       p.oid='public.reparado_owner_unread_conversations()'::regprocedure)
  then raise exception 'REPARADO_V98_GRANTS_INVALID';end if;
end
$verify$;
