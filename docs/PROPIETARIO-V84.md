# REPARADO V95 · Panel del propietario

## Cómo entrar
Iniciar sesión con la única cuenta que tenga el rol **admin** en Supabase.
Tras autenticar, REPARADO abre automáticamente **Panel del propietario**.
También se puede volver a él mediante el botón **⚙ Panel propietario** de la
cabecera o desde **Mi perfil → Panel del propietario**.

Las cuentas **customer** y **operator** no tienen este botón ni acceso a las
rutas privadas del propietario. Los operarios conservan su zona de trabajo
**Gestión interna** con permisos limitados; los clientes mantienen la
interfaz de contratación. **No asignar rol admin a otras personas** si el
panel debe ser exclusivo del titular.

## Funciones disponibles

- **Solicitudes nuevas** y **sin operario**: bandejas completas paginadas,
  recuentos desde Supabase y acceso a formularios de gestión.
- **Presupuestos**: consulta, cálculo e importes con IVA incluido; la
  aceptación corresponde al cliente. Los trabajos no se programan
  hasta aceptar el presupuesto.
- **Calendario semanal V88**: selección de operario, acceso desde el directorio
  de técnicos a su agenda, navegación a cualquier semana mediante fecha y
  botón para volver a la semana actual. El filtro solo afecta a las citas
  visibles y al operario sugerido al programar un trabajo aceptado; **no**
  cambia permisos ni oculta trabajos del servidor. Vista de lunes a domingo,
  Cataluña; listar
  visitas programadas y en curso, seleccionar un trabajo aceptado,
  asignar operario y día/hora, cambiar asignación o fecha. Se usan
  comprobaciones previas de intervalo y el disparador transaccional V7
  para rechazar solapamientos con menos de 60 minutos entre inicios.
  La hora se convierte con zona `Europe/Madrid` y detecta cambios DST.
- **Mensajes de clientes (V90)**: bandeja de conversaciones privadas con
  una fila por cliente, ordenada por el último mensaje; paginación de hasta
  30 conversaciones por bloque y acceso al chat para responder.
  Usa la RPC `reparado_owner_conversations`, de tipo SECURITY INVOKER,
  con comprobación explícita de administrador y políticas RLS.
  Si la función aún no está instalada, conserva temporalmente la bandeja
  anterior por mensajes individuales; **los errores de autorización nunca
  habilitan este modo alternativo**. No se inventan cifras de no leídos.
- **Directorio de clientes y operarios V89**: 30 perfiles por página,
  búsqueda por **nombre o teléfono** con resultados paginados desde
  Supabase, limpieza para volver a listar todos los perfiles; abrir
  chat de cliente o el calendario filtrado del técnico.
  El buscador no lee `auth.users` ni muestra correos o contraseñas,
  y no modifica RLS, roles ni datos de contactos.
- **Trabajos terminados y facturación**: documentos y borradores
  de factura privados; **no** se emiten facturas fiscales automáticas.
- **Incidencias de clientes** y **reseñas**: acceso a los módulos
  de moderación ya existentes.
- **Correo externo**: acceso a Outlook para consultar manualmente los
  buzones. **REPARADO todavía no tiene integración de lectura de email**.
  Los correos no se almacenan ni sincronizan en el panel.

Los diez indicadores (solicitudes, presupuestos, servicios, incidencias,
reseñas y perfiles de clientes/operarios) consultan recuentos exactos; si la base no responde,
se muestran guiones y error de conexión, no ceros inventados.

## Límites y pasos siguientes

- **Agenda V87: carga progresiva de todos los registros disponibles.**
  Se muestran inicialmente hasta 200 visitas de la semana y 50 presupuestos
  aceptados, y aparecen botones **Mostrar más visitas** y
  **Mostrar más presupuestos aceptados** cuando puede haber más registros.
  Cada pulsación consulta el siguiente bloque manteniendo los anteriores,
  con orden estable y detección de fin de lista. Los fallos de conexión
  no borran lo ya cargado. En una semana con muchos registros, cargar
  bloques adicionales manualmente evita saturar móviles y tablets.
  La paginación no sustituye la base de datos ni convierte los listados
  en información en tiempo real: usa **Actualizar** si otros usuarios
  han modificado o reordenado solicitudes mientras se consultaban.
- El panel usa **solo la cuenta con rol admin**; la protección efectiva
  de consultas y escrituras depende de **RLS de Supabase**. Los
  tests móviles usan sesiones y respuestas **ficticias**, no clientes
  reales. Verificar permisos reales antes de producción.
- No se ha instalado una integración de Outlook, pasarela de cobros,
  facturación fiscal validada ni avisos push remotos en producción.
  No afirmar que ya funcionan.
- Si se requiere una cuenta propietaria diferente de otras futuras
  cuentas admin, implantar una autorización de propietario separada
  en base de datos, no ocultar únicamente un botón.

## Instalar la bandeja de conversaciones V90

