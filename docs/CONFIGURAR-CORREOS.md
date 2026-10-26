# REPARADO · Correos oficiales y avisos de reparación

## Destinatarios confirmados

| Uso | Correo |
|---|---|
| Fallos de la app, problemas técnicos y ayuda | **reparado_soporte@outlook.es** |
| Nuevas solicitudes y consultas de reparación | **reparado_clientes@outlook.es** |

Las direcciones son **destinatarios**, no contraseñas de inicio de sesión o direcciones desde las que pueda enviar automáticamente un servidor.

### Lo que ya funciona sin proveedor de correo

- En la versión conectada y en la demostración, los clientes pueden pulsar **Comunicar un fallo de la app** y abrir el programa de correo de su móvil, con el destinatario de soporte y asunto preparados.
- También aparece **Consultas y solicitudes de reparación** con el buzón `reparado_clientes@outlook.es`.
- El usuario **debe pulsar Enviar en su app de correo**; abrir el enlace `mailto:` no envía nada automáticamente.
- En el formulario de reparación conectado, la solicitud se guarda en Supabase. **No depende del cliente enviando un email** y conserva sus fotos en el almacenamiento privado.

### Avisos automáticos por correo de cada nueva solicitud

**Preparados en código, pendientes de activar.** El circuito es:

1. Al crear un registro en `public.service_requests` se encola de forma atómica una referencia en `public.request_email_outbox`.
2. La tabla está protegida con RLS y sin permisos de lectura, escritura o actualización para clientes ni anónimos.
3. Una función de servidor `reparado-mail-worker` reclama un aviso en exclusiva, consulta solo el ID, servicio y municipio, y envía un correo mediante un proveedor transaccional de email (implementación compatible con la API de **Resend**).
4. El destinatario es **reparado_clientes@outlook.es**. El mensaje evita incluir teléfono, dirección, descripción o fotografías: el personal autorizado consulta esos datos en el panel privado.
5. Los fallos de envío se conservan en cola con reintentos limitados y la petición utiliza clave de idempotencia, por lo que no se debe duplicar el correo en cada reintento.

**No afirmar que ya se entregan correos:** sin API key, remitente verificado, función desplegada y trabajo programado no se envía ningún correo desde el backend.

## Activación en un entorno de producción independiente

1. Utilizar el proyecto **Supabase de producción** distinto de REPARADO Test, con roles, RLS, Auth y fotos validados. Aplicar `supabase/migration-request-email-outbox.sql` tras las migraciones de solicitudes y seguridad.
2. Configurar un remitente bajo un **dominio que sea del titular** y verificarlo en un proveedor de correo transaccional como Resend. El destinatario `@outlook.es` **no necesita cambiar**; el remitente puede ser una dirección bajo otro dominio verificado. No utilizar `reparado_clientes@outlook.es` como remitente si no está autorizado/verificado para ello.
3. Crear en **Supabase Edge Function Secrets** los siguientes secretos; **jamás** ponerlos en `VITE_*` ni publicarlos:
   - `RESEND_API_KEY`: token del proveedor.
   - `REPARADO_EMAIL_FROM`: dirección remitente verificada, por ejemplo `avisos@dominio-propio.example` (ejemplo, no dirección activa).
   - `REPARADO_MAIL_WORKER_SECRET`: cadena aleatoria de al menos 32 caracteres.
   - Variables automáticas de Supabase, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` únicamente en entorno de servidor, nunca en el cliente.
4. Desplegar `supabase/functions/reparado-mail-worker/index.ts` en el **mismo proyecto** con `supabase functions deploy reparado-mail-worker --no-verify-jwt`. Es seguro desactivar la verificación JWT del gateway en este caso **únicamente** porque el código rechaza las llamadas sin el secreto propio enviado en la cabecera `x-reparado-worker-secret`. Revisar permisos y logs.
5. Crear en **Supabase Cron** una tarea (p. ej., cada 2 minutos) que envíe POST a `https://<ref>.supabase.co/functions/v1/reparado-mail-worker` con cabecera `x-reparado-worker-secret` y el valor del secreto desde **Supabase Vault** o el mecanismo de gestión de secretos del proyecto. No escribir el secreto en código, archivos o SQL público.
6. Hacer una solicitud **de prueba** con cliente autenticado, comprobar que aparece en el panel, que el email llega a `reparado_clientes@outlook.es` (también comprobar spam), que solo se envía una vez y que el estado pasa a `sent`. Probar fallos/reintentos y recuperación del proveedor. Confirmar protección RGPD y acceso administrativo.

Si no se dispone de dominio propio ni API de correo, no activar el worker. La cola puede guardar avisos para enviarlos cuando la infraestructura esté configurada, pero **no sustituye consultar las solicitudes en el panel de REPARADO**.

## Apple Developer y Google Play Console

- Como ya existe cuenta **Apple Developer**, en App Store Connect se puede poner `reparado_soporte@outlook.es` como correo de atención al cliente, y el enlace web público de asistencia de la app debe seguir siendo accesible.
- **Google Play Console:** crear la cuenta desde [play.google.com/console/signup](https://play.google.com/console/signup) utilizando la cuenta de Google del propietario. Existe una cuota única de registro de **25 USD** y Google exige seleccionar cuenta personal u organización y verificar identidad/datos. Algunas cuentas personales nuevas tienen que superar una prueba cerrada antes de publicar. Documentación oficial: https://support.google.com/googleplay/android-developer/answer/6112435?hl=es.
- Al crear la ficha en Play Console, usar `reparado_soporte@outlook.es` para asistencia sobre la app, y mantener `reparado_clientes@outlook.es` en los flujos de solicitudes, no como correo de asistencia técnica.
- Nunca compartir contraseñas de Apple, Outlook, Google, certificados o claves privadas en el chat ni en el repositorio público.
