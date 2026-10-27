# REPARADO V45 · Añadir una visita al calendario

La sección **Agenda** ofrece el botón **«Descargar cita para calendario»** en cada visita con estado `scheduled` y fecha/hora confirmada.

Al pulsarlo se genera localmente un archivo `.ics` estándar (iCalendar) que se puede abrir/importar en aplicaciones de calendario compatibles. **No se añade directamente a la agenda del sistema ni se activa una notificación push del servidor**: el usuario debe abrir el archivo y confirmar su incorporación según el sistema operativo.

## Contenido

- Nombre del servicio y referencia estable de la visita.
- Hora de inicio en UTC: se adapta al huso horario al abrir el archivo en el calendario.
- Bloque provisional de **una hora** para poder ver la cita; **no representa la duración real del trabajo**.
- Recordatorio sugerido **una hora antes**: depende del calendario que importe el evento.
- Instrucción de consultar los datos actualizados dentro de REPARADO.

**Privacidad:** el documento no incluye dirección exacta, teléfono, correo, nombre del cliente ni nombre del operario. El usuario obtiene la cita desde la consulta filtrada por su cuenta, con RLS en Supabase. Si cambia de sesión o de pantalla se ignora la respuesta antigua.

**Cambios de hora o cancelaciones:** la app no controla los calendarios externos. Si la cita cambia o se cancela, el usuario tendrá que actualizar/eliminar el evento importado. No anunciar sincronización automática bidireccional.

## Ensayos antes de producción

1. Cuenta cliente A con una visita programada: descargar e importar archivo en Android/iPhone.
2. Comprobar que otro cliente B no puede obtener una cita de A; revisar permisos RLS.
3. Confirmar que la hora visualizada coincide con la del servidor, incluso al cambiar entre horarios de verano/invierno.
4. Probar que el sistema ofrece guardar el archivo en Safari iOS, Chrome Android, Capacitor iOS y Capacitor Android; algunos WebView necesitan un flujo de compartir propio.
5. Confirmar que una visita cancelada o terminada no ofrece botón, y que el recordatorio depende del calendario del dispositivo.

Los tests automáticos comprueban la sintaxis del archivo, control de longitud de línea UTF-8, rechazo de inyección, ausencia de datos personales y aislamiento básico entre sesiones.

## V46 · Compartir la cita en iPhone y Android

En una aplicación Capacitor nativa, el botón «Añadir cita a mi calendario» abre el **menú de compartir de iOS/Android** con un archivo temporal `.ics` generado en `Directory.Cache` mediante los plugins oficiales `@capacitor/filesystem` y `@capacitor/share`. El usuario elige el calendario o la aplicación receptora y confirma la importación. **No se solicita permiso general para leer o modificar el calendario** y REPARADO no afirma haber añadido la cita por sí sola.

En un navegador web se conserva la descarga estándar del archivo. Si el dispositivo no admite compartir, o falla la escritura local, la app muestra un error y no anuncia éxito. La interfaz bloquea los clics simultáneos y descarta mensajes de sesiones ya cerradas. El archivo temporal del móvil se programa para borrarse **dos minutos después de cerrar el menú**, para permitir que el destinatario termine de leerlo; la caché puede conservarlo excepcionalmente si el sistema suspende la app.

Los archivos nativos de desarrollo deben regenerarse con `npx cap sync` después de instalar los nuevos plugins. Para la publicación en App Store, revisar e incluir el **PrivacyInfo.xcprivacy** correspondiente al uso de Filesystem (categoría FileTimestamp y motivo admitido según la documentación actual de Capacitor), además de cualquier declaración requerida por otros plugins.

**Pendiente:** validar en iPhone y Android físicos con Calendario, Google Calendar y una aplicación que no admita `.ics`, además de confirmar el comportamiento del diálogo al cancelar y la política de privacidad. No afirmar compatibilidad universal por las pruebas unitarias.
