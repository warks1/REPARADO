# REPARADO V105 · Solicitudes de supresión y privacidad

## Propósito

El cliente o el operario pueden solicitar la eliminación de su propia
cuenta desde la pantalla de perfil. Hasta V104, esa petición se guardaba
en una cola RLS privada pero el propietario no tenía una bandeja para
consultarla. La V105 añade en el **Panel del propietario** la sección
**Privacidad y supresión de cuentas**.

## Funcionalidad

- Indicador de solicitudes **pendientes** (recibidas o en revisión) en el panel privado.
- Bandeja de solicitudes pendientes (**Recibida** y **En revisión**)
  ordenadas por antigüedad, con paginación real de 30.
- Nombre y teléfono del perfil si el propietario está autorizado para
  consultarlo; en caso contrario, se muestra una referencia de cuenta.
- Histórico de solicitudes cuyo estado se hubiera actualizado a
  `completed` desde un procedimiento administrativo externo.
- Acción **Marcar en revisión** con confirmación, verificación de la
  respuesta del servidor y protección frente a dobles pulsaciones.
- Controles de actualización, paginación y vuelta al panel de propietario.

La operación **NO borra datos**, **NO revoca sesiones**, **NO elimina
fotografías** y **NO marca la solicitud como completada**.

## Seguridad

Migración:
`supabase/migration-v105-owner-deletion-inbox.sql`, aplicada tras
`supabase/migration-store-account-deletion.sql`.

- Las políticas RLS existentes para que cada persona consulte y cree
  únicamente su solicitud permanecen activas.
- Una nueva política permite a **admin** consultar las solicitudes de
  sus usuarios.
- El rol autenticado recibe únicamente permiso de actualización de la
  columna `status`, condicionado por RLS a que el actor sea admin, la
  solicitud esté en `requested` y pase a `in_review`.
- Ningún cliente puede leer o actualizar una solicitud de otro usuario.
- La interfaz no contiene credenciales privilegiadas ni consulta
  `auth.users` desde el navegador.
- Está prohibido actualizar `completed_at` o pasar el estado a
  `completed` mediante el rol autenticado.

La autorización real se decide en Supabase; esconder botones no es
la medida de seguridad.

## Pruebas

- `tests/owner-deletions-v105.sql` ejecuta en una transacción que acaba
  en `ROLLBACK`: creación de petición de prueba como cliente, intento
  de edición rechazado, aislamiento entre clientes, lectura desde admin,
  transición controlada a revisión y rechazo de una falsa finalización.
- `tests/owner-deletions-v105.test.mjs` comprueba las consultas,
  validaciones, contador, la UI y las políticas presentes en el repositorio.
- `e2e-private/owner-deletions-v105.spec.mjs` comprueba la navegación
  en navegadores de iPhone y Android **simulados**.

La prueba realizada en **REPARADO Test** terminó sin dejar solicitudes
ficticias guardadas.

## Pendiente antes de producción

Hace falta un procedimiento seguro, documentado y autorizado para la
eliminación efectiva de datos y fotografías, la conservación de los
registros exigibles por obligaciones legales, la revocación de sesiones
y la confirmación al solicitante. No afirmar que una solicitud está
"completada" antes de ejecutar y verificar esas operaciones. Este
módulo es una bandeja de trabajo, no una función de eliminación
automática ni una certificación de cumplimiento RGPD.

## V106 · Contador de privacidad sin falsas resoluciones

El contador del panel del propietario incluye tanto las solicitudes `requested` como las `in_review`, y solo deja de contarlas cuando constan formalmente como `completed`. Antes, al pulsar «Marcar en revisión», desaparecían del indicador a pesar de no haberse realizado la eliminación.

Esta corrección es de interfaz y consulta: **no concede nuevos permisos, no cambia RLS, no elimina fotografías ni marca solicitudes como finalizadas**. Se comprueba con pruebas unitarias y E2E de iPhone/Android simulados, incluida la vuelta al panel después de cambiar el estado.
