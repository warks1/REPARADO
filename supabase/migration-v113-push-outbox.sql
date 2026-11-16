-- REPARADO V113 · Cola de notificaciones push.
-- Cada fila de public.notifications genera una tarea para el worker
-- reparado-push-worker, que la entrega a FCM (Android) y APNs (iOS).
-- Solo service_role accede a la cola; clientes y operarios no pueden leerla
-- ni provocar reenvíos. Requiere V24 (device_tokens y RPC de registro).
create table if not exists public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','sending','sent','failed')),
  attempts integer not null default 0 check (attempts between 0 and 6),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists reparado_push_queue_pending_idx
  on public.push_outbox(state,next_attempt_at,created_at);
alter table public.push_outbox enable row level security;
revoke all on table public.push_outbox from public,anon,authenticated;
grant select,insert,update,delete on table public.push_outbox to service_role;
-- El worker lee los tokens y elimina los que Apple/Google declaran caducados.
grant select,delete on table public.device_tokens to service_role;
grant select on table public.notifications to service_role;

create or replace function public.reparado_enqueue_push()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  insert into public.push_outbox(notification_id)
    values(new.id) on conflict (notification_id) do nothing;
  return new;
end;
$$;
revoke all on function public.reparado_enqueue_push() from public,anon,authenticated;

drop trigger if exists reparado_enqueue_push_after_notification on public.notifications;
create trigger reparado_enqueue_push_after_notification
  after insert on public.notifications for each row
  execute function public.reparado_enqueue_push();

-- Reclama una tarea de forma atómica (sin duplicados entre ejecuciones
-- simultáneas). Una tarea 'sending' abandonada se reintenta a los 15 minutos.
create or replace function public.reparado_claim_push()
returns table(outbox_id uuid,notification_id uuid,target_user_id uuid,
              push_title text,push_body text,try_number integer)
language sql security definer
set search_path=pg_catalog,public
as $$
  with picked as (
    select o.id from public.push_outbox as o
    where o.attempts<5
      and ((o.state='pending' and o.next_attempt_at<=now())
        or (o.state='sending' and o.claimed_at<now()-interval '15 minutes'))
    order by o.created_at
    for update skip locked
    limit 1
  ), claimed as (
    update public.push_outbox as q
      set state='sending',attempts=q.attempts+1,claimed_at=now()
    from picked where q.id=picked.id
    returning q.id,q.notification_id,q.attempts
  )
  select c.id,c.notification_id,n.user_id,n.title,n.body,c.attempts
  from claimed c join public.notifications n on n.id=c.notification_id;
$$;
revoke all on function public.reparado_claim_push() from public,anon,authenticated;
grant execute on function public.reparado_claim_push() to service_role;

do $check$
begin
  if has_table_privilege('authenticated','public.push_outbox','SELECT')
    or has_table_privilege('anon','public.push_outbox','SELECT')
    or has_function_privilege('authenticated','public.reparado_claim_push()','EXECUTE')
    or has_function_privilege('anon','public.reparado_claim_push()','EXECUTE')
  then
    raise exception 'V113: la cola push no debe ser accesible a clientes';
  end if;
end
$check$;
