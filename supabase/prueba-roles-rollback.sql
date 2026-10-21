-- REPARADO Test | prueba de permisos en PostgreSQL de Supabase real.
-- IMPORTANTE: inserta únicamente identificadores ficticios SIN contraseñas,
-- prueba RLS con los roles de Postgres y termina con ROLLBACK.
-- NO crea cuentas utilizables de Supabase Auth ni envía invitaciones.
-- NO ejecutar en producción: exige que el proyecto esté VACÍO.
-- Requiere esquema REPARADO y migraciones V4–V11 instaladas.
-- La prueba solo verifica la capa SQL/RLS, NO el login real, ni la API
-- de Storage, ni la configuración de registro/invitaciones en Auth.

begin;

do $reparado_empty$
begin
  if exists(select 1 from auth.users)
    or exists(select 1 from public.profiles)
    or exists(select 1 from public.service_requests)
    or exists(select 1 from public.messages)
    or exists(select 1 from public.notifications)
    or exists(select 1 from public.device_tokens)
    or exists(select 1 from public.invoices)
    or exists(select 1 from storage.objects where bucket_id='request-photos')
  then
    raise exception 'REPARADO_ROLES_TEST_REQUIRES_EMPTY_TEST_PROJECT';
  end if;
end
$reparado_empty$;

-- Simular cuatro identidades Auth. Nunca credenciales ni correos reales.
insert into auth.users(id,aud,role,email,raw_user_meta_data) values
 ('f1000000-0000-4000-8000-000000000001','authenticated','authenticated','reparado-cliente-a@example.invalid','{"full_name":"Cliente ficticio A"}'::jsonb),
 ('f1000000-0000-4000-8000-000000000002','authenticated','authenticated','reparado-cliente-b@example.invalid','{"full_name":"Cliente ficticio B"}'::jsonb),
 ('f1000000-0000-4000-8000-000000000003','authenticated','authenticated','reparado-operario@example.invalid','{"full_name":"Operario ficticio"}'::jsonb),
 ('f1000000-0000-4000-8000-000000000004','authenticated','authenticated','reparado-admin@example.invalid','{"full_name":"Administrador ficticio"}'::jsonb);

-- El trigger de alta debe asignar customer a TODOS por defecto.
do $initial_roles$
begin
  if (select count(*) from public.profiles
      where role='customer' and id::text like 'f1000000-%')<>4 then
    raise exception 'REPARADO_TEST_SIGNUP_MUST_CREATE_CUSTOMERS';
  end if;
end $initial_roles$;

-- Los roles elevados solo los asigna un administrador SQL autorizado.
update public.profiles set role='operator'
 where id='f1000000-0000-4000-8000-000000000003';
update public.profiles set role='admin'
 where id='f1000000-0000-4000-8000-000000000004';

insert into public.service_requests
(id,customer_id,service_name,category,street,address_number,postal_code,city,phone,price,status)
values
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',
  'Grifo de prueba','Fontanería','Calle ficticia','1','08001','Barcelona','000000000',121,'quoted'),
 ('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002',
  'Sifón de prueba','Fontanería','Calle ficticia','2','08001','Barcelona','000000000',60,'quoted');

insert into public.invoices
(request_id,customer_id,number,subtotal,vat,total,status)
values
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','FICTICIA-A',100,21,121,'issued'),
 ('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','FICTICIA-B',49.59,10.41,60,'issued'),
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','BORRADOR-FICTICIO',0,0,0,'draft');

insert into public.notifications(user_id,title,body)
values
 ('f1000000-0000-4000-8000-000000000001','Aviso ficticio A','Prueba'),
 ('f1000000-0000-4000-8000-000000000002','Aviso ficticio B','Prueba'),
 ('f1000000-0000-4000-8000-000000000003','Aviso ficticio operario','Prueba');

