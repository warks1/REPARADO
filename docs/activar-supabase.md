# REPARADO · Activación segura de Supabase (beta)

La web de GitHub Pages puede funcionar en **modo demostración local**. Para atender solicitudes de clientes, registrar fotos, gestionar operarios y guardar avisos de forma compartida, se requiere un **proyecto Supabase real**. Los tests del repositorio **no instalan** nada en Supabase; las migraciones se aplican mediante una operación separada sobre el proyecto de pruebas.

## 1. Identificar el proyecto

Abre el panel de Supabase y confirma que el proyecto que vas a usar pertenece a REPARADO. Si quieres que ChatGPT lo compruebe directamente, conéctalo mediante la integración de Supabase y autoriza el espacio de trabajo adecuado. No compartas contraseñas, `service_role`, tokens privados ni claves de administración en el chat.

**Estado comprobado el 21/10/2026:** creado el proyecto independiente **REPARADO Test**, en París (UE), con PostgreSQL 17. El esquema, migraciones V4–V11 y almacenamiento privado están instalados. La auditoría de 20 controles ha resultado correcta. Todavía no está enlazado a la web pública ni se han probado cuatro cuentas reales de Auth. No se ha instalado nada en producción.

## 2. Base aislada de pruebas

Antes de intentar producción:

1. Crea un proyecto Supabase **de pruebas**, preferentemente en región UE, con datos totalmente ficticios y una copia/backup seguro de cualquier proyecto antiguo antes de migrar.
2. En una instalación nueva, ejecuta `schema.sql` en el SQL Editor. En instalaciones antiguas, compara primero el esquema y evita repetir bloques que puedan sustituir políticas adaptadas sin revisión.
3. Aplica **en orden** `supabase/migration-v4.sql`, `supabase/migration-v5.sql`, `supabase/migration-v6.sql`, `supabase/migration-v7.sql`, `supabase/migration-v8.sql`, `supabase/migration-v9.sql`, `supabase/migration-v10.sql`, `supabase/migration-v11.sql` y `supabase/migration-v12.sql`. El esquema base ya contiene parte de V4–V6, por eso conviene revisar las diferencias y confirmar la compatibilidad.
4. Si V7 o V9 rechazan la instalación por registros históricos incompatibles, **no fuerces la migración** ni elimines datos. Revisa en privado los duplicados de agenda o de numeración y sus propietarios.
5. Aplica `supabase/storage-photos.sql` y confirma que el bucket `request-photos` es **privado**. Prueba la subida/lectura con clientes diferentes y con operarios asignados y no asignados.
6. Ejecuta **`supabase/auditoria-readonly-v9.sql`** desde SQL Editor. Devuelve veinte filas con columnas `control`, `resultado` y `detalle`. Deben indicar **OK**; los resultados PENDIENTE deben revisarse antes de pasar a datos reales. El archivo es solo lectura y devuelve información agregada, no nombres ni direcciones.

## 3. Verificación de cuatro usuarios ficticios

Prueba **dos clientes distintos**, **un operario** y **un administrador**. El registro web crea exclusivamente clientes. El rol de operario/administrador se asigna fuera del frontend, por un administrador con permisos legítimos.

- Cliente A no puede ver solicitudes, fotos, avisos ni facturas del cliente B; los borradores no deben ser públicos.
- Cliente B tampoco puede ver información del cliente A y no puede aceptar su presupuesto.
- Operario ve únicamente servicios asignados y no puede editar precios, reasignarse o consultar facturas de clientes.
- Administrador puede preparar presupuestos, asignar operarios y consultar el panel; no puede leer avisos privados de clientes.
- Dos administradores intentan programar dos visitas al mismo operario con menos de 60 minutos entre inicios. V7 debe confirmar solo una.
- Cambiar una asignación o cancelar una visita crea el aviso interno correcto con V8, siempre que la transacción se confirme.
- El esquema V9 debe rechazar números finales duplicados y bloquear cambios en documentos finalizados. Esto **no autoriza a emitir facturas fiscales** desde la beta.

Estas pruebas de roles se ejecutan automáticamente en GitHub Actions contra **PostgreSQL 16 efímero** mediante `tests/supabase-roles-rls.py`, junto a las pruebas V7, V8 y V9. Una ejecución satisfactoria de pruebas locales **no sustituye** la integración con Supabase real.

## 4. Activar la versión conectada

