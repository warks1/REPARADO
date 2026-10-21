-- REPARADO V8 · Avisos internos de asignación, cambio y cancelación de visita.
-- APLICACIÓN: tras schema.sql y migraciones v4-v7, primero en Supabase de pruebas.
-- No envía push: escribe avisos en public.notifications bajo los permisos/RLS
-- ya existentes. No expone dirección, teléfono ni datos privados del cliente.
--
-- Cuando el trabajo está accepted, scheduled o in_progress:
--   * un operario nuevo recibe una notificación al asignarlo;
--   * una visita programada nueva o reprogramada recibe otro aviso;
--   * el inicio del trabajo genera un aviso de cambio de estado;
--   * el operario anterior es avisado si deja de estar asignado.
--   * al cancelar una visita el operario previamente asignado recibe aviso.
-- Al cambiar solo precio u otros campos, NO se generan duplicados.

create or replace function public.reparado_notify_operator_assignment_v8()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,pg_temp
as $reparado_notify_operator$
declare
  v_new_operator boolean;
  v_previous_operator boolean;
  v_changed_operator boolean;
  v_visit_changed boolean;
  v_title text;
  v_message text;
  v_visit_text text;
begin
  v_changed_operator:=new.operator_id is distinct from old.operator_id;
  v_new_operator:=new.operator_id is not null and exists (
    select 1 from public.profiles p
    where p.id=new.operator_id and p.role::text='operator'
  );
  v_previous_operator:=old.operator_id is not null and exists (
    select 1 from public.profiles p
    where p.id=old.operator_id and p.role::text='operator'
  );

  -- Si se retira o cambia una asignación, informar al operario anterior
  -- únicamente cuando tenía un trabajo aún no finalizado/cancelado.
  if v_changed_operator and v_previous_operator
     and old.status::text in ('accepted','scheduled','in_progress') then
    insert into public.notifications(user_id,title,body)
    values(
      old.operator_id,'Asignación retirada',
      'Ya no tienes asignada la solicitud de ' || old.service_name || '.'
    );
  end if;

  -- Cancelación sin retirar la asignación (evitar doble aviso).
  if not v_changed_operator and v_previous_operator
     and old.status::text in ('accepted','scheduled','in_progress')
     and new.status::text='cancelled' then
    insert into public.notifications(user_id,title,body)
    values(
      old.operator_id,'Visita cancelada',
      'Se ha cancelado la solicitud de ' || old.service_name || '.'
    );
  end if;

  -- Solo notificar trabajo activo/aceptado al operario actualmente asignado.
  if not v_new_operator or
     new.status::text not in ('accepted','scheduled','in_progress') then
    return new;
  end if;

  v_visit_changed:=new.scheduled_at is distinct from old.scheduled_at;
  v_visit_text:=case
    when new.scheduled_at is not null then
       to_char(new.scheduled_at at time zone 'Europe/Madrid','DD/MM/YYYY "a las" HH24:MI')
    else null
  end;

  if v_changed_operator then
    v_title:='Nuevo trabajo asignado';
    v_message:='Te han asignado el trabajo de ' || new.service_name || '.';
    if new.status::text in ('scheduled','in_progress') and v_visit_text is not null then
      v_message:=v_message || ' Visita prevista el ' || v_visit_text || '.';
    end if;
  elsif new.status::text='scheduled' and
        (old.status::text is distinct from 'scheduled' or v_visit_changed) then
    if old.status::text='scheduled' and v_visit_changed then
      v_title:='Visita reprogramada';
    else
      v_title:='Visita programada';
    end if;
    v_message:='Trabajo de ' || new.service_name || ', visita el ' || v_visit_text || '.';
  elsif new.status::text='in_progress' and old.status::text is distinct from 'in_progress' then
    v_title:='Trabajo en curso';
    v_message:='La solicitud de ' || new.service_name || ' figura como trabajo en curso.';
  elsif new.status::text='in_progress' and v_visit_changed then
    v_title:='Visita actualizada';
    v_message:='Se ha cambiado la fecha del trabajo de ' || new.service_name
       || ' al ' || v_visit_text || '.';
  else
    return new;
  end if;

  insert into public.notifications(user_id,title,body)
  values(new.operator_id,v_title,v_message);

  return new;
end;
$reparado_notify_operator$;

revoke all on function public.reparado_notify_operator_assignment_v8() from public;
revoke all on function public.reparado_notify_operator_assignment_v8() from anon,authenticated;

drop trigger if exists reparado_notify_operator_assignment_v8 on public.service_requests;
create trigger reparado_notify_operator_assignment_v8
after update of operator_id,status,scheduled_at
on public.service_requests
for each row execute function public.reparado_notify_operator_assignment_v8();

comment on function public.reparado_notify_operator_assignment_v8() is
'V8: avisos internos al operario asignado o desasignado, para programación, reprogramación y cancelación. No envía push.';
