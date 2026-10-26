-- REPARADO · Solicitudes de eliminación de cuenta (iOS/Android/RGPD).
-- Cola privada; crea la solicitud, NO borra datos por sí misma.
-- Tramitación exclusivamente por administración (desde una herramienta segura).
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'requested'
    check(status in ('requested','in_review','completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists reparado_account_deletion_status_idx
  on public.account_deletion_requests(status,requested_at);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated;
grant select(id,status,requested_at,completed_at) on public.account_deletion_requests to authenticated;
grant insert(user_id) on public.account_deletion_requests to authenticated;
drop policy if exists "deletion request own read" on public.account_deletion_requests;
create policy "deletion request own read" on public.account_deletion_requests
  for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists "deletion request own create" on public.account_deletion_requests;
create policy "deletion request own create" on public.account_deletion_requests
  for insert to authenticated with check(
    user_id=(select auth.uid()) and status='requested' and completed_at is null
  );
-- Ni anon ni clientes pueden UPDATE/DELETE/TRUNCATE.
-- Un administrador de datos tramitará el borrado mediante backend seguro,
-- con verificación de identidad, revisión fiscal y retirada de fotos y comentarios.
