-- REPARADO V60 · Borradores privados de facturación: NO emite facturas.
-- DESPUÉS de V19 y V34. Ejecutar primero en REPARADO Test.
-- Los borradores contienen datos fiscales personales: nunca exponerlos a anon,
-- clientes ni operarios; la escritura pasa exclusivamente por RPC validada.
do $preflight$
begin
 if to_regclass('public.service_requests') is null
    or to_regclass('public.invoices') is null
    or to_regprocedure('public.is_reparado_admin()') is null
 then raise exception 'REPARADO_V60_REQUIRES_BASE_SCHEMA'; end if;
end $preflight$;

create table if not exists public.invoice_drafts (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.service_requests(id),
 customer_id uuid not null references public.profiles(id),
 issuer_name text not null check (char_length(btrim(issuer_name)) between 1 and 160),
 issuer_nif text not null check (issuer_nif ~ '^[A-Z0-9-]{5,24}$'),
 issuer_address text not null check (char_length(btrim(issuer_address)) between 1 and 240),
 recipient_name text not null check (char_length(btrim(recipient_name)) between 1 and 160),
 recipient_nif text not null check (recipient_nif ~ '^[A-Z0-9-]{5,24}$'),
 recipient_address text not null check (char_length(btrim(recipient_address)) between 1 and 240),
 description text not null check (char_length(btrim(description)) between 1 and 240),
 operation_date date,
 base numeric(10,2) not null check(base>=0),
 vat numeric(10,2) not null check(vat>=0),
 total numeric(10,2) not null check(total>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint reparado_invoice_draft_v60_amounts
   check (abs(base+vat-total)<=0.01 and abs(vat-round(base*0.21,2))<=0.01)
);
create index if not exists reparado_invoice_draft_customer_v60
  on public.invoice_drafts(customer_id);
alter table public.invoice_drafts enable row level security;
revoke all on public.invoice_drafts from public,anon,authenticated;
grant select on public.invoice_drafts to authenticated;
drop policy if exists "invoice drafts admin read v60" on public.invoice_drafts;
create policy "invoice drafts admin read v60"
  on public.invoice_drafts for select to authenticated
  using ((select public.is_reparado_admin()));

create or replace function public.reparado_save_invoice_draft(
 p_request_id uuid,p_expected_total numeric,
 p_issuer_name text,p_issuer_nif text,p_issuer_address text,
 p_recipient_name text,p_recipient_nif text,p_recipient_address text,
 p_description text,p_operation_date date default null)
returns uuid
language plpgsql security definer set search_path=''
as $save$
declare
  j record;
  subtotal numeric(10,2);
  tax numeric(10,2);
  saved_id uuid;
begin
  if (select auth.uid()) is null or (select auth.role())<>'authenticated'
     or not (select public.is_reparado_admin()) then
    raise exception using errcode='42501',message='REPARADO_BILLING_ADMIN_REQUIRED';
  end if;
  -- Contrato de la UI: cada campo debe ser concreto; sin cortar datos
  -- silenciosamente ni permitir que se marque un importe no confirmado.
  if p_request_id is null or p_expected_total is null
     or p_expected_total<=0 or p_expected_total>999999.99
     or p_expected_total<>round(p_expected_total,2)
     or p_issuer_name is null or char_length(btrim(p_issuer_name)) not between 1 and 160
     or p_issuer_address is null or char_length(btrim(p_issuer_address)) not between 1 and 240
     or p_recipient_name is null or char_length(btrim(p_recipient_name)) not between 1 and 160
     or p_recipient_address is null or char_length(btrim(p_recipient_address)) not between 1 and 240
     or p_description is null or char_length(btrim(p_description)) not between 1 and 240
     or upper(btrim(coalesce(p_issuer_nif,''))) !~ '^[A-Z0-9-]{5,24}$'
     or upper(btrim(coalesce(p_recipient_nif,''))) !~ '^[A-Z0-9-]{5,24}$'
  then raise exception using errcode='23514',message='REPARADO_BILLING_DRAFT_INVALID_FIELDS'; end if;

  -- Se bloquea la solicitud para cotejar precio y estado en la MISMA
  -- transacción; no se fía del job del navegador ni de sus identificadores.
  select r.customer_id,r.price,r.status into j
    from public.service_requests r where r.id=p_request_id for update;
  if not found or j.status::text<>'completed'
     or j.price is null or j.price<>p_expected_total then
    raise exception using errcode='23514',message='REPARADO_BILLING_DRAFT_JOB_CHANGED';
  end if;
  -- No preparar nuevas versiones cuando existe una factura final registrada.
  if exists(select 1 from public.invoices i
     where i.request_id=p_request_id and i.status<>'draft') then
    raise exception using errcode='23514',message='REPARADO_BILLING_ALREADY_ISSUED';
  end if;
  subtotal:=round(p_expected_total/1.21,2);
  tax:=p_expected_total-subtotal;
  if abs(tax-round(subtotal*0.21,2))>0.01 then
    raise exception using errcode='23514',message='REPARADO_BILLING_DRAFT_TAX_MISMATCH';
  end if;

  insert into public.invoice_drafts (
     request_id,customer_id,issuer_name,issuer_nif,issuer_address,
     recipient_name,recipient_nif,recipient_address,description,
     operation_date,base,vat,total)
  values (
     p_request_id,j.customer_id,btrim(p_issuer_name),upper(btrim(p_issuer_nif)),btrim(p_issuer_address),
     btrim(p_recipient_name),upper(btrim(p_recipient_nif)),btrim(p_recipient_address),
     btrim(p_description),p_operation_date,subtotal,tax,p_expected_total)
  on conflict(request_id) do update set
     issuer_name=excluded.issuer_name,issuer_nif=excluded.issuer_nif,
     issuer_address=excluded.issuer_address,
     recipient_name=excluded.recipient_name,recipient_nif=excluded.recipient_nif,
     recipient_address=excluded.recipient_address,
     description=excluded.description,operation_date=excluded.operation_date,
     base=excluded.base,vat=excluded.vat,total=excluded.total,updated_at=now()
  where public.invoice_drafts.customer_id=excluded.customer_id
  returning id into saved_id;
  if saved_id is null then
    raise exception using errcode='23514',message='REPARADO_BILLING_DRAFT_OWNER_MISMATCH';
  end if;
  return saved_id;
end
$save$;
revoke all on function public.reparado_save_invoice_draft(
 uuid,numeric,text,text,text,text,text,text,text,date
) from public,anon,authenticated;
grant execute on function public.reparado_save_invoice_draft(
 uuid,numeric,text,text,text,text,text,text,text,date
) to authenticated;

do $verify$
begin
 if has_table_privilege('anon','public.invoice_drafts','SELECT')
  or has_table_privilege('authenticated','public.invoice_drafts','INSERT')
  or has_table_privilege('authenticated','public.invoice_drafts','UPDATE')
  or has_table_privilege('authenticated','public.invoice_drafts','DELETE')
  or has_function_privilege('anon','public.reparado_save_invoice_draft(uuid,numeric,text,text,text,text,text,text,text,date)','EXECUTE')
  or not has_function_privilege('authenticated','public.reparado_save_invoice_draft(uuid,numeric,text,text,text,text,text,text,text,date)','EXECUTE')
  or not (select relrowsecurity from pg_class where oid='public.invoice_drafts'::regclass)
 then raise exception 'REPARADO_V60_INVOICE_DRAFT_PERMISSIONS_INVALID'; end if;
end $verify$;
