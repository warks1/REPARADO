
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
