-- REPARADO V9 · integridad de registro y numeración de facturas.
-- Aplicar tras V8, PRIMERO en un Supabase de pruebas y tras revisar datos.
-- NO genera ni emite facturas oficiales, PDF o números automáticamente.
-- Política temporal para facturas con IVA único al 21 %.
-- Para otros tipos/recargos/exenciones, diseñar líneas e impuestos antes
-- de registrar documentos finales. No cambiar registros históricos a ciegas.

-- 1. Preflight: nunca normalizar o borrar una factura de forma automática.
do $reparado_invoice_preflight$
begin
  if exists (select 1 from public.invoices
    where status is null or status not in ('draft','issued','paid','cancelled')) then
    raise exception using errcode='23514',
      message='REPARADO_EXISTING_INVOICE_INVALID_STATUS',
      detail='Revisa los estados de las facturas existentes antes de aplicar V9.';
  end if;

  if exists (select 1 from public.invoices
    where status <> 'draft' and
      (number is null or btrim(number)=''
       or request_id is null or customer_id is null
       or subtotal is null or vat is null or total is null
       or subtotal<0 or vat<0 or total<0
       or abs(subtotal+vat-total)>0.01
       or abs(vat-round(subtotal*0.21,2))>0.01)) then
    raise exception using errcode='23514',
      message='REPARADO_EXISTING_INVOICE_INVALID_AMOUNT',
      detail='Revisa vinculación, base, IVA 21 %, total y número de documentos no borrador.';
  end if;

  if exists (select 1 from public.invoices i
      join public.service_requests r on r.id=i.request_id
      where i.status <> 'draft' and i.customer_id is distinct from r.customer_id) then
    raise exception using errcode='23514',
      message='REPARADO_EXISTING_INVOICE_WRONG_CUSTOMER',
      detail='Una factura registrada apunta al cliente de una solicitud diferente.';
  end if;

  if exists (
    select 1 from public.invoices i
    where i.status<>'draft'
    group by upper(btrim(i.number))
    having count(*)>1
  ) then
    raise exception using errcode='23505',
      message='REPARADO_EXISTING_INVOICE_DUPLICATE_NUMBER',
      detail='Resolver los números repetidos antes de crear el índice único.';
  end if;
end;
$reparado_invoice_preflight$;

-- 2. Número único (sin distinguir espacios periféricos o mayúsculas).
-- PostgreSQL garantiza esta unicidad también ante transacciones simultáneas.
create unique index if not exists reparado_invoice_final_number_unique_v9
on public.invoices (upper(btrim(number)))
where status <> 'draft';

-- 3. Garantías de estado, IVA 21 %, céntimos y coherencia con el cliente.
do $reparado_invoice_constraints$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.invoices'::regclass
    and conname='reparado_invoice_status_v9') then
    alter table public.invoices add constraint reparado_invoice_status_v9
      check (status in ('draft','issued','paid','cancelled'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.invoices'::regclass
    and conname='reparado_invoice_amounts_v9') then
    alter table public.invoices add constraint reparado_invoice_amounts_v9
      check (status='draft' or
        (btrim(number)<>'' and request_id is not null
         and customer_id is not null
         and subtotal>=0 and vat>=0 and total>=0
         and abs(subtotal+vat-total)<=0.01
         and abs(vat-round(subtotal*0.21,2))<=0.01));
  end if;
end;
$reparado_invoice_constraints$;

-- 4. La factura finalizada no se sobreescribe ni se borra. Una futura
-- rectificación fiscal requiere un circuito de documentos correctivos.
create or replace function public.reparado_guard_invoice_v9()
returns trigger language plpgsql
set search_path=pg_catalog,public,pg_temp
as $reparado_invoice_guard$
declare
  owner_id uuid;
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then
      raise exception using errcode='23514',
        message='REPARADO_INVOICE_FINAL_LOCKED',
        detail='Los documentos registrados no se eliminan: hay que gestionar rectificación.';
    end if;
    return old;
  end if;

  if tg_op='UPDATE' and old.status <> 'draft' then
    if to_jsonb(new) is distinct from to_jsonb(old) then
      raise exception using errcode='23514',
        message='REPARADO_INVOICE_FINAL_LOCKED',
        detail='La factura finalizada es inmutable. Usar el procedimiento de rectificación.';
    end if;
    return new;
  end if;

  if new.status not in ('draft','issued','paid','cancelled') then
    raise exception using errcode='23514',
      message='REPARADO_INVOICE_STATUS_INVALID';
  end if;

  if new.status <> 'draft' then
    if new.request_id is null or new.customer_id is null then
      raise exception using errcode='23514',
        message='REPARADO_INVOICE_REQUEST_REQUIRED';
    end if;
    select r.customer_id into owner_id from public.service_requests r
      where r.id=new.request_id;
    if owner_id is null or owner_id is distinct from new.customer_id then
      raise exception using errcode='23514',
        message='REPARADO_INVOICE_CUSTOMER_MISMATCH';
    end if;
  end if;
  return new;
end;
$reparado_invoice_guard$;

revoke all on function public.reparado_guard_invoice_v9() from public;
revoke all on function public.reparado_guard_invoice_v9() from anon,authenticated;
drop trigger if exists reparado_guard_invoice_v9 on public.invoices;
create trigger reparado_guard_invoice_v9
before insert or update or delete on public.invoices
for each row execute function public.reparado_guard_invoice_v9();

-- 5. Ninguna cuenta cliente u operario puede emitir/modificar facturas
-- directamente; debe hacerlo un backend de confianza con auditoría fiscal.
revoke insert,update,delete on public.invoices from anon,authenticated;
grant select on public.invoices to authenticated;
-- No alterar la política V6: cliente solo ve documentos no borrador propios;
-- administración puede consultar borradores, sin capacidad de emitirlos.

comment on function public.reparado_guard_invoice_v9() is
'V9: coherencia cliente-solicitud e inmutabilidad de factura final. No sustituye emisión fiscal ni rectificaciones.';
