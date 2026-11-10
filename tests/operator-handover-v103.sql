-- REPARADO V103 · Prueba REAL de traspaso, sólo en REPARADO Test.
-- REQUIERE: un admin, un operario y dos perfiles cliente de pruebas.
-- BEGIN/ROLLBACK: cambia provisionalmente el rol de un cliente exclusivamente
-- dentro de la transacción; no confirma cuentas, visitas ni fotos ficticias.
begin;
select set_config('qa.v103.old',
 (select id::text from public.profiles where role='operator' order by id limit 1),true);
select set_config('qa.v103.new',
 (select id::text from public.profiles where role='customer' order by id limit 1),true);
select set_config('qa.v103.admin',
 (select id::text from public.profiles where role='admin' order by id limit 1),true);

update public.profiles set role='operator'
where id=current_setting('qa.v103.new')::uuid;
insert into public.service_requests(
 id,customer_id,service_name,category,price,street,address_number,
 postal_code,city,phone,description,status,operator_id,operator_name,scheduled_at
) values(
 'f1030000-0000-4000-8000-000000000103',
 (select id from public.profiles where role='customer' order by id limit 1),
 'REPARADO_V103_QA_ROLLBACK','Fontanería',121,
 'Calle test','1','08001','Barcelona','000000000',
 'Servicio ficticio reversible de traspaso','scheduled',
 current_setting('qa.v103.old')::uuid,'Operario anterior',now()+interval '68 days'
);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select set_config('request.jwt.claim.sub',current_setting('qa.v103.old'),true);
do $original$
begin
 if not public.reparado_start_work('f1030000-0000-4000-8000-000000000103')
 then raise exception 'V103_ORIGINAL_CANNOT_START'; end if;
end $original$;
update public.work_reports
 set description='Trabajo realizado por operario anterior, guardado antes del cambio.'
 where request_id='f1030000-0000-4000-8000-000000000103';
insert into storage.objects(bucket_id,name,owner,owner_id)
values('work-photos',current_setting('qa.v103.old')||
 '/f1030000-0000-4000-8000-000000000103/foto-'||repeat('a',64)||'.jpg',
 auth.uid(),auth.uid()::text);

select set_config('request.jwt.claim.sub',current_setting('qa.v103.admin'),true);
update public.service_requests
 set operator_id=current_setting('qa.v103.new')::uuid,
 operator_name='Operario sustituto'
 where id='f1030000-0000-4000-8000-000000000103';

select set_config('request.jwt.claim.sub',current_setting('qa.v103.old'),true);
do $former$
begin
 if public.reparado_start_work('f1030000-0000-4000-8000-000000000103')
 then raise exception 'V103_FORMER_OPERATOR_CAN_STILL_START'; end if;
 if exists(select 1 from public.work_reports
  where request_id='f1030000-0000-4000-8000-000000000103')
 then raise exception 'V103_FORMER_OPERATOR_CAN_STILL_READ'; end if;
end $former$;

select set_config('request.jwt.claim.sub',current_setting('qa.v103.new'),true);
do $replacement$
begin
 if not public.reparado_start_work('f1030000-0000-4000-8000-000000000103')
 then raise exception 'V103_REPLACEMENT_CANNOT_START'; end if;
end $replacement$;
insert into storage.objects(bucket_id,name,owner,owner_id)
values('work-photos',current_setting('qa.v103.new')||
 '/f1030000-0000-4000-8000-000000000103/foto-'||repeat('b',64)||'.jpg',
 auth.uid(),auth.uid()::text);
do $close$
begin
 if not public.reparado_complete_work(
  'f1030000-0000-4000-8000-000000000103',
  'El operario sustituto ha concluido la intervención y comprobado el resultado.')
 then raise exception 'V103_REPLACEMENT_CANNOT_COMPLETE'; end if;
end $close$;

select set_config('request.jwt.claim.sub',current_setting('qa.v103.admin'),true);
do $verify$
begin
 if (select count(*) from public.work_reports
  where request_id='f1030000-0000-4000-8000-000000000103')<>2
 or (select count(*) from storage.objects
  where bucket_id='work-photos' and name like
  '%/f1030000-0000-4000-8000-000000000103/%')<>2
 or (select count(*) from public.work_operator_transfers
  where request_id='f1030000-0000-4000-8000-000000000103')<>1
 or (select status::text from public.service_requests
  where id='f1030000-0000-4000-8000-000000000103')<>'completed'
 then raise exception 'V103_HISTORY_OR_COMPLETION_NOT_PRESERVED'; end if;
end $verify$;
rollback;