Ejecutar `supabase/migration-v90-owner-inbox.sql` en un entorno de pruebas
**después de las migraciones de mensajes y roles**. Es aditiva: crea una RPC,
no cambia los textos, perfiles ni permisos existentes. Verificar los grants
(`anon` sin EXECUTE; `authenticated` con EXECUTE, pero acceso solo cuando
`is_reparado_admin()` devuelve verdadero) y probar con cliente, operario y
administrador.

En producción, usar una migración revisada y aplicada explícitamente; si aún
no se ha ejecutado, el panel continúa mostrando mensajes individuales y lo
indica como modo compatible. Esta RPC **no integra Microsoft Outlook** ni
identifica mensajes no leídos. No registrar en logs las conversaciones.

## V91 · Lectura real de conversaciones

La bandeja V91 muestra las conversaciones **pendientes de leer** cuando
existen mensajes nuevos del cliente posteriores a la última lectura
confirmada del propietario; distingue **Leído** en caso contrario.
La marca se registra en Supabase tras cargar correctamente la página más
reciente del chat. La carga fallida o una página antigua no pueden marcar
una conversación como leída, y un estado más reciente nunca retrocede.

Migración aditiva: `supabase/migration-v91-owner-read-state.sql`. Crea
`owner_conversation_reads` con RLS, políticas solo para administradores y una
RPC `reparado_mark_owner_chat_read` de tipo SECURITY INVOKER, que valida que el
mensaje pertenece al cliente antes de guardar la marca. Extiende la RPC
V90 para devolver `has_unread` real. El estado es por administrador y no
se comparte con clientes ni operarios.

Si la V91 no se instala, la V90 sigue mostrando las conversaciones pero
sin insignias de lectura; en ningún caso REPARADO inventa estados «leído»
o «no leído». No es una integración de email externo de Outlook.

## V92 · Historial operativo completo

Las pantallas **Todos, Pendientes, Agenda, En curso y Finalizados** del panel
interno ya no dependen de la lista de los 150 trabajos recientes para mostrar
sus resultados. Consultan cada filtro en Supabase con su estado y paginan
de **50 en 50**, con total exacto de trabajos en el filtro abierto.

La agenda se ordena por fecha de visita; las demás vistas, por creación
descendente e ID estable. Los operarios consultan únicamente servicios con
su `operator_id`, además de las políticas RLS existentes.

**Distinguir contadores:** la zona de resumen y los números de pestañas
no seleccionadas reflejan los últimos 150 servicios, salvo Nuevas y Sin
operario, que tienen recuentos exactos. El filtro abierto y su navegador de
páginas muestran el **total real** confirmado por Supabase, no el parcial.
Las vistas específicas Nuevas y Sin operario conservan su paginación
anterior. Guardar cambios mantiene la página actual cuando es posible.

## V94 · Indicadores completos en Gestión interna

La pantalla «Gestión interna» ya no utiliza los 150 registros recientes para
calcular sus cifras ni los totales de las pestañas. Cada contador (Todos,
Nuevas, Pendientes, Agenda, En curso y Finalizados) ejecuta una consulta
`HEAD` con `count: 'exact'` y el mismo filtro de estado que el listado. En el
panel del titular, «Sin operario» mantiene su recuento exacto independiente.

Las cuentas de operarios reciben **únicamente sus recuentos** por
`operator_id`, sujetos también a RLS de Supabase. La cuarta tarjeta del
resumen del operario muestra «Terminados» en lugar de un contador
«Sin operario», que no le corresponde.

Se eliminó la consulta adicional que descargaba hasta 150 fichas completas,
incluidos teléfonos y direcciones, solo para contar trabajos. Los contadores
de ahora no transfieren datos de clientes y los listados siguen paginados
de 50 en 50. Una caída o un error de permisos muestra una incidencia
y un botón para reintentar, **nunca un cero inventado**.

Los totales son una lectura puntual del servidor, no cifras de tiempo real:
actualizar el panel después de cambios realizados por otro usuario.
No se alteran precios, roles, políticas RLS, ni se emiten facturas fiscales.

## V95 · Buscar reparaciones en el historial interno

El propietario y los operarios pueden buscar por **nombre del servicio,
población o teléfono** dentro de los listados Todos, Pendientes, Agenda,
En curso y Finalizados. Los resultados se filtran en Supabase
**antes de paginar**, por lo que se puede localizar un trabajo antiguo
sin recorrer todas las páginas.

- El filtro tiene longitud máxima de 64 caracteres. No se admiten
  comodines SQL aportados por el usuario y los campos son una lista cerrada.
- Cada operario consulta exclusivamente servicios asignados a su
  `operator_id` más las RLS del servidor, sin acceso a fichas de terceros.
- El botón **Mostrar todos** limpia la búsqueda y recupera el listado.
- Al cambiar de pestaña o iniciar sesión otra persona, se reinicia la
  búsqueda para evitar confusión o reutilizar filtros ajenos.
- Los números de las pestañas y el resumen superior **siguen siendo los
  totales generales**, no el subconjunto encontrado. El número real de
  coincidencias aparece junto al buscador y a la paginación.
- Las bandejas Nuevas y Sin operario mantienen su funcionamiento
  específico e independiente. No se modifican datos al buscar.

No se integra Outlook ni facturación fiscal ni se modifica el backend.
