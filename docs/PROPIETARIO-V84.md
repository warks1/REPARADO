# REPARADO V90 · Panel del propietario

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
