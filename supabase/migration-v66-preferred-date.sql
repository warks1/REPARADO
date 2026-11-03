-- REPARADO V66 · Validación de fecha preferida al crear solicitudes.
-- La interfaz ya comprueba la fecha en Europe/Madrid (V64), pero el servidor
-- también debe rechazar los envíos directos a la API con fechas pasadas.
-- SOLO BEFORE INSERT: una solicitud histórica válida no se bloquea al
-- actualizar su estado después de que su fecha preferida quede atrás.
-- No modifica las solicitudes existentes, RLS, presupuestos ni facturas.
do $preflight$
begin
  if to_regclass('public.service_requests') is null
     or not (select relrowsecurity from pg_class
             where oid='public.service_requests'::regclass)
     or not exists (
       select 1 from pg_constraint
       where conrelid='public.service_requests'::regclass
         and conname='reparado_catalonia_area_v65' and convalidated
     )
  then
    raise exception 'REPARADO_V66_REQUIRES_V65_AND_RLS';
  end if;
end $preflight$;

create or replace function public.reparado_guard_preferred_date_v66()
returns trigger
language plpgsql security invoker set search_path=''
as $guard$
begin
  if new.preferred_date is not null
     and new.preferred_date < (statement_timestamp() at time zone 'Europe/Madrid')::date
  then
    raise exception using errcode='23514',
      message='REPARADO_V66_PREFERRED_DATE_PAST';
  end if;
  return new;
end;
$guard$;

revoke all on function public.reparado_guard_preferred_date_v66()
  from public,anon,authenticated;

drop trigger if exists reparado_guard_preferred_date_v66
  on public.service_requests;
create trigger reparado_guard_preferred_date_v66
before insert on public.service_requests
for each row execute function public.reparado_guard_preferred_date_v66();

do $verify$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.service_requests'::regclass
      and tgname='reparado_guard_preferred_date_v66'
      and not tgisinternal and tgenabled<>'D'
  )
  or has_function_privilege('anon','public.reparado_guard_preferred_date_v66()','EXECUTE')
  or has_function_privilege('authenticated','public.reparado_guard_preferred_date_v66()','EXECUTE')
  or not (select relrowsecurity from pg_class
          where oid='public.service_requests'::regclass)
  then
    raise exception 'REPARADO_V66_DATE_GUARD_UNSAFE';
  end if;
end $verify$;
