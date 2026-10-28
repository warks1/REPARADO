# REPARADO · V43 · Comprobar altas públicas antes de distribuir la app

Mientras REPARADO solo admita acceso por **invitación**, no debe publicarse una app que oculte el botón de registro pero permita altas directamente por la API de Supabase.

## V57 · Bloqueo de destinos y claves inseguras

Antes de consultar `/auth/v1/settings`, el verificador confirma **de forma independiente** que la URL pertenece a un subdominio directo `*.supabase.co`, que no es **REPARADO Test**, que no incluye credenciales, puertos o rutas y que la clave es publicable o `anon` (nunca de servidor). Si falla cualquier condición, no se inicia ninguna petición HTTP.

Si el servidor devuelve el campo `external.anonymous_users`, solo se acepta el booleano `false`. Como no todas las versiones de Auth publican este campo, su ausencia **no demuestra** que las altas anónimas estén desactivadas: es obligatorio comprobarlo también en el Dashboard antes de autorizar la publicación.

## Comprobación automática sin crear cuentas

El proceso de firma de Android e iOS ahora consulta el endpoint público `GET /auth/v1/settings` del **proyecto de producción** indicado mediante las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. El endpoint devuelve `disable_signup`.

- Si devuelve `disable_signup: true`, la comprobación pasa siempre que no confirme accesos anónimos habilitados.
- Si responde `false`, no responde o falta el campo, **la firma y publicación se detienen**.
- También se bloquea cuando `external.anonymous_users: true` o hay errores de conexión.
- No realiza un registro de prueba, no envía emails, no descarga datos personales ni imprime la clave pública.
- Se ejecuta en **ambos** trabajos de `.github/workflows/store-release.yml`, antes de generar los paquetes comerciales. No afecta al modo demostración de GitHub Pages.

El chequeo no sustituye el análisis de las políticas RLS y de contraseña. La protección de contraseñas filtradas **no puede comprobarse con este endpoint**.

## Configuración pendiente en Supabase

1. En el proyecto de producción (no **REPARADO Test**), ir a **Authentication → Sign In / Providers** y desactivar **Allow new users to sign up** si el acceso seguirá por invitación.
2. Desactivar cuentas anónimas y revisar proveedores sociales habilitados.
3. En **Authentication → Attack Protection**, activar la protección contra contraseñas filtradas, según disponibilidad de plan.
4. Ensayar invitación, recuperación e inicio/cierre de sesión con las cuentas autorizadas en un navegador y un dispositivo real.
5. Ejecutar el workflow firmado de tiendas solo después de completar las verificaciones operativas y legales.

**Si en el futuro se quieren altas públicas de clientes**, habrá que diseñar y aprobar ese cambio conscientemente (confirmación de correo, abuso, política de privacidad, verificación de roles y captcha). No desactivar la comprobación automática como atajo.

Documentación técnica: [Supabase Auth · ajustes](https://supabase.com/docs/guides/auth/general-configuration) y [GoTrue GET /settings](https://supabase.github.io/auth/#endpoints).
