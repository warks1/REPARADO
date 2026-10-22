# Reparado · Puesta en producción

Estado 21/10/2026: web y APK beta generadas. **REPARADO Test** (París, UE) tiene migraciones V4–V11, bucket privado, auditoría SQL **20/20** y auditoría de cuatro cuentas **10/10** correctas. Existen dos clientes, un operario y un administrador con correos confirmados y roles asignados. Se verificó un circuito SQL real con `ROLLBACK`, sin dejar solicitudes de prueba. **Faltan** la comprobación del registro público de Auth en el Dashboard, la prueba de inicio de sesión e invitaciones por correo y las verificaciones legales y de dispositivos; **no desplegar a clientes reales**.

## Base de datos y seguridad
1. Crear un proyecto propio de Supabase en una región adecuada para operar en España/UE.
2. Aplicar, en una base de pruebas, `schema.sql` y después `supabase/migration-v4.sql`, `supabase/migration-v5.sql`, `supabase/migration-v6.sql`, **`supabase/migration-v7.sql`, `supabase/migration-v8.sql`, `supabase/migration-v9.sql`, `supabase/migration-v10.sql`, `supabase/migration-v11.sql` y `supabase/migration-v12.sql`** en ese orden. El esquema incorpora parte de v4; comprobar que las migraciones son repetibles antes de aplicarlas al entorno definitivo. La V7 instala la protección de reservas simultáneas en PostgreSQL y comprueba antes que no existan conflictos.
3. Ejecutar `supabase/storage-photos.sql` para crear un bucket **privado** para imágenes y después `supabase/migration-v12.sql` para asegurar que las rutas pertenecen a la solicitud y al cliente correctos.
4. Ejecutar `supabase/auditoria-readonly-v9.sql` y revisar sus veinte controles de solo lectura; todos deben estar en **OK** antes de recibir solicitudes reales. Instrucciones detalladas: `docs/activar-supabase.md`.
5. Probar por separado **dos clientes**, `operator` y `admin`, así como las restricciones RLS: un cliente no puede ver solicitudes, avisos o facturas de otro; un operario únicamente ve los trabajos asignados y solo administración puede asignar personal y modificar precios. El test automático `tests/supabase-roles-rls.py` prueba este aislamiento en un PostgreSQL temporal, pero no equivale a haber probado tu Supabase real.
6. **Acceso privado por invitación:** la pantalla conectada oculta el registro público por defecto. `VITE_REPARADO_ALLOW_PUBLIC_REGISTRATION=false` es solo una medida visual: desactivar también los nuevos registros en **Supabase Auth** mediante su panel de ajustes. Invitar las cuatro cuentas de pruebas desde Auth, nunca insertar usuarios mediante SQL. Verificar inicio de sesión, confirmación del correo, recuperación de acceso y presupuestos con usuarios reales de prueba.
7. Crear o asignar el rol administrador exclusivamente desde el backend con privilegios de administración. Nunca habilitar la elección de rol desde un formulario de cliente.


**Control adicional de acceso (21/10/2026):** `supabase/auditoria-cuentas-test-v12.sql` verifica diez condiciones agregadas (4 perfiles y correos confirmados, 2 clientes, 1 operario, 1 administrador, RLS, anónimo sin permisos, fotos privadas y RPC autenticadas). Resultado en REPARADO Test: **10/10 OK**. Los permisos de los cuatro roles y la secuencia solicitud → presupuesto → asignación → aviso se comprobaron mediante suplantación SQL de JWT **dentro de una transacción revertida**; esto no sustituye probar Supabase Auth desde un navegador. **No consta invitación por correo** (`invited_at` sin fecha) ni está comprobado que el registro público de Auth esté deshabilitado.

## Fotografías protegidas con V12
- La política Storage anterior se basaba parcialmente en el nombre de la carpeta, sin exigir siempre que la solicitud le perteneciese al cliente. V12 exige cliente y solicitud coincidentes para todos los accesos, incluido personal interno.
- Validar **24 controles de solo lectura**: los 20 generales de `supabase/auditoria-readonly-v9.sql` y los 4 de `supabase/auditoria-fotos-v12.sql`. Comprobar subida y lectura binaria reales solo tras conectar un entorno de pruebas protegido, con usuarios invitados.
- Ejecutar `tests/storage-rls-v12.py` en PostgreSQL temporal tras `tests/supabase-roles-rls.py` para verificar que los objetos con rutas falsificadas no pueden verse.

