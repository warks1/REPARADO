-- REPARADO V13: opiniones auténticas sobre servicios completados.
-- NO insertar las 32 reseñas ficticias de la interfaz en esta tabla.
-- Requiere V4-V12. Aplicar primero en REPARADO Test.
create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id),
  request_id uuid not null references public.service_requests(id),
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 12 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  constraint one_review_per_service unique (request_id)
);
create index if not exists customer_reviews_public_idx on public.customer_reviews(status,created_at desc);
create index if not exists customer_reviews_customer_idx on public.customer_reviews(customer_id,created_at desc);
alter table public.customer_reviews enable row level security;
revoke all on public.customer_reviews from public,anon,authenticated;
-- La API pública no expone IDs personales de clientes ni de solicitudes.
grant select(id,rating,comment,status,created_at) on public.customer_reviews to anon,authenticated;
grant insert(customer_id,request_id,rating,comment) on public.customer_reviews to authenticated;
drop policy if exists "reviews show approved" on public.customer_reviews;
drop policy if exists "reviews see own" on public.customer_reviews;
drop policy if exists "reviews insert for completed own request" on public.customer_reviews;
create policy "reviews show approved" on public.customer_reviews
  for select to anon,authenticated using (status='approved');
create policy "reviews see own" on public.customer_reviews
  for select to authenticated using (customer_id=(select auth.uid()));
create policy "reviews insert for completed own request" on public.customer_reviews
  for insert to authenticated with check (
    customer_id=(select auth.uid()) and status='pending'
    and exists (
      select 1 from public.service_requests sr
      where sr.id=request_id
        and sr.customer_id=(select auth.uid())
        and sr.status='completed'
    )
  );
-- No otorgar UPDATE ni DELETE al cliente: aprobación exclusivamente administrativa.
-- En el panel SQL, administrador autorizado:
-- update public.customer_reviews set status='approved' where id='<uuid-reseña>';

-- CI: verificar V13 junto a las fotografías y sus créditos en la revisión final.
