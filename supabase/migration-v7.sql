-- REPARADO V7 · agenda de operarios protegida frente a escrituras concurrentes.
-- APLICACIÓN: tras schema.sql y migraciones v4-v6, en base de PRUEBAS.
-- Instalación transaccional recomendada. No ejecutarlo en producción sin
-- revisar las citas existentes: el control previo aborta si hay conflictos.
-- 60 minutos = separación MÍNIMA entre horas de inicio, no duración del servicio.

-- 1) No introducir la garantía si ya hay registros activos incompatibles.
do $$
begin
  if exists (
    select 1 from public.service_requests r
    where r.status in ('scheduled','in_progress')
      and (r.operator_id is null or r.scheduled_at is null)
  ) then
    raise exception using errcode='23514',
      message='REPARADO_EXISTING_UNASSIGNED_VISITS',
      detail='Resolver antes las visitas programadas sin operario o fecha.';
  end if;

  if exists (
    select 1 from public.service_requests r
    join public.profiles p on p.id=r.operator_id
    where r.status in ('scheduled','in_progress')
      and p.role::text <> 'operator'
  ) then
    raise exception using errcode='23514',
      message='REPARADO_EXISTING_INVALID_OPERATOR',
      detail='Una visita activa está asignada a un perfil no operario.';
  end if;

  if exists (
    select 1 from public.service_requests first_visit
    join public.service_requests second_visit
      on first_visit.operator_id=second_visit.operator_id
     and first_visit.id<second_visit.id
     and first_visit.status in ('scheduled','in_progress')
     and second_visit.status in ('scheduled','in_progress')
     and first_visit.scheduled_at is not null
     and second_visit.scheduled_at is not null
     and second_visit.scheduled_at > first_visit.scheduled_at - interval '60 minutes'
     and second_visit.scheduled_at < first_visit.scheduled_at + interval '60 minutes'
  ) then
    raise exception using errcode='23P01',
      message='REPARADO_EXISTING_SCHEDULE_CONFLICT',
      detail='Resolver las visitas incompatibles antes de aplicar esta migración.';
  end if;
end;
$$;

-- 2) Optimiza el acceso a visitas activas por operario y fecha.
create index if not exists reparado_active_operator_schedule_idx
on public.service_requests(operator_id,scheduled_at)
where status in ('scheduled','in_progress');

-- 3) Bloqueo por operario durante TODA la transacción.
-- Bajo READ COMMITTED, la consulta realizada después de obtener el bloqueo
-- ve los cambios ya confirmados por otra transacción de ese operario.
-- SECURITY DEFINER permite inspeccionar también las visitas que RLS
-- ocultaría al usuario; nunca concede esos registros al cliente.
create or replace function public.reparado_guard_operator_schedule_v7()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, pg_temp
as $reparado_schedule$
declare
  v_profile_role text;
begin
  if new.status::text not in ('scheduled','in_progress') then
    return new;
  end if;

  if new.operator_id is null or new.scheduled_at is null then
    raise exception using errcode='23514',
      message='REPARADO_SCHEDULE_OPERATOR_REQUIRED',
      detail='Las visitas programadas o en curso necesitan operario y fecha.';
  end if;

  select p.role::text into v_profile_role
  from public.profiles p where p.id=new.operator_id;
  if v_profile_role is distinct from 'operator' then
    raise exception using errcode='23514',
      message='REPARADO_SCHEDULE_INVALID_OPERATOR',
      detail='La visita debe asignarse a un perfil con rol operario.';
  end if;

  -- Hash de UUID a bigint: una posible colisión únicamente serializa de
  -- más dos operarios, sin permitir dobles reservas.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.operator_id::text, 719623)
  );

  if exists (
    select 1 from public.service_requests r
    where r.operator_id=new.operator_id
      and r.id is distinct from new.id
      and r.status in ('scheduled','in_progress')
      and r.scheduled_at is not null
      and r.scheduled_at > new.scheduled_at - interval '60 minutes'
      and r.scheduled_at < new.scheduled_at + interval '60 minutes'
  ) then
    raise exception using errcode='23P01',
      message='REPARADO_SCHEDULE_CONFLICT',
      detail='El operario tiene otra visita con menos de 60 minutos entre inicios.';
  end if;

  return new;
end;
$reparado_schedule$;

-- Nunca permitir ejecución directa del disparador desde una cuenta web.
revoke all on function public.reparado_guard_operator_schedule_v7() from public;
revoke all on function public.reparado_guard_operator_schedule_v7() from anon, authenticated;

drop trigger if exists reparado_guard_operator_schedule_v7 on public.service_requests;
create trigger reparado_guard_operator_schedule_v7
before insert or update of status,operator_id,scheduled_at
on public.service_requests
for each row execute function public.reparado_guard_operator_schedule_v7();

comment on function public.reparado_guard_operator_schedule_v7() is
'V7: separación mínima de 60 minutos entre inicios de visitas del mismo operario, comprobada con bloqueo transaccional; no calcula duración ni trayectos.';