## Conectar la app y el despliegue
1. Configurar en GitHub Actions las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como secretos de repositorio. La clave anónima/publicable puede exponerse en el cliente, pero **nunca** incluir la clave `service_role`, claves de administración o contraseñas en Vite ni en GitHub Pages.
2. Ejecutar de nuevo el flujo de publicación web y el flujo de Android, porque las variables `VITE_*` se incorporan **en el momento de compilar**. Una APK generada antes de configurar las variables seguirá funcionando solo en local.
3. Crear una solicitud de prueba desde el formulario, añadir fotos, revisar el trabajo desde una cuenta administradora, asignar un operario y comprobar la agenda del cliente y del operario.
4. Probar mensajes, estados, presupuestos, facturas, notificaciones internas y el filtrado por usuario. Verificar que cualquier error de red produce mensajes entendibles y no confirmaciones falsas.

## Agenda y asignación (validaciones de la beta)
- La interfaz comprueba de nuevo en Supabase las visitas `scheduled` y `in_progress` del operario antes de guardar. Rechaza inicios separados por menos de 60 minutos para prevenir dobles asignaciones; ese margen **no sustituye** la duración real de las reparaciones ni los tiempos de desplazamiento.
- Para pasar a `scheduled` o `in_progress` se exige una cuenta de operario válida y una fecha/hora asignada.
- **Servidor (V7 instalada en REPARADO Test, no en producción):** `supabase/migration-v7.sql` implementa un trigger protegido con bloqueo transaccional por operario (`pg_advisory_xact_lock`). Verifica que el perfil sea `operator`, exige operario y fecha en visitas `scheduled` / `in_progress` y rechaza otra visita activa con menos de 60 minutos entre inicios. Se ha probado con dos conexiones PostgreSQL concurrentes usando el aislamiento por defecto `READ COMMITTED`: solo una pudo reservar.
- **V7 instalada en REPARADO Test, no en producción.** GitHub Pages no ejecuta migraciones de PostgreSQL. Tras revisar la beta y antes del entorno definitivo, habrá que ejecutar y validar las migraciones en la base de producción por separado. Las reglas anteriores de la interfaz siguen siendo una comprobación adicional, no la garantía definitiva.
- La migración V7 se niega a instalarse si hay citas programadas sin operario/fecha, operarios inválidos o conflictos históricos. Corregir los registros y repetir la instalación; no desactivar el control preventivo.
- **Concurrencia y operación:** ensayar con conexiones Supabase reales, roles `admin` y `operator`, dos usuarios simultáneos, zonas horarias y reprogramaciones. El bloqueo V7 está diseñado para transacciones PostgreSQL `READ COMMITTED`; cualquier integración que utilice niveles de aislamiento personalizados debe comprobarse por separado. La separación fija de 60 minutos no calcula desplazamientos ni duración real.
- Si no puede consultarse la agenda, el panel bloquea el guardado de la nueva programación en lugar de asumir disponibilidad. Revisar con cuentas `admin` y `operator` reales, cambios de estado y límites de zonas horarias.

## Avisos a operarios (V8 instalada en REPARADO Test, no en producción)
- `supabase/migration-v8.sql` incorpora avisos **internos** a la tabla privada `notifications` cuando se asigna un trabajo al operario, se programa o cambia su visita, comienza el trabajo, se retira su asignación o se cancela. No cambia los permisos de acceso ni revela dirección o teléfono en los mensajes.
- Los avisos se insertan en la misma transacción que el cambio de solicitud. Si V7 rechaza una reserva incompatible, V8 no creará un aviso engañoso. El SQL es repetible y se verifica contra PostgreSQL de pruebas.
- Para activarlo hay que ejecutar V8 **después de V7** en un proyecto Supabase asociado, con las políticas de seguridad vigentes, y probar con cuentas reales de cliente, operario y administración.
- No se trata de push remoto: `device_tokens` y el registro de tokens Capacitor no envían automáticamente notificaciones. El envío a dispositivos requiere FCM/APNs, un backend seguro, consentimiento y ensayos en dispositivos.

