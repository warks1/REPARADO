# REPARADO V113 · Notificaciones push (Android e iOS)

Cada aviso interno (`public.notifications`) genera una tarea en `public.push_outbox`. El worker `reparado-push-worker` la entrega a **FCM** (Android) y **APNs** (iOS) y borra los tokens que Google/Apple declaran caducados. Texto de la notificación = título y cuerpo ya existentes en la app, recortados a 80/200 caracteres.

## Lo que ya está en el repositorio
- `supabase/migration-v113-push-outbox.sql` (cola, disparador y reclamo atómico; solo `service_role`). Probada en PostgreSQL local: repetible, sin duplicados y sin acceso para clientes.
- `supabase/functions/reparado-push-worker/` (FCM HTTP v1 + APNs con clave `.p8`).
- `scripts/configure-android-push.mjs`: instala `google-services.json` y el permiso `POST_NOTIFICATIONS`; en la compilación de tienda **falla si falta el secreto**.
- `scripts/configure-ios-push.py` + `scripts/link-ios-push.rb`: entitlement `aps-environment` enlazado al target App.

## Lo que debe hacer el propietario (no se puede hacer desde el código)
1. **Firebase** → crear proyecto → añadir app Android `com.ams.reparado` → descargar `google-services.json` → guardarlo en base64 como secreto de GitHub `REPARADO_GOOGLE_SERVICES_JSON_BASE64` (`base64 -w0 google-services.json`, en local).
2. **Firebase** → Configuración → Cuentas de servicio → generar clave privada → guardar su JSON como secreto de Supabase `FCM_SERVICE_ACCOUNT_JSON`.
3. **Apple Developer** → Identifiers → `com.ams.reparado` → activar **Push Notifications** → regenerar el perfil de distribución y actualizar `REPARADO_APPLE_PROFILE_BASE64`.
4. **Apple Developer** → Keys → crear clave **APNs** (`.p8`). Secretos de Supabase: `APNS_KEY_P8` (contenido), `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_TOPIC=com.ams.reparado`, `APNS_ENV=production` (TestFlight y App Store usan production; `sandbox` solo para compilaciones de desarrollo).
5. Secreto de Supabase `REPARADO_PUSH_WORKER_SECRET` (mínimo 32 caracteres aleatorios).
6. Aplicar `migration-v113-push-outbox.sql` en el proyecto **de pruebas** primero y después en producción; desplegar la función con `supabase functions deploy reparado-push-worker`.
7. Programar con Supabase Cron una llamada POST cada minuto a la función con la cabecera `x-reparado-worker-secret`.

## Prueba antes de publicar
Con un teléfono Android y un iPhone reales (TestFlight para iOS): iniciar sesión, aceptar el permiso, crear una solicitud o mensaje que genere un aviso y comprobar que llega con la app cerrada. Probar también cierre de sesión → no debe llegar al dispositivo anterior, y reinstalación (token nuevo).

## Límites
No se ha podido probar la entrega real contra Google ni Apple desde el entorno de desarrollo (sin credenciales ni red): la firma de los JWT y la clasificación de respuestas están probadas con claves de prueba, no con los servidores de los proveedores.
