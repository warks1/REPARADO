-- REPARADO V33 · Unificar lectura de reseñas sin ampliar datos ni permisos.
-- Las 3 políticas permisivas para authenticated eran equivalentes a una OR.
-- Seguridad: anon sigue viendo SÓLO approved; clientes ven approved + propias;
-- admin ve todas para moderar. UPDATE e INSERT no se alteran.
do $preflight$
begin
  if to_regclass('public.customer_reviews') is null
    or not (select relrowsecurity from pg_class where oid='public.customer_reviews'::regclass)
  then raise exception 'REPARADO_V33_REQUIRES_REVIEWS_RLS'; end if;
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='customer_reviews'
        and policyname in ('reviews show approved','reviews see own','reviews admin read moderation',
                           'reviews authenticated read')) not in (2,3)
  then raise exception 'REPARADO_V33_UNEXPECTED_READ_POLICIES'; end if;
  if has_column_privilege('authenticated','public.customer_reviews','customer_id','SELECT')
    or has_column_privilege('anon','public.customer_reviews','request_id','SELECT')
  then raise exception 'REPARADO_V33_PRIVATE_COLUMNS_EXPOSED'; end if;
end $preflight$;

-- Los DROP/CREATE forman parte de una transacción SQL única.
drop policy if exists "reviews authenticated read" on public.customer_reviews;
drop policy if exists "reviews admin read moderation" on public.customer_reviews;
drop policy if exists "reviews see own" on public.customer_reviews;
drop policy if exists "reviews show approved" on public.customer_reviews;

create policy "reviews show approved" on public.customer_reviews
  for select to anon
  using (status='approved');

create policy "reviews authenticated read" on public.customer_reviews
  for select to authenticated
  using (
    status='approved'
    or customer_id=(select auth.uid())
    or (select public.is_reparado_admin())
  );

do $verify$
begin
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='customer_reviews' and cmd='SELECT')<>2
    or (select count(*) from pg_policies
      where schemaname='public' and tablename='customer_reviews'
        and cmd='SELECT' and roles='{authenticated}')<>1
    or has_column_privilege('authenticated','public.customer_reviews','customer_id','SELECT')
    or has_column_privilege('anon','public.customer_reviews','request_id','SELECT')
    or not (select relrowsecurity from pg_class where oid='public.customer_reviews'::regclass)
  then raise exception 'REPARADO_V33_POLICY_VERIFICATION_FAILED'; end if;
end $verify$;
