# Reparado · Puesta en producción

Estado: interfaz web y APK Android de pruebas generadas. **No desplegar a clientes reales** hasta completar las dependencias externas y estas verificaciones.

## Base de datos y seguridad
1. Crear un proyecto propio de Supabase en una región adecuada para operar en España/UE.
2. Aplicar, en una base de pruebas, `schema.sql` y después `supabase/migration-v4.sql`, `supabase/migration-v5.sql`, `supabase/migration-v6.sql`, **`supabase/migration-v7.sql`, `supabase/migration-v8.sql` y `supabase/migration-v9.sql`** en ese orden. El esquema incorpora parte de v4; comprobar que las migraciones son repetibles antes de aplicarlas al entorno definitivo. La V7 instala la protección de reservas simultáneas en PostgreSQL y comprueba antes que no existan conflictos.
3. Ejecutar `supabase/storage-photos.sql` para crear un bucket **privado** para imágenes.
4. Ejecutar `supabase/auditoria-readonly-v9.sql` y revisar sus quince controles de solo lectura; todos deben estar en **OK** antes de recibir solicitudes reales. Instrucciones detalladas: `docs/activar-supabase.md`.
5. Probar por separado **dos clientes**, `operator` y `admin`, así como las restricciones RLS: un cliente no puede ver solicitudes, avisos o facturas de otro; un operario únicamente ve los trabajos asignados y solo administración puede asignar personal y modificar precios. El test automático `tests/supabase-roles-rls.py` prueba este aislamiento en un PostgreSQL temporal, pero no equivale a haber probado tu Supabase real.
6. Verificar el registro, inicio de sesión, confirmación de email, recuperación de contraseña y las acciones de aceptación de presupuesto.
7. Crear o asignar el rol administrador exclusivamente desde el backend con privilegios de administración. Nunca habilitar la elección de rol desde un formulario de cliente.

## Conectar la app y el despliegue
1. Configurar en GitHub Actions las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como secretos de repositorio. La clave anónima/publicable puede exponerse en el cliente, pero **nunca** incluir la clave `service_role`, claves de administración o contraseñas en Vite ni en GitHub Pages.
2. Ejecutar de nuevo el flujo de publicación web y el flujo de Android, porque las variables `VITE_*` se incorporan **en el momento de compilar**. Una APK generada antes de configurar las variables seguirá funcionando solo en local.
3. Crear una solicitud de prueba desde el formulario, añadir fotos, revisar el trabajo desde una cuenta administradora, asignar un operario y comprobar la agenda del cliente y del operario.
4. Probar mensajes, estados, presupuestos, facturas, notificaciones internas y el filtrado por usuario. Verificar que cualquier error de red produce mensajes entendibles y no confirmaciones falsas.

## Agenda y asignación (validaciones de la beta)
- La interfaz comprueba de nuevo en Supabase las visitas `scheduled` y `in_progress` del operario antes de guardar. Rechaza inicios separados por menos de 60 minutos para prevenir dobles asignaciones; ese margen **no sustituye** la duración real de las reparaciones ni los tiempos de desplazamiento.
- Para pasar a `scheduled` o `in_progress` se exige una cuenta de operario válida y una fecha/hora asignada.
- **Servidor (V7, pendiente de instalar en el Supabase real):** `supabase/migration-v7.sql` implementa un trigger protegido con bloqueo transaccional por operario (`pg_advisory_xact_lock`). Verifica que el perfil sea `operator`, exige operario y fecha en visitas `scheduled` / `in_progress` y rechaza otra visita activa con menos de 60 minutos entre inicios. Se ha probado con dos conexiones PostgreSQL concurrentes usando el aislamiento por defecto `READ COMMITTED`: solo una pudo reservar.
- **No equivale a instalación en la base real.** GitHub Pages no ejecuta migraciones de PostgreSQL; es necesario aplicar V7 explícitamente en Supabase de pruebas y después, tras aprobar la revisión, en el entorno de destino. Las reglas anteriores de la interfaz siguen siendo una comprobación adicional, no la garantía definitiva.
- La migración V7 se niega a instalarse si hay citas programadas sin operario/fecha, operarios inválidos o conflictos históricos. Corregir los registros y repetir la instalación; no desactivar el control preventivo.
- **Concurrencia y operación:** ensayar con conexiones Supabase reales, roles `admin` y `operator`, dos usuarios simultáneos, zonas horarias y reprogramaciones. El bloqueo V7 está diseñado para transacciones PostgreSQL `READ COMMITTED`; cualquier integración que utilice niveles de aislamiento personalizados debe comprobarse por separado. La separación fija de 60 minutos no calcula desplazamientos ni duración real.
- Si no puede consultarse la agenda, el panel bloquea el guardado de la nueva programación en lugar de asumir disponibilidad. Revisar con cuentas `admin` y `operator` reales, cambios de estado y límites de zonas horarias.

