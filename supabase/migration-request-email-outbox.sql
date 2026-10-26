-- REPARADO · Cola interna para avisar de nuevas solicitudes por correo.
-- El email del destinatario está SOLO en el worker. Esta tabla no expone datos
-- ni permite que clientes/operarios lean estados o provoquen reenvíos.
create table if not exists public.request_email_outbox (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','sending','sent','failed')),
  attempts integer not null default 0 check (attempts between 0 and 6),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists reparado_email_queue_pending_idx
  on public.request_email_outbox(state,next_attempt_at,created_at);
alter table public.request_email_outbox enable row level security;
revoke all on table public.request_email_outbox from public,anon,authenticated;
grant select,insert,update on table public.request_email_outbox to service_role;

create or replace function public.reparado_enqueue_request_email()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  insert into public.request_email_outbox(request_id)
    values(new.id) on conflict (request_id) do nothing;
  return new;
end;
$$;
revoke all on function public.reparado_enqueue_request_email()
  from public,anon,authenticated;

drop trigger if exists reparado_enqueue_email_after_request on public.service_requests;
create trigger reparado_enqueue_email_after_request
  after insert on public.service_requests for each row
  execute function public.reparado_enqueue_request_email();

-- Worker exclusivamente con la credencial service_role, nunca un cliente.
-- Se reclama un registro de manera atómica para evitar duplicados concurrentes.
create or replace function public.reparado_claim_request_email()
returns table(outbox_id uuid,job_id uuid,try_number integer)
language sql security definer
set search_path=pg_catalog,public
as $$
  update public.request_email_outbox as q
    set state='sending',attempts=q.attempts+1,claimed_at=now()
  where q.id=(
    select o.id from public.request_email_outbox as o
    where o.attempts<5
      and ((o.state='pending' and o.next_attempt_at<=now())
        or (o.state='sending' and o.claimed_at<now()-interval '15 minutes'))
    order by o.created_at
    for update skip locked
    limit 1
  )
  returning q.id,q.request_id,q.attempts;
$$;
revoke all on function public.reparado_claim_request_email()
  from public,anon,authenticated;
grant execute on function public.reparado_claim_request_email() to service_role;

-- Comprobaciones de permisos: no se otorgan operaciones a los clientes.
do $verify$
begin
 if has_table_privilege('authenticated','public.request_email_outbox','SELECT')
   or has_table_privilege('authenticated','public.request_email_outbox','INSERT')
   or has_table_privilege('anon','public.request_email_outbox','SELECT')
   or has_function_privilege('authenticated','public.reparado_claim_request_email()','EXECUTE')
   or has_function_privilege('anon','public.reparado_claim_request_email()','EXECUTE')
 then raise exception 'REPARADO_EMAIL_OUTBOX_UNSAFE_PERMISSIONS';end if;
end
$verify$;
