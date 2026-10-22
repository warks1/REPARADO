-- REPARADO V15 · Moderación por administradores de opiniones auténticas.
-- Requiere V13. No crea, altera ni publica las 32 opiniones ficticias.
-- La lectura general sigue limitada a cinco columnas no identificativas.
-- Los clientes no adquieren permisos de moderación.
do $v15$
begin
  if to_regclass('public.customer_reviews') is null then
    raise exception 'REPARADO_V15_REQUIRES_V13';
  end if;
end
$v15$;

revoke update on public.customer_reviews from anon, authenticated;
grant update (status) on public.customer_reviews to authenticated;

drop policy if exists "reviews admin read moderation" on public.customer_reviews;
create policy "reviews admin read moderation" on public.customer_reviews
  for select to authenticated
  using ((select public.is_reparado_admin()));

drop policy if exists "reviews admin update status" on public.customer_reviews;
create policy "reviews admin update status" on public.customer_reviews
  for update to authenticated
  using ((select public.is_reparado_admin()) and status='pending')
  with check ((select public.is_reparado_admin()) and status in ('approved','rejected'));

-- Solo puede aprobarse/rechazarse una reseña pendiente.
-- La RLS actúa en el servidor: ocultar botones en el navegador no autoriza nada.
-- UPDATE(status) no concede UPDATE sobre identidad, texto, estrellas ni solicitud.
-- La API pública no expone customer_id ni request_id.