## Avisos a operarios (migración V8, pendiente de instalar)
- `supabase/migration-v8.sql` incorpora avisos **internos** a la tabla privada `notifications` cuando se asigna un trabajo al operario, se programa o cambia su visita, comienza el trabajo, se retira su asignación o se cancela. No cambia los permisos de acceso ni revela dirección o teléfono en los mensajes.
- Los avisos se insertan en la misma transacción que el cambio de solicitud. Si V7 rechaza una reserva incompatible, V8 no creará un aviso engañoso. El SQL es repetible y se verifica contra PostgreSQL de pruebas.
- Para activarlo hay que ejecutar V8 **después de V7** en un proyecto Supabase asociado, con las políticas de seguridad vigentes, y probar con cuentas reales de cliente, operario y administración.
- No se trata de push remoto: `device_tokens` y el registro de tokens Capacitor no envían automáticamente notificaciones. El envío a dispositivos requiere FCM/APNs, un backend seguro, consentimiento y ensayos en dispositivos.

## Facturación (migración V9, pendiente de instalar)
- `supabase/migration-v9.sql` protege los registros **no borrador** con número único, incluso ante dos inserciones simultáneas. El preflight detecta números históricos duplicados y se detiene sin alterarlos.
- Los documentos finales requieren referencia a solicitud y cliente coherentes, base imponible, IVA único del 21 % y total consistente (redondeo de céntimos); no se admiten otros tipos de IVA sin ampliar el diseño fiscal.
- Los registros ya emitidos quedan bloqueados para edición o borrado en la base de datos. Las rectificativas, anulaciones fiscales y pagos necesitarán un flujo regulado propio; no se simula su emisión desde el navegador.
- Se revocan permisos de `INSERT`, `UPDATE` y `DELETE` de facturas a cuentas públicas. Sólo un backend confiable y auditado podrá crear documentos finales; se conserva la lectura RLS de V6.
- La vista «Mis facturas» sigue siendo informativa y señala discrepancias del desglose, sin generar un PDF ni afirmar validez fiscal.
- Aplicar V9 primero en Supabase de **pruebas**, después de V8, resolviendo previamente los errores que señale. No se ha ejecutado en la base real, porque no hay un proyecto Supabase conectado.
- Antes de emitir legalmente: identificar emisor (NIF, domicilio fiscal), destinatario, serie y numeración correlativa, fecha de operación y expedición, concepto y bases por tipo, rectificaciones, archivo/integridad y requisitos fiscales españoles vigentes. Validarlo con asesoría fiscal.

## Notificaciones, facturación y privacidad
- Los avisos internos registrados en la base de datos no implican **push remoto**. Para enviar push reales deben configurarse FCM y APNs y un backend que mande los avisos de forma autenticada.
- Revisar numeración de facturas, IVA, datos fiscales, exportación/PDF, anulaciones y obligaciones legales antes de facturar.
- Preparar política de privacidad, condiciones de contratación, retención y borrado de datos, seguridad de imágenes y derechos de los interesados. Probar el tratamiento de datos personales antes de admitir clientes.

## Android
- La acción `Reparado Android beta APK` genera una APK debug para instalar y probar.
- Para Google Play faltan firma de publicación, cuenta de desarrollador, assets definitivos, pruebas físicas, configuración final de notificaciones y revisión de las políticas de la tienda.

## Apple / iPhone
- La acción `Reparado iOS simulator check` intenta compilar una aplicación para el simulador. **No instala una IPA en un iPhone físico.**
- Para distribución real se necesita cuenta Apple Developer, firma, perfiles, App Store Connect/TestFlight, configuración de notificaciones APNs y pruebas de dispositivo.

## Criterio de publicación final
La app estará lista para clientes solo cuando se hayan ejecutado y aprobado las comprobaciones de conexión, privacidad, roles, archivos, pagos/facturas (si se habilitan), notificaciones y distribución en dispositivos reales. Una compilación correcta por sí sola no garantiza esas comprobaciones.
