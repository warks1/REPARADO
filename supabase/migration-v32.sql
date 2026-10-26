-- REPARADO V32 · Optimizar RLS de perfiles, solicitudes, chats y avisos.
-- Únicamente convertir auth.uid() por (select auth.uid()) en políticas
-- existentes: el resultado es constante durante cada sentencia SQL.
-- No añade usuarios, cambia roles, concede permisos ni relaja RLS.
-- Referencia: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

do $reparado_v32$
declare
  policy_row record;
  old_qual text;
  old_check text;
  updated_count integer:=0;
  wanted_count integer;
begin
  create temporary table if not exists pg_temp.reparado_v32_target_policies(
    table_name text not null,
    policy_name text not null,
    primary key(table_name,policy_name)
  ) on commit drop;
  truncate table pg_temp.reparado_v32_target_policies;
  insert into pg_temp.reparado_v32_target_policies(table_name,policy_name) values
    ('profiles','profile own read'),
    ('profiles','profile own update'),
    ('device_tokens','tokens own'),
    ('invoices','invoice customer and admin'),
    ('messages','message own insert'),
    ('messages','message participants'),
    ('notifications','notifications mark own'),
    ('notifications','notifications read own'),
    ('service_requests','request customer create'),
    ('service_requests','request customer read'),
    ('service_requests','request staff update');

  select count(*) into wanted_count
  from pg_policies p join pg_temp.reparado_v32_target_policies w
    on p.tablename=w.table_name and p.policyname=w.policy_name
  where p.schemaname='public';
  if wanted_count<>11 then
    raise exception 'REPARADO_V32_MISSING_POLICY: expected 11, found %',wanted_count;
  end if;
  if exists(
    select 1 from pg_temp.reparado_v32_target_policies w
    join pg_class c on c.oid=format('public.%I',w.table_name)::regclass
    where not c.relrowsecurity
  ) then
    raise exception 'REPARADO_V32_RLS_DISABLED';
  end if;

  for policy_row in
    select p.* from pg_policies p join pg_temp.reparado_v32_target_policies w
      on p.tablename=w.table_name and p.policyname=w.policy_name
    where p.schemaname='public' order by p.tablename,p.policyname
  loop
    old_qual:=policy_row.qual;
    old_check:=policy_row.with_check;
    -- ALTER POLICY conserva por diseño roles, tipo, nombre y permisividad.
    if old_qual is not null and position('auth.uid()' in old_qual)>0
      and position('( SELECT auth.uid()' in old_qual)=0 then
      execute format('alter policy %I on public.%I using (%s)',
        policy_row.policyname,policy_row.tablename,
        replace(old_qual,'auth.uid()','(select auth.uid())'));
      updated_count:=updated_count+1;
    end if;
    if old_check is not null and position('auth.uid()' in old_check)>0
      and position('( SELECT auth.uid()' in old_check)=0 then
      execute format('alter policy %I on public.%I with check (%s)',
        policy_row.policyname,policy_row.tablename,
        replace(old_check,'auth.uid()','(select auth.uid())'));
      updated_count:=updated_count+1;
    end if;
  end loop;

  if exists(
    select 1 from pg_policies p
    join pg_temp.reparado_v32_target_policies w
      on p.tablename=w.table_name and p.policyname=w.policy_name
    where p.schemaname='public'
      and (
        coalesce(p.qual,'') ~ '(^|[^[:alnum:]_])auth[.]uid[(][)]'
        and p.qual not like '%( SELECT auth.uid()%'
        or
        coalesce(p.with_check,'') ~ '(^|[^[:alnum:]_])auth[.]uid[(][)]'
        and p.with_check not like '%( SELECT auth.uid()%'
      )
  ) then
    raise exception 'REPARADO_V32_UNOPTIMIZED_POLICIES';
  end if;
  raise notice 'REPARADO V32: optimized % predicates without policy/role changes',updated_count;
end $reparado_v32$;
