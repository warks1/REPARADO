-- REPARADO V105: comprobaciones de privacidad REVERSIBLES (solo Supabase Test).
-- No se elimina ninguna cuenta: BEGIN/ROLLBACK.
begin;
select set_config('qa.v105.customer',(
  select p.id::text from public.profiles p
  join auth.users u on u.id=p.id
  where p.role='customer'
    and not exists(select 1 from public.account_deletion_requests d where d.user_id=p.id)
  order by p.id limit 1
),true);
select set_config('qa.v105.admin',(
 select id::text from public.profiles where role='admin' order by id limit 1
),true);
select set_config('qa.v105.other',(
 select id::text from public.profiles where role='customer'
   and id<>current_setting('qa.v105.customer')::uuid
 order by id limit 1
),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.v105.customer'),true);
insert into public.account_deletion_requests(user_id)
values(current_setting('qa.v105.customer')::uuid);
select set_config('qa.v105.req_id',(
 select id::text from public.account_deletion_requests
 where user_id=current_setting('qa.v105.customer')::uuid
),true);
do $customer$
declare changed_rows integer;
begin
 if not exists(select 1 from public.account_deletion_requests
  where id=current_setting('qa.v105.req_id')::uuid)
 then raise exception 'V105_CUSTOMER_CANNOT_READ_OWN'; end if;
 begin
   update public.account_deletion_requests set status='in_review'
   where id=current_setting('qa.v105.req_id')::uuid;
   get diagnostics changed_rows = row_count;
   if changed_rows<>0 then
     raise exception 'V105_CUSTOMER_ILLEGALLY_UPDATED_STATUS';
   end if;
 exception when insufficient_privilege then null;
 end;
end $customer$;
select set_config('request.jwt.claim.sub',current_setting('qa.v105.other'),true);
do $other$
begin
 if exists(select 1 from public.account_deletion_requests
  where id=current_setting('qa.v105.req_id')::uuid)
 then raise exception 'V105_OTHER_CUSTOMER_SEES_PRIVATE_REQUEST'; end if;
end $other$;
select set_config('request.jwt.claim.sub',current_setting('qa.v105.admin'),true);
do $owner$
declare changed_rows integer;
begin
 if not exists(select 1 from public.account_deletion_requests
  where id=current_setting('qa.v105.req_id')::uuid and status='requested')
 then raise exception 'V105_ADMIN_CANNOT_READ'; end if;
 update public.account_deletion_requests
   set status='in_review'
   where id=current_setting('qa.v105.req_id')::uuid and status='requested';
 if not found then raise exception 'V105_ADMIN_REVIEW_FAILED'; end if;
 if not exists(select 1 from public.account_deletion_requests
  where id=current_setting('qa.v105.req_id')::uuid and status='in_review')
 then raise exception 'V105_ADMIN_REVIEW_NOT_SAVED'; end if;
 begin
   update public.account_deletion_requests set status='completed'
   where id=current_setting('qa.v105.req_id')::uuid;
   get diagnostics changed_rows = row_count;
   if changed_rows<>0 then
      raise exception 'V105_UNVERIFIED_COMPLETION_ALLOWED';
   end if;
 exception when insufficient_privilege then null;
 end;
 begin
   update public.account_deletion_requests set completed_at=now()
   where id=current_setting('qa.v105.req_id')::uuid;
   raise exception 'V105_COMPLETED_AT_TAMPER_ALLOWED';
 exception when insufficient_privilege then null;
 end;
end $owner$;
rollback;