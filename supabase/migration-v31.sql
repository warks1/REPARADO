-- REPARADO V31 · Solicitud idempotente de soporte.
-- Instalar tras migration-support-reports.sql. Columna NULL para histórico.
do $verify$
begin
  if to_regclass('public.support_reports') is null then
    raise exception 'REPARADO_V31_REQUIRES_SUPPORT';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.support_reports'::regclass) then
    raise exception 'REPARADO_V31_REQUIRES_RLS';
  end if;
end $verify$;

alter table public.support_reports
  add column if not exists client_report_id uuid;
create unique index if not exists reparado_support_client_report_unique_v31
  on public.support_reports(user_id,client_report_id)
  where client_report_id is not null;

revoke insert(client_report_id) on public.support_reports from anon;
grant insert(client_report_id), select(client_report_id)
  on public.support_reports to authenticated;

-- El cliente no puede modificar una clave ya utilizada, ni borrar el informe.
do $verify$
begin
  if has_column_privilege('anon','public.support_reports','client_report_id','INSERT')
    or not has_column_privilege('authenticated','public.support_reports','client_report_id','INSERT')
    or not has_column_privilege('authenticated','public.support_reports','client_report_id','SELECT')
    or has_column_privilege('authenticated','public.support_reports','client_report_id','UPDATE')
    or has_table_privilege('authenticated','public.support_reports','DELETE')
  then raise exception 'REPARADO_V31_PRIVILEGE_ERROR'; end if;
end $verify$;
