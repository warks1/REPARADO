-- REPARADO · Incidencias reportadas por clientes y cola privada de avisos.
-- Instalar DESPUÉS de V19. No hay usuarios, mensajes ni reseñas ficticias.
create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 5 and 140),
  description text not null check (char_length(btrim(description)) between 12 and 2000),
  context text not null default 'general'
    check (context in ('general','solicitud','agenda','chat','facturacion','cuenta')),
  status text not null default 'open' check (status in ('open','reviewing','resolved')),
  created_at timestamptz not null default now()
);
create index if not exists reparado_support_reports_owner_time
  on public.support_reports (user_id, created_at desc);
create index if not exists reparado_support_reports_status
  on public.support_reports (status, created_at);
alter table public.support_reports enable row level security;
revoke all on public.support_reports from public,anon,authenticated;
grant select(id,subject,description,context,status,created_at) on public.support_reports to authenticated;
grant insert(user_id,subject,description,context) on public.support_reports to authenticated;
grant update(status) on public.support_reports to authenticated;
drop policy if exists "support own or admin read" on public.support_reports;
create policy "support own or admin read" on public.support_reports
  for select to authenticated
  using (user_id=(select auth.uid()) or (select public.is_reparado_admin()));
drop policy if exists "support own create" on public.support_reports;
create policy "support own create" on public.support_reports
  for insert to authenticated
  with check (user_id=(select auth.uid()) and status='open');
drop policy if exists "support admin moderate" on public.support_reports;
create policy "support admin moderate" on public.support_reports
  for update to authenticated
  using ((select public.is_reparado_admin()))
  with check ((select public.is_reparado_admin()) and status in ('open','reviewing','resolved'));

-- Límite de uso para evitar abusos que saturen el equipo y el email.
-- Se valida en el servidor, no mediante temporizadores de la interfaz.
create or replace function public.reparado_limit_support_reports()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $
begin
  if (select count(*) from public.support_reports s
        where s.user_id=new.user_id and s.created_at>=now()-interval '1 hour')>=3
    or (select count(*) from public.support_reports s
        where s.user_id=new.user_id and s.created_at>=now()-interval '1 day')>=10
  then raise exception 'REPARADO_SUPPORT_RATE_LIMIT'; end if;
  return new;
end;
$;
revoke all on function public.reparado_limit_support_reports()
  from public,anon,authenticated;
drop trigger if exists reparado_support_rate_limit on public.support_reports;
create trigger reparado_support_rate_limit before insert on public.support_reports
for each row execute function public.reparado_limit_support_reports();

-- La cola no puede ser consultada o manipulada desde la app cliente.
create table if not exists public.support_email_outbox (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.support_reports(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','sending','sent','failed')),
  attempts int not null default 0 check (attempts between 0 and 6),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists reparado_support_email_pending
  on public.support_email_outbox (state,next_attempt_at,created_at);
alter table public.support_email_outbox enable row level security;
revoke all on public.support_email_outbox from public,anon,authenticated;
grant select,insert,update on public.support_email_outbox to service_role;

-- Evitar duplicados y que el cliente elija las fechas o el estado.
create or replace function public.reparado_enqueue_support_report()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $$
begin
  insert into public.support_email_outbox(report_id)
  values (new.id) on conflict (report_id) do nothing;
  return new;
end;
$$;
revoke all on function public.reparado_enqueue_support_report()
  from public,anon,authenticated;
drop trigger if exists reparado_support_created on public.support_reports;
create trigger reparado_support_created after insert on public.support_reports
for each row execute function public.reparado_enqueue_support_report();

create or replace function public.reparado_claim_support_email()
returns table(outbox_id uuid, report_id uuid, try_number integer)
language sql security definer
set search_path=pg_catalog,public
as $$
  update public.support_email_outbox as q
     set state='sending', attempts=q.attempts+1, claimed_at=now()
  where q.id=(
    select o.id from public.support_email_outbox as o
    where o.attempts < 5
      and ((o.state='pending' and o.next_attempt_at<=now())
      or (o.state='sending' and o.claimed_at<now()-interval '15 minutes'))
    order by o.created_at for update skip locked limit 1
  )
  returning q.id,q.report_id,q.attempts;
$$;
revoke all on function public.reparado_claim_support_email()
  from public,anon,authenticated;
grant execute on function public.reparado_claim_support_email() to service_role;

do $verify$
begin
  if has_table_privilege('anon','public.support_reports','SELECT')
    or has_table_privilege('authenticated','public.support_reports','DELETE')
    or has_table_privilege('authenticated','public.support_reports','TRUNCATE')
    or has_column_privilege('authenticated','public.support_reports','user_id','UPDATE')
    or has_column_privilege('authenticated','public.support_reports','description','UPDATE')
    or has_table_privilege('authenticated','public.support_email_outbox','SELECT')
    or has_table_privilege('anon','public.support_email_outbox','INSERT')
    or has_function_privilege('authenticated','public.reparado_claim_support_email()','EXECUTE')
  then raise exception 'REPARADO_SUPPORT_PERMISSIONS_INVALID'; end if;
end $verify$;
