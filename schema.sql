-- REPARADO / SUPABASE
create extension if not exists pgcrypto;

do $body$ begin
  create type public.user_role as enum ('customer','admin','operator');
exception when duplicate_object then null;
end $body$;
do $body$ begin
  create type public.request_status as enum ('new','quoted','accepted','scheduled','in_progress','completed','cancelled');
exception when duplicate_object then null;
end $body$;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text,
 phone text,
 role public.user_role not null default 'customer',
 created_at timestamptz not null default now()
);

create table if not exists public.service_requests (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(id) on delete cascade,
 service_name text not null,
 category text not null,
 price numeric(10,2),
 street text not null,
 address_number text not null,
 postal_code text not null,
 city text not null,
 phone text not null,
 preferred_date date,
 scheduled_at timestamptz,
 description text,
 status public.request_status not null default 'new',
 operator_id uuid references public.profiles(id),
 operator_name text,
 created_at timestamptz not null default now()
);

create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null,
 created_at timestamptz not null default now()
);

create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,
 body text not null,
 read boolean not null default false,
 created_at timestamptz not null default now()
);

create table if not exists public.device_tokens (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 token text not null unique,
 platform text not null,
 created_at timestamptz not null default now()
);

create table if not exists public.invoices (
 id uuid primary key default gen_random_uuid(),
 request_id uuid references public.service_requests(id),
 customer_id uuid references public.profiles(id),
 number text not null,
 subtotal numeric(10,2) not null default 0,
 vat numeric(10,2) not null default 0,
 total numeric(10,2) not null default 0,
 status text not null default 'draft',
 pdf_path text,
 created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.service_requests enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.device_tokens enable row level security;
alter table public.invoices enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,full_name,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''), 'customer');
 return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- SECURITY: role checks run through a restricted SECURITY DEFINER function
-- instead of querying profiles from its own RLS policy (which causes recursion).
create or replace function public.is_reparado_staff()
returns boolean language sql stable security definer set search_path=public
as $$ select exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','operator')) $$;
revoke all on function public.is_reparado_staff() from public;
grant execute on function public.is_reparado_staff() to authenticated;
-- Prevent a user from escalating their own role via profile update.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

drop policy if exists "profile own read" on public.profiles;
drop policy if exists "profile own update" on public.profiles;
drop policy if exists "request customer read" on public.service_requests;
drop policy if exists "request customer create" on public.service_requests;
drop policy if exists "request staff update" on public.service_requests;
drop policy if exists "message participants" on public.messages;
drop policy if exists "message own insert" on public.messages;
drop policy if exists "notifications own" on public.notifications;
drop policy if exists "tokens own" on public.device_tokens;
drop policy if exists "invoice customer/staff" on public.invoices;

create policy "profile own read" on public.profiles for select using (auth.uid()=id or public.is_reparado_staff());
create policy "profile own update" on public.profiles for update using (auth.uid()=id);
create policy "request customer read" on public.service_requests for select using (customer_id=auth.uid() or public.is_reparado_staff());
create policy "request customer create" on public.service_requests for insert with check (customer_id=auth.uid() and status='new' and operator_id is null and operator_name is null and scheduled_at is null);
create policy "request staff update" on public.service_requests for update using (public.is_reparado_staff());
create policy "message participants" on public.messages for select using (customer_id=auth.uid() or sender_id=auth.uid() or public.is_reparado_staff());
create policy "message own insert" on public.messages for insert with check (sender_id=auth.uid() and (customer_id=auth.uid() or public.is_reparado_staff()));
create policy "notifications own" on public.notifications for all using (user_id=auth.uid());
create policy "tokens own" on public.device_tokens for all using (user_id=auth.uid());
create policy "invoice customer/staff" on public.invoices for select using (customer_id=auth.uid() or public.is_reparado_staff());

-- El cliente únicamente puede crear solicitudes con datos de contacto y servicio.
-- El precio y la planificación son campos reservados al personal autorizado.
-- Mantener esta lista sincronizada con los campos enviados en connected.js.
revoke insert, update on public.service_requests from anon, authenticated;
grant insert (customer_id, service_name, category, street, address_number, postal_code, city, phone, preferred_date, description)
  on public.service_requests to authenticated;
