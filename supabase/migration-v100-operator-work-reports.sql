-- REPARADO V100 · Parte de trabajo del operario.
-- Aplicar tras las migraciones de roles, estados y Storage (V4/V7/V12/V19).
-- Instalar primero en REPARADO Test. Ninguna cuenta anónima puede consultar
-- partes, subir fotos ni cambiar el estado de un encargo.
-- No contiene datos nuevos de clientes; el parte es PRIVADO al equipo.
begin;

do $preflight$
begin
 if to_regclass('public.service_requests') is null
   or to_regclass('public.profiles') is null
   or to_regprocedure('public.is_reparado_admin()') is null then
   raise exception 'REPARADO_V100_REQUIRES_BASE_SCHEMA';
 end if;
end $preflight$;

alter table public.service_requests
 add column if not exists work_started_at timestamptz,
 add column if not exists work_finished_at timestamptz;

create table if not exists public.work_reports (
 request_id uuid primary key references public.service_requests(id) on delete cascade,
 operator_id uuid not null,
 description text not null default '' check (char_length(description)<=4000),
 created_at timestamptz not null default now()
);
create index if not exists reparado_work_reports_operator_idx
 on public.work_reports(operator_id);

alter table public.work_reports enable row level security;
revoke all on public.work_reports from public, anon, authenticated;
grant select on public.work_reports to authenticated;
grant insert (request_id,operator_id) on public.work_reports to authenticated;
grant update (description) on public.work_reports to authenticated;

drop policy if exists "reparado work report read" on public.work_reports;
create policy "reparado work report read" on public.work_reports
 for select to authenticated
 using (
   (select public.is_reparado_admin())
   or (
     operator_id=(select auth.uid())
     and exists (select 1 from public.service_requests r
       where r.id=work_reports.request_id and r.operator_id=(select auth.uid()))
   )
 );
drop policy if exists "reparado work report start" on public.work_reports;
create policy "reparado work report start" on public.work_reports
 for insert to authenticated
 with check (
   operator_id=(select auth.uid())
   and exists (
     select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='operator'
   )
   and exists (select 1 from public.service_requests r
     where r.id=work_reports.request_id and r.operator_id=(select auth.uid())
       and r.status='in_progress')
 );
drop policy if exists "reparado work report edit" on public.work_reports;
create policy "reparado work report edit" on public.work_reports
 for update to authenticated
 using (
   operator_id=(select auth.uid())
   and exists (select 1 from public.service_requests r
     where r.id=work_reports.request_id and r.operator_id=(select auth.uid())
       and r.status='in_progress')
 )
 with check (
   operator_id=(select auth.uid())
   and exists (select 1 from public.service_requests r
     where r.id=work_reports.request_id and r.operator_id=(select auth.uid())
       and r.status='in_progress')
 );

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('work-photos','work-photos',false,8388608,
 array['image/jpeg','image/png','image/webp','image/heic'])
on conflict(id) do update set
 public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;

-- Ruta: <operario UUID>/<solicitud UUID>/<foto UUID>.<extensión>.
-- Sin UPDATE ni DELETE: no sustituir ni eliminar pruebas después del cierre.
drop policy if exists "reparado work photos upload" on storage.objects;
create policy "reparado work photos upload" on storage.objects
 for insert to authenticated
 with check (
   bucket_id='work-photos'
   and cardinality(storage.foldername(name))=2
   and (storage.foldername(name))[1]=(select auth.uid()::text)
   and storage.filename(name) ~
     '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic)$'
   and exists (
     select 1 from public.service_requests r
     join public.work_reports wr on wr.request_id=r.id
     where r.id::text=(storage.foldername(name))[2]
       and r.operator_id=(select auth.uid())
       and wr.operator_id=(select auth.uid())
       and r.status='in_progress'
   )
 );
drop policy if exists "reparado work photos read" on storage.objects;
create policy "reparado work photos read" on storage.objects
 for select to authenticated
 using (
   bucket_id='work-photos'
   and cardinality(storage.foldername(name))=2
   and exists (
     select 1 from public.work_reports wr
     join public.service_requests r on r.id=wr.request_id
     where r.id::text=(storage.foldername(name))[2]
       and wr.operator_id::text=(storage.foldername(name))[1]
       and (
         (select public.is_reparado_admin())
         or (wr.operator_id=(select auth.uid())
             and r.operator_id=(select auth.uid()))
       )
   )
 );

