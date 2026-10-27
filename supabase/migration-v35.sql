-- REPARADO V35 · constancia de aceptación de presupuesto en la solicitud.
-- Instalar DESPUÉS de V34. No supone firma electrónica ni factura fiscal.
-- Los expedientes aceptados antes de esta versión conservan fecha NULL:
-- no se inventa ni reconstruye una fecha histórica.
do $preflight$
begin
  if to_regprocedure('public.accept_reparado_quote(uuid,numeric)') is null
     or to_regprocedure('public.reparado_guard_quote_consent_v34()') is null
     or not (select relrowsecurity from pg_class where oid='public.service_requests'::regclass)
  then raise exception 'REPARADO_V35_REQUIRES_V34_AND_RLS'; end if;
end $preflight$;

alter table public.service_requests
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_price numeric(10,2);

-- Ningún cliente, operario ni administrador de la aplicación puede escribir
-- directamente la instantánea del consentimiento. Solo el trigger la establece.
revoke update (accepted_at,accepted_price)
  on public.service_requests from public,anon,authenticated;

create or replace function public.reparado_record_quote_snapshot_v35()
returns trigger
language plpgsql security invoker set search_path=''
as $quote_snapshot$
begin
  if old.status::text='quoted' and new.status::text='accepted' then
    if new.price is null then
      raise exception using errcode='23514',message='REPARADO_V35_QUOTE_PRICE_REQUIRED';
    end if;
    -- Incluso si un cliente envía columnas arbitrarias, el servidor
    -- sobrescribe el instante e importe en la transacción de aceptación.
    new.accepted_at:=clock_timestamp();
    new.accepted_price:=new.price;
  elsif new.accepted_at is distinct from old.accepted_at
     or new.accepted_price is distinct from old.accepted_price then
    raise exception using errcode='23514',
      message='REPARADO_V35_ACCEPTANCE_RECORD_IMMUTABLE';
  end if;
  return new;
end;
$quote_snapshot$;

revoke all on function public.reparado_record_quote_snapshot_v35()
  from public,anon,authenticated;
drop trigger if exists reparado_record_quote_snapshot_v35
  on public.service_requests;
create trigger reparado_record_quote_snapshot_v35
before update of status,price,accepted_at,accepted_price
on public.service_requests
for each row execute function public.reparado_record_quote_snapshot_v35();

do $verify$
begin
  if has_column_privilege('authenticated','public.service_requests','accepted_at','UPDATE')
    or has_column_privilege('authenticated','public.service_requests','accepted_price','UPDATE')
    or has_function_privilege('anon','public.reparado_record_quote_snapshot_v35()','EXECUTE')
    or has_function_privilege('authenticated','public.reparado_record_quote_snapshot_v35()','EXECUTE')
    or (select count(*) from pg_trigger
        where tgrelid='public.service_requests'::regclass
        and tgname='reparado_record_quote_snapshot_v35' and not tgisinternal)<>1
  then raise exception 'REPARADO_V35_ACCEPTANCE_RECORD_UNSAFE'; end if;
end $verify$;
