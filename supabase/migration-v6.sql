-- Reparado V6: los clientes no pueden consultar borradores de facturas.
drop policy if exists "invoice customer/staff" on public.invoices;
drop policy if exists "invoice customer and admin" on public.invoices;
create policy "invoice customer and admin" on public.invoices for select to authenticated
using ((customer_id=auth.uid() and status<>'draft') or public.is_reparado_admin());
