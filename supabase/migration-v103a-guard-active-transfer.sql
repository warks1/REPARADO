-- REPARADO V103a: al cambiar un operario EN CURSO, el trabajo debe
-- seguir EN CURSO. Prohíbe transferir y terminar en la misma actualización.
-- Idempotente y compatible con V103 base. Probar en REPARADO Test.
begin;
do $preflight$
begin
 if to_regprocedure('public.reparado_guard_work_transfer_v103()') is null
 then raise exception 'REPARADO_V103A_REQUIRES_V103'; end if;
end $preflight$;
create or replace function public.reparado_guard_work_transfer_v103()
returns trigger language plpgsql security invoker
set search_path=pg_catalog,public,pg_temp as $guard$
begin
 if new.operator_id is not distinct from old.operator_id then return new; end if;
 if old.status='completed' then
   raise exception using errcode='23514',
     message='REPARADO_COMPLETED_OPERATOR_LOCKED';
 end if;
 if old.status='in_progress' then
   if new.status is distinct from old.status then
     raise exception using errcode='23514',
       message='REPARADO_TRANSFER_MUST_STAY_ACTIVE';
   end if;
   if new.operator_id is null then
     raise exception using errcode='23514',
       message='REPARADO_ACTIVE_OPERATOR_REQUIRED';
   end if;
   if auth.uid() is not null and not public.is_reparado_admin() then
     raise exception using errcode='42501',
       message='REPARADO_TRANSFER_OWNER_ONLY';
   end if;
 end if;
 return new;
end $guard$;
revoke all on function public.reparado_guard_work_transfer_v103()
 from public,anon,authenticated;
commit;