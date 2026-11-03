-- REPARADO V65 · Limitar nuevas solicitudes al área de Cataluña.
-- Ejecutar primero en REPARADO Test después de V35.
-- Comprueba prefijos provinciales, NO existencia postal ni dirección exacta.
-- No altera registros ni permisos de clientes; la restricción se aplica a
-- toda INSERT o UPDATE, también si alguien intenta omitir la validación web.
do $preflight$
begin
  if to_regclass('public.service_requests') is null
     or not (select relrowsecurity from pg_class
       where oid='public.service_requests'::regclass)
  then
    raise exception 'REPARADO_V65_REQUIRES_REQUESTS_RLS';
  end if;
  if exists (
    select 1 from public.service_requests r
    where r.postal_code !~ '^(08|17|25|43)[0-9]{3}$'
      or char_length(btrim(r.city)) not between 2 and 90
      or (case lower(btrim(r.city))
         when 'barcelona' then left(r.postal_code,2)<>'08'
         when 'girona' then left(r.postal_code,2)<>'17'
         when 'gerona' then left(r.postal_code,2)<>'17'
         when 'lleida' then left(r.postal_code,2)<>'25'
         when 'lerida' then left(r.postal_code,2)<>'25'
         when 'lérida' then left(r.postal_code,2)<>'25'
         when 'tarragona' then left(r.postal_code,2)<>'43'
         else false end)
  ) then
    raise exception 'REPARADO_V65_REVIEW_EXISTING_ADDRESSES';
  end if;
end $preflight$;

do $install$
begin
  if not exists (
    select 1 from pg_constraint where conrelid='public.service_requests'::regclass
    and conname='reparado_catalonia_area_v65'
  ) then
    alter table public.service_requests
      add constraint reparado_catalonia_area_v65
      check (
        postal_code ~ '^(08|17|25|43)[0-9]{3}$'
        and char_length(btrim(city)) between 2 and 90
        and (case lower(btrim(city))
           when 'barcelona' then left(postal_code,2)='08'
           when 'girona' then left(postal_code,2)='17'
           when 'gerona' then left(postal_code,2)='17'
           when 'lleida' then left(postal_code,2)='25'
           when 'lerida' then left(postal_code,2)='25'
           when 'lérida' then left(postal_code,2)='25'
           when 'tarragona' then left(postal_code,2)='43'
           else true end)
      );
  end if;
end $install$;

do $verify$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.service_requests'::regclass
      and conname='reparado_catalonia_area_v65'
      and contype='c' and convalidated
  ) or not (select relrowsecurity from pg_class
            where oid='public.service_requests'::regclass)
  then raise exception 'REPARADO_V65_SERVICE_AREA_NOT_ENFORCED'; end if;
end $verify$;