-- Cliente A: no consulta datos de B ni borradores; no acepta su presupuesto.
set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
do $client_a$
begin
  if (select count(*) from public.profiles)<>1
     or (select count(*) from public.service_requests)<>1
     or (select count(*) from public.invoices)<>1
     or (select count(*) from public.notifications)<>1 then
    raise exception 'REPARADO_CLIENT_A_RLS_LEAK';
  end if;
  if (select public.accept_reparado_quote('f2000000-0000-4000-8000-000000000002'::uuid)) then
    raise exception 'REPARADO_CLIENT_A_ACCEPTED_FOREIGN_QUOTE';
  end if;
  if not (select public.accept_reparado_quote('f2000000-0000-4000-8000-000000000001'::uuid)) then
    raise exception 'REPARADO_CLIENT_A_COULD_NOT_ACCEPT_OWN_QUOTE';
  end if;
end
$client_a$;
reset role;

-- Cliente B: tampoco puede ver ni aceptar los presupuestos de A.
set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000002',true);
do $client_b$
begin
  if (select count(*) from public.profiles)<>1
     or (select count(*) from public.service_requests)<>1
     or (select count(*) from public.invoices)<>1
     or (select count(*) from public.notifications)<>1 then
    raise exception 'REPARADO_CLIENT_B_RLS_LEAK';
  end if;
  if (select public.accept_reparado_quote('f2000000-0000-4000-8000-000000000001'::uuid)) then
    raise exception 'REPARADO_CLIENT_B_ACCEPTED_FOREIGN_QUOTE';
  end if;
end $client_b$;
reset role;

-- Operario sin asignación: no ve solicitudes ni facturas de clientes.
set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000003',true);
do $operator_before$
begin
  if (select count(*) from public.profiles)<>1
     or (select count(*) from public.service_requests)<>0
     or (select count(*) from public.invoices)<>0 then
    raise exception 'REPARADO_OPERATOR_UNASSIGNED_RLS_LEAK';
  end if;
end $operator_before$;
reset role;

-- Administrador: ve los dos servicios y puede asignar un operario.
set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000004',true);
do $admin_check$
begin
  if (select count(*) from public.profiles)<>4
     or (select count(*) from public.service_requests)<>2
     or (select count(*) from public.invoices)<>3 then
    raise exception 'REPARADO_ADMIN_INCOMPLETE_VISIBILITY';
  end if;
end $admin_check$;
update public.service_requests
  set operator_id='f1000000-0000-4000-8000-000000000003',
      operator_name='Operario ficticio',
      status='scheduled',
      scheduled_at='2026-10-28 11:00:00+01'
  where id='f2000000-0000-4000-8000-000000000001';
reset role;

-- Operario asignado: ve solo su trabajo y su bandeja de avisos.
set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000003',true);
do $operator_after$
begin
  if (select count(*) from public.service_requests)<>1
     or (select count(*) from public.invoices)<>0
     or (select count(*) from public.notifications) < 2 then
    raise exception 'REPARADO_OPERATOR_ASSIGNMENT_OR_NOTIFICATIONS_FAILED';
  end if;
end $operator_after$;
reset role;

-- Visitante anónimo: cero privilegios SQL sobre las seis tablas.
set local role anon;
do $anonymous$
declare
  t regclass;
begin
  foreach t in array array[
    'public.profiles'::regclass,'public.service_requests'::regclass,
    'public.messages'::regclass,'public.notifications'::regclass,
    'public.device_tokens'::regclass,'public.invoices'::regclass
  ] loop
    if has_table_privilege('anon',t,'SELECT')
      or has_table_privilege('anon',t,'INSERT')
      or has_table_privilege('anon',t,'UPDATE')
      or has_table_privilege('anon',t,'DELETE') then
      raise exception 'REPARADO_ANONYMOUS_PRIVILEGE_ON_%',t;
    end if;
  end loop;
end $anonymous$;
reset role;

select 'OK: dos clientes, operario, administrador y anónimo; RLS real de Supabase verificada; ejecutando ROLLBACK' as resultado;
rollback;

-- Ejecutar después una consulta independiente de conteos para confirmar
-- que el ROLLBACK dejó auth.users, perfiles y solicitudes vacíos.
