-- REPARADO / SUPABASE
create extension if not exists pgcrypto;

create type public.user_role as enum ('customer','admin','operator');
create type public.request_status as enum ('new','quoted','accepted','scheduled','in_progress','completed','cancelled');

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

create policy "profile own read" on public.profiles for select using (auth.uid()=id or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','operator')));
create policy "profile own update" on public.profiles for update using (auth.uid()=id);
create policy "request customer read" on public.service_requests for select using (customer_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','operator')));
create policy "request customer create" on public.service_requests for insert with check (customer_id=auth.uid());
create policy "request staff update" on public.service_requests for update using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','operator')));
create policy "message participants" on public.messages for select using (customer_id=auth.uid() or sender_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','operator')));
create policy "message own insert" on public.messages for insert with check (sender_id=auth.uid());
create policy "notifications own" on public.notifications for all using (user_id=auth.uid());
create policy "tokens own" on public.device_tokens for all using (user_id=auth.uid());
create policy "invoice customer/staff" on public.invoices for select using (customer_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','operator')));

-- Para producción: activar Storage y crear bucket privado `request-photos`.
-- Crear políticas de Storage para que el cliente solo pueda subir/leer sus propias fotos.
-- Push real: usar una Edge Function para enviar tokens APNs/FCM cuando se inserta una notificación.
