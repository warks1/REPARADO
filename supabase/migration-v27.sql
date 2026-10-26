-- REPARADO V27 · Evitar crear trabajos repetidos al reintentar tras perder la conexión.
-- Ejecutar DESPUÉS de V19. La columna opcional conserva registros históricos.
-- Seguridad: un cliente sólo puede insertar su clave en una solicitud propia
-- gracias a las políticas RLS existentes; no puede editarla ni borrar trabajos.
do $v27_check$
begin
  if to_regclass('public.service_requests') is null
  then raise exception 'REPARADO_V27_REQUIRES_SERVICE_REQUESTS'; end if;
  if not (select relrowsecurity from pg_class where oid='public.service_requests'::regclass)
  then raise exception 'REPARADO_V27_REQUIRES_RLS'; end if;
end
$v27_check$;

alter table public.service_requests
  add column if not exists client_submission_id uuid;

-- Las solicitudes anteriores tienen NULL; puede haber varias, pero las nuevas
-- claves sólo se pueden usar una vez por cliente. También protege carreras
-- entre dos conexiones/ventanas simultáneas.
create unique index if not exists reparado_request_customer_submission_v27
  on public.service_requests(customer_id,client_submission_id)
  where client_submission_id is not null;

revoke insert (client_submission_id)
  on public.service_requests from anon;
grant insert (client_submission_id)
  on public.service_requests to authenticated;

-- Nunca conceder UPDATE para cambiar una clave y burlar la unicidad.
do $v27_verify$
begin
  if has_column_privilege('anon','public.service_requests','client_submission_id','INSERT')
    or has_column_privilege('authenticated','public.service_requests','client_submission_id','UPDATE')
    or not has_column_privilege('authenticated','public.service_requests','client_submission_id','INSERT')
    or not has_column_privilege('authenticated','public.service_requests','client_submission_id','SELECT')
    or not (select relrowsecurity from pg_class where oid='public.service_requests'::regclass)
  then raise exception 'REPARADO_V27_UNSAFE_COLUMN_PERMISSIONS'; end if;
end
$v27_verify$;
