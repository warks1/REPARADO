-- REPARADO V34 · consentimiento y precio de presupuestos protegidos en servidor.
-- Instalar después de V19, primero en REPARADO Test.
-- Un cliente debe aceptar el importe EXACTO que vio; una modificación
-- simultánea del administrador ya no puede ser aceptada sin advertencia.
do $preflight$
begin
  if to_regclass('public.service_requests') is null
     or to_regprocedure('public.accept_reparado_quote(uuid)') is null
     or not (select relrowsecurity from pg_class
             where oid='public.service_requests'::regclass)
  then raise exception 'REPARADO_V34_REQUIRES_QUOTE_RLS'; end if;
end $preflight$;

-- Comprobación independiente de la anterior protección de operarios:
-- el administrador tampoco puede atribuirse el consentimiento del cliente.
create or replace function public.reparado_guard_quote_consent_v34()
returns trigger
language plpgsql security definer set search_path=''
as $quote_guard$
begin
  if (select auth.role()) is null or (select auth.role())='service_role'
    then return new; end if;

  -- Ni siquiera el administrador puede alterar el precio YA aceptado.
  if old.status::text in ('accepted','scheduled','in_progress','completed')
      and new.price is distinct from old.price then
    raise exception using errcode='23514',
      message='REPARADO_ACCEPTED_QUOTE_PRICE_LOCKED';
  end if;

  -- Solo la RPC invocada por el dueño puede pasar quoted -> accepted.
  -- La política de administración no equivale a consentimiento del cliente.
  if new.status::text='accepted'
     and old.status::text is distinct from 'accepted'
     and (select public.is_reparado_admin()) then
    raise exception using errcode='23514',
      message='REPARADO_ACCEPTANCE_REQUIRES_CUSTOMER';
  end if;
  return new;
end;
$quote_guard$;

revoke all on function public.reparado_guard_quote_consent_v34()
  from public,anon,authenticated;
drop trigger if exists reparado_guard_quote_consent_v34
  on public.service_requests;
create trigger reparado_guard_quote_consent_v34
before update of price,status on public.service_requests
for each row execute function public.reparado_guard_quote_consent_v34();

-- Nuevo contrato: confirma un precio mostrado al cliente, nunca el último
-- precio guardado implícitamente. WHERE comprueba identidad, propietario,
-- estado, importe y evita carreras concurrentes gracias al bloqueo UPDATE.
create or replace function public.accept_reparado_quote(
  p_request_id uuid,p_expected_price numeric
)
returns boolean
language plpgsql security definer set search_path=''
as $quote_accept$
declare user_id uuid;
declare was_updated boolean;
begin
  user_id:=(select auth.uid());
  if user_id is null or (select auth.role())<>'authenticated'
      or p_expected_price is null or p_expected_price<0 then
    return false;
  end if;

  update public.service_requests
    set status='accepted'
  where id=p_request_id
    and customer_id=user_id
    and status='quoted'
    and price is not null
    and price=p_expected_price;
  was_updated:=found;
  return was_updated;
end;
$quote_accept$;

-- El endpoint heredado aceptaba sin comprobar el importe y sería una vía
-- alternativa para eludir la verificación. Debe quedar inaccesible.
revoke all on function public.accept_reparado_quote(uuid)
  from public,anon,authenticated;
revoke all on function public.accept_reparado_quote(uuid,numeric)
  from public,anon,authenticated;
grant execute on function public.accept_reparado_quote(uuid,numeric)
  to authenticated;

do $verify$
begin
  if has_function_privilege('anon','public.accept_reparado_quote(uuid)','EXECUTE')
    or has_function_privilege('anon','public.accept_reparado_quote(uuid,numeric)','EXECUTE')
    or has_function_privilege('authenticated','public.accept_reparado_quote(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.accept_reparado_quote(uuid,numeric)','EXECUTE')
    or has_function_privilege('authenticated','public.reparado_guard_quote_consent_v34()','EXECUTE')
  then raise exception 'REPARADO_V34_WRONG_RPC_PERMISSIONS'; end if;
  if (select count(*) from pg_trigger
      where tgrelid='public.service_requests'::regclass
        and tgname='reparado_guard_quote_consent_v34'
        and not tgisinternal)<>1
  then raise exception 'REPARADO_V34_MISSING_GUARD'; end if;
end $verify$;
