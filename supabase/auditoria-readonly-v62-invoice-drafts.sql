-- REPARADO V62: auditoría de SOLO LECTURA, ejecutable después de V60.
-- No devuelve identificadores, direcciones, importes ni datos personales.
-- Las verificaciones de datos son agregadas y no crean registros.
with checks as (
  select 10 as orden, 'V60: tabla de borradores instalada'::text as control,
    to_regclass('public.invoice_drafts') is not null as ok
  union all select 20, 'V60: RLS activada',
    coalesce((select c.relrowsecurity from pg_class c where c.oid=to_regclass('public.invoice_drafts')),false)
  union all select 30, 'V60: anon sin lectura ni escritura',
    not (has_table_privilege('anon','public.invoice_drafts','SELECT') or
         has_table_privilege('anon','public.invoice_drafts','INSERT') or
         has_table_privilege('anon','public.invoice_drafts','UPDATE') or
         has_table_privilege('anon','public.invoice_drafts','DELETE'))
  union all select 40, 'V60: usuarios sin escritura directa',
    not (has_table_privilege('authenticated','public.invoice_drafts','INSERT') or
         has_table_privilege('authenticated','public.invoice_drafts','UPDATE') or
         has_table_privilege('authenticated','public.invoice_drafts','DELETE'))
  union all select 50, 'V60: lectura administrativa por RLS',
    has_table_privilege('authenticated','public.invoice_drafts','SELECT') and
    exists(select 1 from pg_policies p where p.schemaname='public'
      and p.tablename='invoice_drafts' and p.policyname='invoice drafts admin read v60'
      and p.cmd='SELECT' and 'authenticated'=any(p.roles)
      and p.qual ilike '%is_reparado_admin%')
  union all select 60, 'V60: guardar por RPC autenticada y no anónima',
    to_regprocedure('public.reparado_save_invoice_draft(uuid,numeric,text,text,text,text,text,text,text,date)') is not null and
    has_function_privilege('authenticated','public.reparado_save_invoice_draft(uuid,numeric,text,text,text,text,text,text,text,date)','EXECUTE') and
    not has_function_privilege('anon','public.reparado_save_invoice_draft(uuid,numeric,text,text,text,text,text,text,text,date)','EXECUTE')
  union all select 70, 'V60: RPC comprueba identidad y administración',
    exists(select 1 from pg_proc p
      where p.oid=to_regprocedure('public.reparado_save_invoice_draft(uuid,numeric,text,text,text,text,text,text,text,date)')
      and p.prosecdef and 'search_path=""'=any(p.proconfig)
      and position('auth.uid()' in lower(pg_get_functiondef(p.oid)))>0
      and position('is_reparado_admin()' in lower(pg_get_functiondef(p.oid)))>0)
  union all select 80, 'V60: borrador único por solicitud',
    exists(select 1 from pg_constraint c
      where c.conrelid=to_regclass('public.invoice_drafts') and c.contype='u'
      and pg_get_constraintdef(c.oid) ilike '%request_id%')
  union all select 90, 'V60: borradores vinculados a cliente y solicitud',
    not exists(select 1 from public.invoice_drafts d
      left join public.service_requests r on r.id=d.request_id
      where r.id is null or d.customer_id is distinct from r.customer_id)
  union all select 100, 'V60: solo trabajos finalizados y precio coincidente',
    not exists(select 1 from public.invoice_drafts d
      join public.service_requests r on r.id=d.request_id
      where r.status::text<>'completed' or r.price is null or d.total<>r.price)
  union all select 110, 'V60: sin borradores de facturas ya emitidas',
    not exists(select 1 from public.invoice_drafts d
      join public.invoices i on i.request_id=d.request_id
      where i.status<>'draft')
  union all select 120, 'V60: IVA y sumas coherentes',
    not exists(select 1 from public.invoice_drafts d
      where d.base<0 or d.vat<0 or d.total<=0
        or abs(d.base+d.vat-d.total)>0.01
        or abs(d.vat-round(d.base*0.21,2))>0.01)
  union all select 130, 'Todas las tablas públicas mantienen RLS',
    not exists(select 1 from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity)
  union all select 140, 'No hay RPC SECURITY DEFINER ejecutables por anon',
    not exists(select 1 from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef
        and has_function_privilege('anon',p.oid,'EXECUTE'))
)
select control, case when ok then 'OK' else 'PENDIENTE' end as resultado
from checks order by orden;