-- La comprobación en el servidor impide que un cliente antiguo cierre un
-- trabajo solo cambiando "status", sin fotos ni explicación del operario.
-- Una acción correctiva del titular sigue pudiendo cerrar un trabajo.
create or replace function public.reparado_work_status_guard_v100()
returns trigger
language plpgsql security invoker
set search_path=pg_catalog,public
as $guard$
begin
 if old.status is not distinct from new.status then return new; end if;
 if old.status='scheduled' and new.status='in_progress' then
   new.work_started_at=coalesce(old.work_started_at,transaction_timestamp());
 end if;
 if old.status='in_progress' and new.status='completed' then
   if auth.uid() is not null and not public.is_reparado_admin() then
     if old.operator_id is distinct from auth.uid()
       or not exists (
         select 1 from public.work_reports wr
         where wr.request_id=old.id and wr.operator_id=auth.uid()
           and char_length(btrim(wr.description))>=20
       ) then
       raise exception using errcode='23514',
         message='REPARADO_WORK_DESCRIPTION_REQUIRED';
     end if;
     if not exists (
       select 1 from storage.objects o
       where o.bucket_id='work-photos'
         and o.name like auth.uid()::text||'/'||old.id::text||'/%'
     ) then
       raise exception using errcode='23514',
         message='REPARADO_WORK_PHOTO_REQUIRED';
     end if;
   end if;
   new.work_finished_at=transaction_timestamp();
 end if;
 return new;
end;
$guard$;
revoke all on function public.reparado_work_status_guard_v100() from public,anon,authenticated;
drop trigger if exists reparado_work_status_guard_v100 on public.service_requests;
create trigger reparado_work_status_guard_v100
 before update of status on public.service_requests
 for each row execute function public.reparado_work_status_guard_v100();

-- API exclusivamente para operario, usando sus RLS y privilegios ordinarios.
-- SECURITY INVOKER: nunca exponer service_role ni saltarse políticas.
create or replace function public.reparado_start_work(p_request_id uuid)
returns boolean
language plpgsql security invoker
set search_path=pg_catalog,public
as $start$
declare v_operator uuid;
begin
 v_operator=auth.uid();
 if v_operator is null or not exists
   (select 1 from public.profiles p where p.id=v_operator and p.role='operator')
 then return false; end if;

 update public.service_requests
   set status='in_progress'
   where id=p_request_id and operator_id=v_operator and status='scheduled';
 if not found and not exists (
   select 1 from public.service_requests
     where id=p_request_id and operator_id=v_operator and status='in_progress'
 ) then return false; end if;

 insert into public.work_reports(request_id,operator_id)
   values(p_request_id,v_operator)
   on conflict(request_id) do nothing;
 return exists (
   select 1 from public.work_reports
   where request_id=p_request_id and operator_id=v_operator
 );
end;
$start$;
revoke all on function public.reparado_start_work(uuid) from public,anon,authenticated;
grant execute on function public.reparado_start_work(uuid) to authenticated;

create or replace function public.reparado_complete_work(p_request_id uuid,p_description text)
returns boolean
language plpgsql security invoker
set search_path=pg_catalog,public
as $finish$
declare v_operator uuid; v_notes text;
begin
 v_operator=auth.uid();
 v_notes=btrim(coalesce(p_description,''));
 if v_operator is null or char_length(v_notes)<20 or char_length(v_notes)>4000
   or not exists (
     select 1 from public.profiles p where p.id=v_operator and p.role='operator'
   )
 then return false; end if;

 -- Serializar el cierre concurrente sobre la solicitud; si se reasignó o
 -- cerró ya, la acción debe fallar sin sobrescribir el parte.
 perform 1 from public.service_requests
   where id=p_request_id and operator_id=v_operator and status='in_progress'
   for update;
 if not found then return false; end if;

 if not exists (
   select 1 from storage.objects o
   where o.bucket_id='work-photos'
     and o.name like v_operator::text||'/'||p_request_id::text||'/%'
 ) then return false; end if;

 update public.work_reports set description=v_notes
   where request_id=p_request_id and operator_id=v_operator;
 if not found then return false; end if;

 update public.service_requests set status='completed'
   where id=p_request_id and operator_id=v_operator and status='in_progress';
 return found;
end;
$finish$;
revoke all on function public.reparado_complete_work(uuid,text) from public,anon,authenticated;
grant execute on function public.reparado_complete_work(uuid,text) to authenticated;

comment on table public.work_reports is 'Parte interno de intervención: descripción del trabajo ejecutado, no factura.';
comment on function public.reparado_complete_work(uuid,text) is
 'Solo operario asignado en curso, descripción >=20 caracteres y foto privada. Cierre atómico.';

commit;