grant update (status, price, operator_id, operator_name, scheduled_at)
  on public.service_requests to authenticated;

-- Para producción: activar Storage y crear bucket privado `request-photos`.
-- Crear políticas de Storage para que el cliente solo pueda subir/leer sus propias fotos.
-- Push real: usar una Edge Function para enviar tokens APNs/FCM cuando se inserta una notificación.


-- REPARADO / seguridad, aceptación de presupuestos y avisos (v4)
-- Idempotente. Ejecutar con privilegios de administración en Supabase SQL Editor.
-- V4 re-applies baseline privileges when upgrading from older beta schemas.
revoke update on public.profiles from anon, authenticated;
grant update (full_name,phone) on public.profiles to authenticated;
revoke insert, update on public.service_requests from anon, authenticated;
grant insert (customer_id,service_name,category,street,address_number,postal_code,city,phone,preferred_date,description)
  on public.service_requests to authenticated;
grant update (status,price,operator_id,operator_name,scheduled_at)
  on public.service_requests to authenticated;
drop policy if exists "request customer create" on public.service_requests;
create policy "request customer create" on public.service_requests for insert to authenticated
with check (customer_id=auth.uid() and status='new' and price is null
  and operator_id is null and operator_name is null and scheduled_at is null);

create or replace function public.is_reparado_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') $$;
revoke all on function public.is_reparado_admin() from public;
grant execute on function public.is_reparado_admin() to authenticated;

drop policy if exists "profile own read" on public.profiles;
create policy "profile own read" on public.profiles for select to authenticated
using (id=auth.uid() or public.is_reparado_admin());

drop policy if exists "request customer read" on public.service_requests;
create policy "request customer read" on public.service_requests for select to authenticated
using (
  customer_id=auth.uid() or public.is_reparado_admin()
  or (operator_id=auth.uid() and public.is_reparado_staff())
);
drop policy if exists "request staff update" on public.service_requests;
create policy "request staff update" on public.service_requests for update to authenticated
using (public.is_reparado_admin() or (operator_id=auth.uid() and public.is_reparado_staff()))
with check (public.is_reparado_admin() or (operator_id=auth.uid() and public.is_reparado_staff()));

drop policy if exists "message participants" on public.messages;
create policy "message participants" on public.messages for select to authenticated
using (customer_id=auth.uid() or public.is_reparado_admin()
 or (public.is_reparado_staff() and exists (
   select 1 from public.service_requests r
   where r.customer_id=messages.customer_id and r.operator_id=auth.uid()
 )));
drop policy if exists "message own insert" on public.messages;
create policy "message own insert" on public.messages for insert to authenticated
with check (sender_id=auth.uid() and
 (customer_id=auth.uid() or public.is_reparado_admin()
 or (public.is_reparado_staff() and exists (
    select 1 from public.service_requests r
    where r.customer_id=messages.customer_id and r.operator_id=auth.uid()
 ))));

-- La parte pública de la app no puede fabricar avisos o borrarlos.
drop policy if exists "notifications own" on public.notifications;
drop policy if exists "notifications read own" on public.notifications;
drop policy if exists "notifications mark own" on public.notifications;
create policy "notifications read own" on public.notifications for select to authenticated
using (user_id=auth.uid());
create policy "notifications mark own" on public.notifications for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

create or replace function public.reparado_guard_request_update()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- Service role and privileged SQL migrations are not constrained by the web workflow.
  if auth.role() is null or auth.role()='service_role' then return new; end if;
  if public.is_reparado_admin() then
    if new.status='quoted' and new.price is null then
      raise exception 'A quote must have a confirmed price';
    end if;
    return new;
  end if;
  -- A customer may only accept their own quote through the protected RPC.
  if old.customer_id=auth.uid() and old.status='quoted' and new.status='accepted'
     and old.price is not null
     and (to_jsonb(new)-'status') = (to_jsonb(old)-'status') then
    return new;
  end if;
  if old.operator_id is distinct from auth.uid() or not public.is_reparado_staff() then
    raise exception 'Only assigned operators can update this request';
  end if;
  if new.operator_id is distinct from old.operator_id
     or new.operator_name is distinct from old.operator_name
     or new.price is distinct from old.price
     or new.scheduled_at is distinct from old.scheduled_at
     or (to_jsonb(new)-'status') <> (to_jsonb(old)-'status') then
    raise exception 'Operators may only change status';
  end if;
  if new.status is distinct from old.status and not
    ((old.status='scheduled' and new.status='in_progress')
     or (old.status='in_progress' and new.status='completed')) then
    raise exception 'Invalid operator status transition';
  end if;
  return new;
