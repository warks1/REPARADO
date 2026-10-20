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