Añade en los secretos de GitHub Actions del repositorio **solo** los valores públicos de conexión:

- `VITE_SUPABASE_URL`: URL del proyecto.
- `VITE_SUPABASE_ANON_KEY`: clave anon/publicable correspondiente.

El flujo `.github/workflows/deploy.yml` incorpora estas variables al compilar. Después de configurarlas, vuelve a desplegar la web y recompila las aplicaciones móviles que necesiten la conexión. **Nunca** incluyas `service_role`, contraseñas de base de datos u otros secretos de servidor como variables `VITE_*`.

## 5. Límites antes de producción

- No se ha completado el circuito de envío push mediante FCM/APNs.
- La facturación está limitada a consultar documentos de forma informativa. Faltan datos fiscales, emisión legal, series correlativas, rectificaciones, conservación y normativa aplicable.
- Las fotografías de clientes, direcciones y teléfonos son datos personales. Requieren revisión de RGPD, información al usuario, seguridad, conservación, borrado y permisos.
- Las pruebas automáticas en navegadores emulados no sustituyen pruebas físicas en iPhone y Android.

**Criterio de avance:** conectar un proyecto de pruebas real, ejecutar la auditoría y completar los cuatro usuarios ficticios antes de aceptar solicitudes de clientes reales.


## 6. Seguridad RPC (V10)

- La auditoría de Supabase detectó funciones `SECURITY DEFINER` con ejecución permitida al rol anónimo. La migración `supabase/migration-v10.sql` revoca ese permiso, restringe las funciones internas que solo deben ejecutar disparadores y añade índices para consultas por cliente y operario.
- El cliente autenticado conserva las tres funciones imprescindibles: `accept_reparado_quote`, `is_reparado_admin` e `is_reparado_staff`. Estas pueden aparecer en advertencias informativas de Supabase por ser funciones con permisos elevados, pero su acceso debe limitarse a `authenticated`.
- Repite `supabase/auditoria-readonly-v9.sql` después de V10. Pese al nombre histórico del fichero, ahora devuelve **20 verificaciones**. Ninguna de ellas modifica datos.


## Acceso por invitación en la versión conectada

En la beta conectada, el formulario de registro público **no se muestra por defecto**. Los clientes y profesionales invitados mantienen la pantalla «Entrar» para iniciar sesión.

- La variable de compilación `VITE_REPARADO_ALLOW_PUBLIC_REGISTRATION` es opcional y vale `false` por defecto. Solo el valor exacto `true` habilita el formulario de alta pública. En **REPARADO Test** debe permanecer en `false`.
- **Importante:** ocultar el formulario no cierra el endpoint Auth. Para bloquear registros ajenos a las invitaciones, en el Dashboard de REPARADO Test abre Authentication → Providers/Sign In y desactiva la opción que permite nuevos registros de usuarios. Debe verificarse allí antes de invitar cuentas.
- Invita a dos correos de prueba que controles para clientes, uno para operario y otro para administrador mediante Authentication → Users → Invite User. **No insertar filas manualmente en `auth.users`** ni inventar contraseñas.
- Cada invitación crea inicialmente el perfil con rol `customer`. Los roles `operator` y `admin` solo se cambian después de confirmar la identidad, desde un procedimiento administrativo autorizado, nunca desde el navegador.
- Para probar las invitaciones utiliza una compilación local o un entorno de previsualización aislado, con `VITE_SUPABASE_URL` y la clave **publicable** correspondientes. No agregues las credenciales del proyecto Test a los secretos usados por el despliegue público de GitHub Pages.
- Verifica con esas cuatro cuentas reales los permisos de RLS, fotos privadas, presupuestos, agenda y notificaciones. Las pruebas automáticas PostgreSQL no reemplazan el flujo de Supabase Auth ni el correo real.

## 7. Acceso privado a datos (V11)

REPARADO Test tiene aplicada la migración `supabase/migration-v11.sql`. Se ha confirmado directamente en Supabase que `anon` no puede leer, insertar, actualizar ni borrar filas de ninguna de las seis tablas de la aplicación. Las políticas RLS continúan activas para usuarios autenticados, y el bucket `request-photos` sigue siendo **privado**. La auditoría contiene **20 comprobaciones, todas OK**.