## Facturación (V9 instalada en REPARADO Test, no en producción)
- `supabase/migration-v9.sql` protege los registros **no borrador** con número único, incluso ante dos inserciones simultáneas. El preflight detecta números históricos duplicados y se detiene sin alterarlos.
- Los documentos finales requieren referencia a solicitud y cliente coherentes, base imponible, IVA único del 21 % y total consistente (redondeo de céntimos); no se admiten otros tipos de IVA sin ampliar el diseño fiscal.
- Los registros ya emitidos quedan bloqueados para edición o borrado en la base de datos. Las rectificativas, anulaciones fiscales y pagos necesitarán un flujo regulado propio; no se simula su emisión desde el navegador.
- Se revocan permisos de `INSERT`, `UPDATE` y `DELETE` de facturas a cuentas públicas. Sólo un backend confiable y auditado podrá crear documentos finales; se conserva la lectura RLS de V6.
- La vista «Mis facturas» sigue siendo informativa y señala discrepancias del desglose, sin generar un PDF ni afirmar validez fiscal.
- Aplicar V9 primero en Supabase de **pruebas**, después de V8, resolviendo previamente los errores que señale. No se ha ejecutado en la base real, porque no hay un proyecto Supabase conectado.
- Antes de emitir legalmente: identificar emisor (NIF, domicilio fiscal), destinatario, serie y numeración correlativa, fecha de operación y expedición, concepto y bases por tipo, rectificaciones, archivo/integridad y requisitos fiscales españoles vigentes. Validarlo con asesoría fiscal.

## Acceso privado a los datos (migración V11)
- **REPARADO Test** tiene instalada `supabase/migration-v11.sql` desde el 21/10/2026: elimina los permisos `SELECT`, `INSERT`, `UPDATE` y `DELETE` para el rol `anon` sobre las seis tablas de la app y la ejecución anónima de funciones del esquema `public`.
- Con RLS activada, el rol `authenticated` sigue pudiendo usar las operaciones y las tres RPC autorizadas. La auditoría de solo lectura ahora tiene **20 controles** y ha resultado correcta en el proyecto de pruebas.
- **Importante:** Supabase continúa sirviendo sus endpoints por Internet; esta protección no equivale a aislamiento de red, no deshabilita registro en Auth y no elimina el acceso de administradores autorizados. Para prohibir nuevos registros, revisar los ajustes de Authentication del proyecto desde el Dashboard antes de activar usuarios reales.
- El bucket `request-photos` es privado. No incluir claves `service_role` en la web ni conectar el entorno Test a GitHub Pages público.

## Seguridad y rendimiento (migración V10)
- Supabase detectó ejecución anónima en funciones internas `SECURITY DEFINER`. La migración `supabase/migration-v10.sql` revoca explícitamente `EXECUTE` de `anon` y de cuentas autenticadas a funciones exclusivas de disparadores, conservando las tres funciones de acceso necesarias para roles y presupuestos solo en `authenticated`.
- Añade siete índices sobre claves externas y consultas por cliente. Se debe volver a ejecutar la auditoría SQL de **20 controles** tras instalarla en el proyecto de pruebas.
- Tras V10, revisar nuevamente el analizador de seguridad y rendimiento de Supabase. Algunas sugerencias sobre optimización RLS pueden seguir pendientes; no relajar las políticas para ganar velocidad.

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