end; $$;
drop trigger if exists reparado_guard_request_update on public.service_requests;
create trigger reparado_guard_request_update before update on public.service_requests
for each row execute function public.reparado_guard_request_update();

create or replace function public.accept_reparado_quote(p_request_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare changed boolean;
begin
  if auth.uid() is null then return false; end if;
  update public.service_requests
    set status='accepted'
    where id=p_request_id and customer_id=auth.uid()
      and status='quoted' and price is not null;
  changed:=found;
  return changed;
end; $$;
revoke all on function public.accept_reparado_quote(uuid) from public;
grant execute on function public.accept_reparado_quote(uuid) to authenticated;

create or replace function public.reparado_notify_request_update()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status is distinct from old.status or new.scheduled_at is distinct from old.scheduled_at then
    insert into public.notifications(user_id,title,body)
    values (new.customer_id,
      case
        when new.status='quoted' then 'Presupuesto disponible'
        when new.status='scheduled' then 'Visita programada'
        when new.status='accepted' then 'Presupuesto aceptado'
        when new.status='completed' then 'Trabajo finalizado'
        else 'Solicitud actualizada'
      end,
      'El estado de tu solicitud de ' || new.service_name || ' ha cambiado a ' || new.status || '.');
  end if;
  return new;
end; $$;
drop trigger if exists reparado_notify_request_update on public.service_requests;
create trigger reparado_notify_request_update after update on public.service_requests
for each row execute function public.reparado_notify_request_update();

create or replace function public.reparado_notify_staff_message()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.sender_id<>new.customer_id then
    insert into public.notifications(user_id,title,body)
      values(new.customer_id,'Nuevo mensaje','Tienes un nuevo mensaje del equipo de Reparado.');
  end if;
  return new;
end; $$;
drop trigger if exists reparado_notify_staff_message on public.messages;
create trigger reparado_notify_staff_message after insert on public.messages
for each row execute function public.reparado_notify_staff_message();

-- Reparado V5: avisos internos para recepción de trabajos y conversaciones.
create or replace function public.reparado_notify_new_request()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id,title,body)
  select p.id,'Nueva solicitud','Nueva solicitud de ' || new.service_name || ' pendiente de revisión.'
  from public.profiles p where p.role='admin';
  return new;
end; $$;
drop trigger if exists reparado_notify_new_request on public.service_requests;
create trigger reparado_notify_new_request after insert on public.service_requests
for each row execute function public.reparado_notify_new_request();

create or replace function public.reparado_notify_staff_message()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.sender_id=new.customer_id then
    insert into public.notifications(user_id,title,body)
    select p.id,'Mensaje del cliente','Un cliente ha enviado un mensaje al equipo.'
    from public.profiles p
    where p.id<>new.sender_id and (p.role='admin'
      or (p.role='operator' and exists (
        select 1 from public.service_requests r
        where r.customer_id=new.customer_id and r.operator_id=p.id
          and r.status in ('new','quoted','accepted','scheduled','in_progress')
      )));
  else
    insert into public.notifications(user_id,title,body)
      values(new.customer_id,'Nuevo mensaje','Tienes un nuevo mensaje del equipo de Reparado.');
  end if;
  return new;
end; $$;

create or replace function public.reparado_notify_quote_accepted()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status='quoted' and new.status='accepted' then
    insert into public.notifications(user_id,title,body)
    select p.id,'Presupuesto aceptado','Un cliente ha aceptado el presupuesto de ' || new.service_name || '.'
    from public.profiles p where p.role='admin';
  end if;
  return new;
end; $$;
drop trigger if exists reparado_notify_quote_accepted on public.service_requests;
create trigger reparado_notify_quote_accepted after update on public.service_requests
for each row execute function public.reparado_notify_quote_accepted();
