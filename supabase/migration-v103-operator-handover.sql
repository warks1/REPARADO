-- REPARADO V103 · Reasignación segura de servicios iniciados.
-- Conserva cada parte y sus fotografías al transferir un trabajo.
-- Aplicar tras V100 y V102. Probar primero en REPARADO Test.
begin;
do $preflight$
begin
 if to_regclass('public.work_reports') is null
    or to_regprocedure('public.reparado_start_work(uuid)') is null
    or to_regprocedure('reparado_private.work_photo_slot_available_v102(text)') is null
 then raise exception 'REPARADO_V103_REQUIRES_V100_V102'; end if;
end $preflight$;

-- Antes un trabajo tenía un único parte para siempre. Ahora el historial
-- pertenece a (trabajo, operario), por lo que un traspaso NO lo sobrescribe.
alter table public.work_reports drop constraint if exists work_reports_pkey;
alter table public.work_reports
 add constraint work_reports_pkey primary key (request_id,operator_id);
comment on table public.work_reports is
 'Historial privado de partes por intervención y operario; no borrar en reasignaciones.';

create table if not exists public.work_operator_transfers (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.service_requests(id) on delete cascade,
 previous_operator_id uuid,
 next_operator_id uuid,
 changed_by uuid,
 changed_at timestamptz not null default now(),
 status_at_transfer text not null check (status_at_transfer in
   ('new','quoted','accepted','scheduled','in_progress','completed','cancelled'))
);
create index if not exists reparado_work_transfer_request_idx
 on public.work_operator_transfers(request_id,changed_at desc);
alter table public.work_operator_transfers enable row level security;
revoke all on public.work_operator_transfers from public,anon,authenticated;
grant select on public.work_operator_transfers to authenticated;
drop policy if exists "reparado owner reads transfers" on public.work_operator_transfers;
create policy "reparado owner reads transfers" on public.work_operator_transfers
for select to authenticated using ((select public.is_reparado_admin()));

-- Un cambio en curso requiere propietario. Los trabajos ya finalizados no
-- permiten cambiar retrospectivamente el autor responsable.
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
drop trigger if exists reparado_guard_work_transfer_v103 on public.service_requests;
create trigger reparado_guard_work_transfer_v103 before update of operator_id
on public.service_requests for each row
execute function public.reparado_guard_work_transfer_v103();

-- El audit log se genera en la misma transacción: si falla el cambio de
-- operario, también desaparece el registro del intento.
create or replace function public.reparado_record_work_transfer_v103()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $record$
begin
 if new.operator_id is distinct from old.operator_id
    and old.status in ('scheduled','in_progress') then
   insert into public.work_operator_transfers(
     request_id,previous_operator_id,next_operator_id,changed_by,status_at_transfer)
   values(old.id,old.operator_id,new.operator_id,auth.uid(),old.status::text);
 end if;
 return new;
end $record$;
revoke all on function public.reparado_record_work_transfer_v103()
 from public,anon,authenticated;
drop trigger if exists reparado_record_work_transfer_v103 on public.service_requests;
create trigger reparado_record_work_transfer_v103 after update of operator_id
on public.service_requests for each row
execute function public.reparado_record_work_transfer_v103();

-- El operario que recibe un servicio ya en curso podrá abrir un parte NUEVO.
-- Si existe su parte histórico, se recupera sin tocar el anterior.
create or replace function public.reparado_start_work(p_request_id uuid)
returns boolean language plpgsql security invoker
set search_path=pg_catalog,public as $start$
declare v_operator uuid;
begin
 v_operator=auth.uid();
 if v_operator is null or not exists
   (select 1 from public.profiles p
    where p.id=v_operator and p.role='operator')
 then return false; end if;

 update public.service_requests set status='in_progress'
 where id=p_request_id and operator_id=v_operator and status='scheduled';
 if not found and not exists (
   select 1 from public.service_requests
   where id=p_request_id and operator_id=v_operator and status='in_progress'
 ) then return false; end if;

 insert into public.work_reports(request_id,operator_id)
 values(p_request_id,v_operator)
 on conflict (request_id,operator_id) do nothing;
 return exists (
   select 1 from public.work_reports
   where request_id=p_request_id and operator_id=v_operator
 );
end $start$;
revoke all on function public.reparado_start_work(uuid)
 from public,anon,authenticated;
grant execute on function public.reparado_start_work(uuid) to authenticated;

-- RLS de V100/V102 sigue ligando las fotos a la pareja
-- (request_id,operator_id). El propietario conserva lectura de todos los
-- partes pasados, y el nuevo operario no puede modificar los anteriores.
do $verify$
begin
 if (select count(*) from pg_attribute
     where attrelid='public.work_reports'::regclass
       and attname in ('request_id','operator_id') and not attisdropped)<>2
    or not (select relrowsecurity from pg_class
      where oid='public.work_reports'::regclass)
    or not exists (select 1 from storage.buckets
      where id='work-photos' and not public)
 then raise exception 'REPARADO_V103_SECURITY_NOT_READY'; end if;
end $verify$;
commit;