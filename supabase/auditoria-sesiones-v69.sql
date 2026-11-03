-- REPARADO V69 · Estado agregado de cuentas de pruebas (SOLO LECTURA).
-- Ejecutar con permisos administrativos en REPARADO Test, no en la web.
-- No devuelve nombres, correos, teléfonos, IDs, sesiones ni contraseñas.
-- last_sign_in_at acredita únicamente que consta un acceso previo, no
-- que todo el recorrido cliente → operario esté validado.
with expected(role,expected_count) as (
  values ('customer'::text,2),('operator'::text,1),('admin'::text,1)
),
audit as (
  select p.role::text as role,
    count(*)::int as accounts,
    count(*) filter(where u.id is not null)::int as auth_users,
    count(*) filter(where u.email_confirmed_at is not null)::int as confirmed,
    count(*) filter(where u.last_sign_in_at is not null)::int as signed_in_once,
    count(*) filter(where u.invited_at is not null)::int as invited
  from public.profiles p
  left join auth.users u on u.id=p.id
  where p.role in ('customer','operator','admin')
  group by p.role
)
select e.role as tipo_cuenta, e.expected_count as esperadas,
  coalesce(a.accounts,0) as perfiles,
  coalesce(a.auth_users,0) as usuarios_auth,
  coalesce(a.confirmed,0) as correos_confirmados,
  coalesce(a.signed_in_once,0) as con_acceso_registrado,
  coalesce(a.invited,0) as con_invitacion_registrada,
  case when coalesce(a.accounts,0)=e.expected_count
        and coalesce(a.auth_users,0)=e.expected_count
        and coalesce(a.confirmed,0)=e.expected_count
       then 'OK: estructura de cuentas'
       else 'PENDIENTE: revisar cuentas' end as resultado_estructura,
  case when coalesce(a.signed_in_once,0)=e.expected_count
       then 'ACCESOS REGISTRADOS; falta prueba funcional'
       else 'PENDIENTE: inicio de sesion real' end as resultado_accesos
from expected e left join audit a on a.role=e.role
order by case e.role when 'customer' then 1 when 'operator' then 2 else 3 end;
