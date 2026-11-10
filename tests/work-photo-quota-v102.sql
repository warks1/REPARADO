-- REPARADO V102 · prueba transaccional de cuota real en Supabase Test.
-- Ejecutar con permisos de administrador DESPUÉS de la migración V102.
-- IMPORTANTE: BEGIN/ROLLBACK. No deja solicitudes ni metadatos de prueba.
begin;
select set_config('reparado.qa_operator',
 (select id::text from public.profiles where role='operator' order by id limit 1),true);
select set_config('reparado.qa_customer',
 (select id::text from public.profiles where role='customer' order by id limit 1),true);

insert into public.service_requests(
 id,customer_id,service_name,category,price,street,address_number,postal_code,
 city,phone,description,status,operator_id,operator_name,scheduled_at
) values(
 'f1020000-0000-4000-8000-000000000102',
 current_setting('reparado.qa_customer')::uuid,
 'REPARADO_V102_QUOTA_TRANSACTION_ROLLBACK','Fontanería',121,
 'Calle QA','1','08001','Barcelona','000000000',
 'Trabajo ficticio reversible para control de seguridad','scheduled',
 current_setting('reparado.qa_operator')::uuid,
 'Operario QA',now()+interval '63 days'
);

select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

-- El CLIENTE no debe poder iniciar el trabajo del operario.
select set_config('request.jwt.claim.sub',current_setting('reparado.qa_customer'),true);
do $customer$
begin
 if public.reparado_start_work('f1020000-0000-4000-8000-000000000102')
 then raise exception 'REPARADO_V102_CUSTOMER_STARTED_WORK'; end if;
end $customer$;

select set_config('request.jwt.claim.sub',current_setting('reparado.qa_operator'),true);
do $operator$
begin
 if not public.reparado_start_work('f1020000-0000-4000-8000-000000000102')
 then raise exception 'REPARADO_V102_OPERATOR_COULD_NOT_START'; end if;
end $operator$;

-- Ocho metadatos representativos de fotos, sólo en la transacción reversible.
-- La operación pasa por la misma política INSERT RLS que Supabase Storage.
do $photos$
declare i int; v_name text;
begin
 for i in 1..8 loop
  v_name:=current_setting('reparado.qa_operator')||
    '/f1020000-0000-4000-8000-000000000102/foto-'||
    lpad(to_hex(i),64,'0')||'.jpg';
  insert into storage.objects(bucket_id,name,owner,owner_id)
    values('work-photos',v_name,auth.uid(),auth.uid()::text);
 end loop;

 -- El noveno INSERT debe fallar en RLS, pero no abortar toda la prueba.
 begin
  insert into storage.objects(bucket_id,name,owner,owner_id)
    values('work-photos',
    current_setting('reparado.qa_operator')||
    '/f1020000-0000-4000-8000-000000000102/foto-'||
    lpad(to_hex(9),64,'0')||'.jpg',auth.uid(),auth.uid()::text);
  raise exception 'REPARADO_V102_NINTH_PHOTO_WAS_ALLOWED';
 exception
   when insufficient_privilege or check_violation then null;
 end;
end $photos$;

do $verify$
begin
 if (select count(*) from storage.objects
     where bucket_id='work-photos'
     and name like current_setting('reparado.qa_operator')||
       '/f1020000-0000-4000-8000-000000000102/%')<>8
 then raise exception 'REPARADO_V102_WRONG_PHOTO_COUNT'; end if;
end $verify$;

rollback;