## V13 · Catálogo fotográfico y opiniones verificables (22/10/2026)
- El catálogo incorpora una referencia visual para cada uno de los 37 servicios: conserva las 16 imágenes locales previas y utiliza 21 URLs ilustrativas externas de Pexels con créditos en `public/creditos-fotos-servicios.html`. Las fotos externas no están descargadas localmente ni hay garantía de permanencia; el navegador muestra un símbolo cuando no cargan.
- A partir de V18, la portada no contiene reseñas ficticias: la lista incluye exclusivamente valoraciones reales aprobadas; si está vacía muestra un mensaje informativo y no calcula nota media.
- La migración `supabase/migration-v13.sql` crea `customer_reviews` con RLS: lectura pública limitada a columnas no identificativas y a reseñas aprobadas; un cliente conectado solo puede enviar una reseña para una solicitud suya terminada, con puntuación 1–5 y texto de 12–1000 caracteres. La reseña queda pendiente de moderación. No se permite al cliente aprobar, editar ni borrar.
- En el modo local, la sección permite probar el formulario sin escribir ni transmitir valoraciones. La web conectada necesita V13 aplicada. La publicación real de opiniones debe hacerse desde un administrador de bases autorizado tras evaluar el contenido, no por el cliente.
- Antes de publicar en producción, comprobar licencias de las fotografías, carga móvil, restricciones de propiedad, moderación administrativa y que solo se muestren opiniones aprobadas.

## V15 · Moderación real de reseñas desde la app
- Tras V13, aplicar `supabase/migration-v15.sql` **primero en REPARADO Test**. La migración concede únicamente UPDATE de la columna `status` a usuarios autenticados, con RLS que lo permite solo a `public.is_reparado_admin()`, exclusivamente cuando la opinión sigue `pending` y pasa a `approved` o `rejected`.
- El panel interno y Mi perfil muestran al administrador la opción «Revisar reseñas». El operario y el cliente no reciben esa opción ni permisos del servidor para moderar. El administrador revisa texto, puntuación y fecha; **no puede cambiar el texto ni la nota**.
- Al aprobar, la opinión real aparece en la lista y suma a la media; al rechazar, permanece oculta. La web no genera ni publica reseñas ficticias.
- Ejecutar `tests/reviews-moderation-rls-v15.py` solo después del montaje temporal de `tests/supabase-roles-rls.py` en PostgreSQL local: comprueba autorizaciones y denegaciones para cliente, cliente ajeno, operario, administrador y anónimo. No ejecutar este test en Supabase Test o producción: la prueba local introduce registros ficticios.
- Antes de conectar datos verdaderos, comprobar manualmente en navegador con una cuenta de administrador invitada el flujo enviar → pendiente → aprobar/rechazar → aparecer/no aparecer públicamente. No mostrar reseñas auténticas sin consentimiento adecuado ni publicar datos personales que aparezcan en los comentarios.

## V17 · Valorar desde «Mis solicitudes»
- Una solicitud con estado `completed` muestra al cliente autenticado el botón «Valorar este trabajo».
- El botón abre las reseñas en la portada y preselecciona exclusivamente esa solicitud tras comprobar de nuevo que pertenece al usuario y continúa finalizada en Supabase; no permite puntuar trabajos sin terminar.
- El formulario usa puntuaciones de 1 a 5 estrellas y comentario de 12 a 1.000 caracteres. La valoración real queda en `pending`, y solo administración puede aprobarla con V15.
- Enlaces de acciones no sustituyen RLS: la base de datos comprueba propiedad, estado completado y la restricción de una reseña por solicitud.
- La prueba `e2e-private/customer-review-flow-v17.spec.mjs` utiliza un usuario, dos trabajos y backend **ficticios**. No demuestra un inicio de sesión real, ni introduce contenido en REPARADO Test.

## V18 · Solo reseñas auténticas (22/10/2026)
- Se retiraron las 32 reseñas ilustrativas de código y de la interfaz; se eliminaron sus filtros, estilos y pruebas obsoletas. No hay datos ficticios precargados.
- La portada presenta únicamente opiniones de `customer_reviews` en estado `approved`, con puntuaciones reales de 1 a 5 estrellas. Si no las hay, muestra «Todavía no hay valoraciones reales publicadas», sin puntuación inventada.
- El formulario permanece disponible en el modo conectado para servicios finalizados, con aprobación administrativa. En el modo demostración se puede probar el formulario, pero nunca se publican o guardan reseñas.
- Las pruebas de navegador deben verificar que no existen tarjetas `review-demo` ni filtros de ejemplos y que las reseñas pendientes o rechazadas no se publican.
