# REPARADO V54 · Cierre externo de sesión y notificaciones

## Qué corrige
Un cierre de sesión recibido por `onAuthStateChange('SIGNED_OUT')` puede ocurrir sin pasar por el botón «Cerrar sesión» (por ejemplo, limpieza local o un cambio de sesión). Antes, la app descartaba los tokens recordados sin revocación confirmada: el registro remoto podía seguir asociado a la cuenta anterior.

En V54, `pushManager.suspend()` invalida de inmediato los callbacks, retira los listeners nativos y **conserva** los tokens pendientes de baja. No permite activar las notificaciones para otra cuenta mientras queden pendientes. Si el titular anterior vuelve a iniciar sesión, se intenta revocar con la sesión válida antes de solicitar un token nuevo.

El cierre normal mediante el botón conserva su flujo de revocación previa; un fallo de red impide completar ese cierre seguro.

## Comprobaciones
- `npm test`: incluye `tests/push-forced-signout-v54.test.mjs` y las pruebas anteriores V24/V42.
- `npm run build`: comprueba compilación web.
- En móviles físicos comprobar A → cierre normal → B; A → cierre externo → B bloqueado para push; A → nuevo login → revocación → B; respuesta perdida y fallo de red.
- Verificar las RPC de V24 en un backend de pruebas, nunca permitir `service_role` en el cliente.

## Pendiente antes de activar push reales
V54 **no envía notificaciones remotas** y no soluciona por sí sola una revocación imposible tras invalidar la sesión. Antes de habilitar FCM/APNs, el servidor de envíos tendrá que comprobar vinculación, vigencia y revocación del token, y establecer una política de caducidad/limpieza para sesiones revocadas y dispositivos abandonados.

Si el dispositivo cambia de cuenta sin poder reautenticar al propietario anterior, el envío de push permanece bloqueado localmente; se requiere un mecanismo de recuperación seguro y validación en móviles reales. No cerrar el issue #32 hasta completar backend y pruebas.
