# REPARADO V84 · Panel del propietario

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
- **Calendario semanal**: vista de lunes a domingo, Cataluña; listar
  visitas programadas y en curso, seleccionar un trabajo aceptado,
  asignar operario y día/hora, cambiar asignación o fecha. Se usan
  comprobaciones previas de intervalo y el disparador transaccional V7
  para rechazar solapamientos con menos de 60 minutos entre inicios.
  La hora se convierte con zona `Europe/Madrid` y detecta cambios DST.
- **Mensajes de clientes**: bandeja de conversaciones en la app, 30
  mensajes por página, abrir un chat, leer historial y responder.
- **Directorio de clientes y operarios**: 30 perfiles por página, nombre y
  teléfono registrados en la app; abrir chat de cliente o el calendario
  para programar al personal. Sin mostrar contraseñas ni emails de Auth.
- **Trabajos terminados y facturación**: documentos y borradores
  de factura privados; **no** se emiten facturas fiscales automáticas.
- **Incidencias de clientes** y **reseñas**: acceso a los módulos
  de moderación ya existentes.
- **Correo externo**: acceso a Outlook para consultar manualmente los
  buzones. **REPARADO todavía no tiene integración de lectura de email**.
  Los correos no se almacenan ni sincronizan en el panel.

Los indicadores consultan recuentos exactos; si la base no responde,
se muestran guiones y error de conexión, no ceros inventados.

## Límites y pasos siguientes

- Las vistas del calendario se limitan explícitamente a **200 visitas
  por semana** y **50 servicios aceptados recientes**. Para ver más,
  acudir a la bandeja «Todos los servicios»; completar la paginación
  histórica sigue siendo pendiente.
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
