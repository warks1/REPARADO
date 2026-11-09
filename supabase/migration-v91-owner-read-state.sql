-- REPARADO V91 · Lectura real de conversaciones privadas.
-- Aplicar tras V90, primero en REPARADO Test. No inserta conversaciones ficticias.
-- El administrador solo marca mensajes que ha recibido; el estado de lectura
-- se guarda en la base de datos y nunca se infiere de la caché de un navegador.

do $preflight$
begin
  if to_regprocedure('public.reparado_owner_conversations(integer,integer)') is null
    or to_regprocedure('public.is_reparado_admin()') is null
  then raise exception 'REPARADO_V91_REQUIRES_V90'; end if;
end
$preflight$;

create table if not exists public.owner_conversation_reads (
  admin_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  last_read_message_id uuid not null references public.messages(id) on delete cascade,
  primary key(admin_id,customer_id)
);
alter table public.owner_conversation_reads enable row level security;
revoke all on public.owner_conversation_reads from public,anon,authenticated;
grant select(admin_id,customer_id,last_read_message_id)
  on public.owner_conversation_reads to authenticated;
grant insert(admin_id,customer_id,last_read_message_id)
  on public.owner_conversation_reads to authenticated;
grant update(last_read_message_id)
  on public.owner_conversation_reads to authenticated;

drop policy if exists "owner reads own select" on public.owner_conversation_reads;
create policy "owner reads own select"
  on public.owner_conversation_reads for select to authenticated
  using (admin_id=(select auth.uid())
    and (select public.is_reparado_admin()));
drop policy if exists "owner reads own insert" on public.owner_conversation_reads;
create policy "owner reads own insert"
  on public.owner_conversation_reads for insert to authenticated
  with check (admin_id=(select auth.uid())
    and (select public.is_reparado_admin()));
drop policy if exists "owner reads own update" on public.owner_conversation_reads;
create policy "owner reads own update"
  on public.owner_conversation_reads for update to authenticated
  using (admin_id=(select auth.uid())
    and (select public.is_reparado_admin()))
  with check (admin_id=(select auth.uid())
    and (select public.is_reparado_admin()));

create or replace function public.reparado_mark_owner_chat_read(
  p_customer_id uuid,p_last_message_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path=''
as $mark$
declare
  message_date timestamptz;
begin
  if (select auth.uid()) is null or
     not coalesce((select public.is_reparado_admin()),false) then
    raise exception using errcode='42501',
      message='REPARADO_OWNER_INBOX_ADMIN_REQUIRED';
  end if;
  if p_customer_id is null or p_last_message_id is null then
    raise exception using errcode='22023',
      message='REPARADO_OWNER_INBOX_MESSAGE_REQUIRED';
  end if;

  -- Únicamente aceptar un ID de mensaje que pertenece al chat del cliente.
  select m.created_at into message_date
  from public.messages m
  where m.customer_id=p_customer_id and m.id=p_last_message_id;
  if not found then
    raise exception using errcode='22023',
      message='REPARADO_OWNER_INBOX_MESSAGE_NOT_IN_CHAT';
  end if;

  -- No retroceder la marca cuando se abren pestañas o páginas antiguas.
  insert into public.owner_conversation_reads(
    admin_id,customer_id,last_read_message_id
  ) values ((select auth.uid()),p_customer_id,p_last_message_id)
  on conflict(admin_id,customer_id) do update
  set last_read_message_id=excluded.last_read_message_id
  where exists(
    select 1 from public.messages incoming,public.messages previous
    where incoming.id=excluded.last_read_message_id
      and previous.id=public.owner_conversation_reads.last_read_message_id
      and (incoming.created_at,incoming.id)>(previous.created_at,previous.id)
  );
  return true;
end
$mark$;
revoke all on function public.reparado_mark_owner_chat_read(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.reparado_mark_owner_chat_read(uuid,uuid)
  to authenticated;

-- Reemplazo aditivo de la V90: añade has_unread como booleano.
create or replace function public.reparado_owner_conversations(
  p_offset integer default 0,p_limit integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $inbox$
declare
  response jsonb;
begin
  if (select auth.uid()) is null or
     not coalesce((select public.is_reparado_admin()),false) then
    raise exception using errcode='42501',
      message='REPARADO_OWNER_INBOX_ADMIN_REQUIRED';
  end if;
  if p_offset is null or p_limit is null or
     p_offset<0 or p_offset>3000000 or p_limit<1 or p_limit>30 then
    raise exception using errcode='22023',
      message='REPARADO_OWNER_INBOX_INVALID_PAGE';
  end if;

  with latest as (
    select distinct on(m.customer_id)
      m.customer_id,m.id as last_message_id,m.sender_id,
      m.created_at as last_message_at,left(m.body,500) as last_body
    from public.messages m
    order by m.customer_id,m.created_at desc,m.id desc
  ),
  page as (
    select l.* from latest l
    order by l.last_message_at desc,l.last_message_id desc
    limit p_limit offset p_offset
  ),
  decorated as (
    select p.*,
      exists (
        select 1 from public.messages incoming
        where incoming.customer_id=p.customer_id
          and incoming.sender_id=p.customer_id
          and (reads.last_read_message_id is null or
            (incoming.created_at,incoming.id)>(previous.created_at,previous.id))
      ) as has_unread
    from page p
    left join public.owner_conversation_reads reads
      on reads.customer_id=p.customer_id
      and reads.admin_id=(select auth.uid())
    left join public.messages previous
      on previous.id=reads.last_read_message_id
  )
  select pg_catalog.jsonb_build_object(
    'total',(select count(*) from latest),
    'rows',coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d)
        order by d.last_message_at desc,d.last_message_id desc)
      from decorated d
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
  if has_function_privilege('anon',
        'public.reparado_mark_owner_chat_read(uuid,uuid)','EXECUTE')
     or has_function_privilege('anon',
        'public.reparado_owner_conversations(integer,integer)','EXECUTE')
     or has_table_privilege('anon',
        'public.owner_conversation_reads','SELECT')
     or has_table_privilege('authenticated',
        'public.owner_conversation_reads','DELETE')
     or has_table_privilege('authenticated',
        'public.owner_conversation_reads','TRUNCATE')
     or (select p.prosecdef from pg_proc p
       where p.oid='public.reparado_mark_owner_chat_read(uuid,uuid)'::regprocedure)
  then raise exception 'REPARADO_V91_READ_PERMISSIONS_INVALID';
  end if;
end
$verify$;
