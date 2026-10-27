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
