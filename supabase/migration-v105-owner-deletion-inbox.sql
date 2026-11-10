-- REPARADO V105 · Bandeja privada del propietario para solicitudes de supresión.
-- REQUIERE: migration-store-account-deletion.sql y rol admin protegido.
-- La UI solo permite pasar de "requested" a "in_review".
-- NO elimina cuentas, fotos ni documentos; NO permite marcar "completed".
begin;
do $preflight$
begin
 if to_regclass('public.account_deletion_requests') is null
   or to_regprocedure('public.is_reparado_admin()') is null
 then raise exception 'REPARADO_V105_REQUIRES_DELETION_QUEUE_AND_ROLES'; end if;
end $preflight$;

alter table public.account_deletion_requests enable row level security;

-- SELECT del propietario, aparte del SELECT de su propia solicitud por usuario.
drop policy if exists "deletion request admin read v105"
 on public.account_deletion_requests;
create policy "deletion request admin read v105"
 on public.account_deletion_requests
 for select to authenticated
 using ((select public.is_reparado_admin()));

-- Restringir la escritura con privilegio a la ÚNICA columna status.
-- Rechaza cambiar user_id, completed_at, fecha o la identidad solicitante.
revoke update on table public.account_deletion_requests
 from public,anon,authenticated;
grant update(status) on public.account_deletion_requests to authenticated;

drop policy if exists "deletion request admin review v105"
 on public.account_deletion_requests;
create policy "deletion request admin review v105"
 on public.account_deletion_requests
 for update to authenticated
 using (
   status='requested'
   and completed_at is null
   and (select public.is_reparado_admin())
 )
 with check (
   status='in_review'
   and completed_at is null
   and (select public.is_reparado_admin())
 );

-- Para recuperar una actualización POST/PATCH, SELECT propio/admin es obligatorio.
-- Comprobaciones de estructura y privacidad básicas.
do $verify$
begin
 if not (select relrowsecurity
  from pg_class where oid='public.account_deletion_requests'::regclass)
 or not exists(select 1 from pg_policies
  where schemaname='public' and tablename='account_deletion_requests'
    and policyname='deletion request own read')
 or not exists(select 1 from pg_policies
  where schemaname='public' and tablename='account_deletion_requests'
    and policyname='deletion request admin review v105')
 then raise exception 'REPARADO_V105_PRIVACY_NOT_CONFIGURED'; end if;
end $verify$;
commit;