**Límites:** los endpoints de Auth y la API Supabase continúan técnicamente accesibles por Internet, protegidos mediante permisos y autenticación; esto no es aislamiento de red ni significa que se haya desactivado el registro de nuevos usuarios. Si el objetivo es impedir nuevos registros, configúralo desde los ajustes de Authentication del Dashboard antes de ofrecer invitaciones a cuentas de prueba. No se puede asegurar desde esta migración SQL. Mantener la web publicada en modo demostración sin enlazarla al proyecto Test.


## 8. Primer acceso y recuperación de contraseñas (interfaz conectada)

La aplicación conectada permite que una persona **invitada** establezca su propia contraseña (mínimo 12 caracteres), y ofrece «¿Has olvidado tu contraseña?» para pedir a Supabase un enlace de recuperación. La contraseña se envía al servicio oficial `supabase.auth.updateUser`; no se guarda en los formularios, en GitHub ni en ninguna tabla REPARADO. Los enlaces deben ser verificados por Supabase Auth antes de mostrar el cambio de contraseña.

Antes de probar con correos de prueba controlados:

1. Confirma que el registro abierto esté desactivado en **Authentication → Providers/Sign In**. Esta condición es de servidor; `VITE_REPARADO_ALLOW_PUBLIC_REGISTRATION=false` solo oculta el formulario.
2. En <https://supabase.com/dashboard/project/kpmmlzjvespenogqtujo/auth/url-configuration> configura una **Site URL** para la app privada de pruebas y añade esa URL a **Redirect URLs**. Por ejemplo, al probar localmente con Vite, `http://127.0.0.1:5173/**`. No redirijas invitaciones del proyecto Test a GitHub Pages público ni expongas claves privadas.
3. Invita los cuatro correos de pruebas desde el apartado **Authentication → Users**. El alta por invitación puede depender de la configuración y los límites del correo SMTP. Cada nueva cuenta obtiene inicialmente el rol `customer` mediante el trigger de perfiles.
4. Completa la invitación en un navegador privado, establece la contraseña y vuelve a entrar. Para la recuperación, solicita el enlace desde la pantalla «Entrar», ábrelo desde ese mismo entorno y cambia la contraseña. Comprueba que un enlace caducado no concede acceso.
5. Con dos clientes, operario y administrador, comprueba que las políticas RLS impiden ver solicitudes, avisos o facturas ajenas. Las elevaciones de rol solo se realizan desde administración autorizada, nunca con el formulario web.

**Límite confirmado:** la conexión de ChatGPT a Supabase no permite cambiar los ajustes del servicio Auth ni crear/invitar usuarios por el flujo administrativo. La prueba de login real debe realizarse tras autorizar las invitaciones desde Supabase. Los tests de navegador de este repositorio usan exclusivamente credenciales ficticias y no envían correos.


## 9. Fotografías privadas: validación de rutas (V12)

La migración `supabase/migration-v12.sql` refuerza la lectura y subida de imágenes en el bucket `request-photos`. Una fotografía solo es accesible si la ruta consta de exactamente dos carpetas, la primera identifica al **cliente real de la solicitud** y la segunda el identificador de dicha solicitud. No basta con conocer o falsificar un prefijo de carpeta.

- Clientes: pueden subir y leer únicamente sus fotos asociadas a solicitudes propias.
- Operarios: pueden leer fotos únicamente de los servicios asignados, sin poder subir fotografías en nombre del cliente.
- Administradores: pueden leer fotografías vinculadas correctamente a solicitudes existentes, no rutas falsas ni documentos huérfanos.
- Visitantes sin sesión: no pueden leer ni subir fotos. El bucket continúa **privado**, con límite de 8 MB por imagen.

**Orden en instalaciones existentes:** tras V11 y `supabase/storage-photos.sql`, aplicar V12; en instalaciones limpias el archivo `storage-photos.sql` ya incorpora las mismas políticas reforzadas. No ejecutar políticas antiguas después de V12. Si existen fotos heredadas con rutas incorrectas, la migración dejará de mostrarlas: revisar previamente sus rutas sin convertirlas en públicas. No se han movido ni borrado objetos.

Las pruebas automáticas de `tests/supabase-roles-rls.py` incluyen rutas incoherentes, carpetas extra, clientes cruzados, operario asignado/no asignado y administrador en PostgreSQL efímero. La validación de Storage real mediante sesiones Auth y enlaces firmados sigue pendiente de realizar con las cuentas autorizadas.
