# REPARADO V55 — Cierre de sesión local y protección contra doble pulsación

## Problema corregido
Supabase JavaScript utiliza `signOut()` con alcance `global` por defecto: pulsar «Cerrar sesión» en un teléfono podía terminar también las sesiones del mismo usuario en otros dispositivos.

## Cambio
La salida manual utiliza `supabase.auth.signOut({scope:'local'})`, después de intentar revocar los tokens de push del dispositivo actual. De esta manera se conserva la sesión en el otro teléfono/ordenador y se mantiene la validación del token local antes de salir.

Se añade `signOutPending` para impedir que dos toques consecutivos intenten dos revocaciones simultáneas. La marca siempre se libera al acabar, incluso después de un error de red, para poder reintentar.

## Validación
- `npm test`: incluye `tests/local-signout-v55.test.mjs`, las pruebas de V54 y el resto de las regresiones.
- `npm run build`: comprobación web.
- Revisión manual necesaria con la misma cuenta en dos dispositivos físicos: cerrar A, comprobar que B sigue conectado, iniciar otra cuenta en A; probar toque doble y pérdida de red.

## Límites
- No habilita push remotos ni crea un backend de producción.
- Un administrador puede requerir una operación separada de «Cerrar sesión en todos los dispositivos», que deberá diseñarse con confirmación expresa y políticas de seguridad; **no** convertir el botón normal en cierre global.
- Los tokens JWT ya emitidos pueden ser válidos hasta caducar. No confundir cierre local con revocación inmediata universal.
- REPARADO Test permanece aislado del despliegue público y los requisitos de seguridad de Supabase Auth siguen pendientes hasta comprobarlos en el Dashboard.

Referencia técnica: https://supabase.com/docs/guides/auth/signout
