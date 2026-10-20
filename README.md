# Reparado — recuperación funcional desde GitHub (20-10-2026)

Esta versión recupera **los archivos originales existentes en el historial** del repositorio (commit `f06acd2`, 9-10-2026), corrige el arranque de Vite y prepara el despliegue. **No equivale al paquete posterior `Reparado-Integracion-v3.zip`**; ese archivo no se ha podido recuperar aquí.

## Probar la aplicación

- Node.js 22 o superior
- `npm install`
- `npm run dev`
- `npm run build` para compilar

### GitHub Pages

El flujo `.github/workflows/deploy.yml` compila y despliega desde `main`.
En **Settings → Pages**, selecciona **GitHub Actions** como origen.
La URL pública debería ser `https://warks1.github.io/REPARADO/` cuando Pages esté habilitado y el flujo termine con éxito.

### Demo vs producción

Sin `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se inicia una demostración local: las solicitudes quedan únicamente en el almacenamiento del navegador. **No se envían a técnicos**. Los precios son orientativos y muestran IVA incluido. No se aceptan pagos en esta beta.

Para probar con Supabase, revisa y ejecuta `schema.sql` en una base de datos de pruebas y configura esas dos variables públicas de Vite en el entorno de construcción. Nunca publiques secretos `service_role`. La implementación de Storage para fotos, envío push, facturación fiscal, roles y operaciones administrativas todavía necesita pruebas de integración y revisión de seguridad antes de producción.

### Dispositivos móviles

El proyecto mantiene `capacitor.config.ts` y dependencias de Capacitor para continuar los empaquetados iOS/Android; **no hay APK o IPA publicado**.

### Cambios de esta recuperación

- Recuperados los nueve archivos del commit original.
- Corregida la ruta de arranque `./main.js` (antes apuntaba a `./src/main.js` inexistente).
- Definido el contenedor principal de la vista conectada; corregido el botón Volver.
- Escapado HTML en el historial de solicitudes del modo demostración.
- Añadido flujo de GitHub Actions, `.gitignore` y `.env.example`.
- Endurecida la política inicial de perfiles para impedir la autoasignación de rol y evitar recursión de RLS.

El paquete **Integración v3** puede sustituir esta base cuando estén disponibles sus archivos exactos.

## Mejoras del 20-10-2026 (segunda revisión)

- Corregida la sintaxis de SQL en `is_reparado_staff()` (la versión anterior tenía delimitadores rotos).
- Pantalla conectada reorganizada en `connected.js`: sin dependencias de variables globales implícitas por ID.
- Panel interno real básico para cuentas con rol `admin` o `operator`: lista de solicitudes, operarios, fecha y estado, agenda, Google Maps.
- Solicitudes conectadas: subida de hasta cuatro fotografías a un bucket privado. Para activar esta función, ejecutar `supabase/storage-photos.sql` en Supabase.
- Vista para consultar fotos de solicitudes desde el panel interno (enlaces privados temporales).
- Navegación e inputs adaptados a pantallas táctiles; ocultación del registro push en navegadores web.

**Importante:** Estas funciones conectadas requieren un proyecto Supabase real, aplicar `schema.sql` y `supabase/storage-photos.sql`, y configurar credenciales. El modo demostración guarda solicitudes solo en este navegador, sin asignaciones ni fotos reales. Panel interno, push y facturación fiscal requieren pruebas de integración antes de producción. El SQL inicial no sustituye a un sistema de migraciones versionadas y no se ha ejecutado contra tu Supabase.


### Revisión de seguridad y comunicación
- Chat de respuesta del personal a clientes desde cada solicitud (requiere Supabase, nunca modo demo).
- El cliente ya no puede establecer el precio real ni la asignación al crear una solicitud. El precio solo lo confirma el personal desde el panel y se muestra con IVA incluido.
- Volver a ejecutar `schema.sql` en el proyecto Supabase de pruebas para aplicar los permisos por columna.
- **Sin validación contra una base de datos real, no se considera listo para producción.**

### Mejoras del registro y perfil
- Formulario de registro con confirmación de contraseña, sin ventanas emergentes que muestran secretos.
- Nombre y teléfono editables desde el perfil sin poder cambiar el rol.
- Los nuevos registros son siempre cuentas de cliente; las de administrador/operario se provisionan aparte desde Supabase.

### Ajustes de navegación y precios
- El menú móvil distribuye los botones en una rejilla accesible, evitando que queden fuera de pantalla.
- Los presupuestos con importe confirmado de 0 € se muestran como 0,00 € y no como «Por presupuesto»; los servicios que requieren valoración siguen indicándolo.

#### Configuración obligatoria de Supabase
1. Crea un proyecto en Supabase y ejecuta `schema.sql` (instalación nueva) o `supabase/migration-v4.sql` (actualización). Aplica `supabase/storage-photos.sql` para las fotos.
2. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como **secrets** del repositorio para la compilación. No uses la clave `service_role` en el frontend.
3. Los roles de personal deben asignarse desde el SQL Editor por el administrador. Una cuenta creada en la web siempre es cliente. Comprueba con tres cuentas separadas los permisos y avisos antes de atender solicitudes reales.

## V5: avisos para el equipo
- Una solicitud nueva genera avisos internos a las cuentas de administrador.
- Los mensajes del cliente generan un aviso al administrador y a los operarios con un trabajo activo asignado de ese cliente.
- Si el cliente acepta un presupuesto, el administrador recibe aviso.
- **Supabase existente:** aplicar `supabase/migration-v4.sql` y después `supabase/migration-v5.sql`. **Supabase nuevo:** ejecutar `schema.sql` que ya contiene las dos migraciones, y `supabase/storage-photos.sql` para fotos.

## V6: consulta de facturas
- En Perfil > Mis facturas se consultan las facturas registradas para el cliente que no están en borrador, mostrando base, IVA y total.
- La aplicación no genera todavía documentos fiscales ni PDFs firmados; no debe utilizarse como sistema de facturación fiscal definitivo.
- Para una instalación existente, tras V4 y V5, ejecuta también `supabase/migration-v6.sql`. Para una instalación nueva basta `schema.sql` y, opcionalmente, el SQL de fotos.

### Catálogo
- Buscador y filtro por fontanería, albañilería, parquet y reformas en el modo conectado.
- Los precios unitarios de revestimientos y parquet muestran expresamente «€/m²». La superficie y el presupuesto definitivo deben verificarse antes de confirmar la visita; el catálogo no calcula un total automáticamente.

### Acceso desde el móvil
- Se ha añadido icono SVG propio (paleta, metro y tubería), un manifiesto web y metadatos para acceso desde la pantalla de inicio.
- El manifiesto permite presentación tipo aplicación donde el navegador lo admita, **sin sustituir las compilaciones nativas Android/iOS**. No se ha añadido un service worker para evitar servir versiones antiguas almacenadas en caché.


## Interfaz visual de cliente (boceto elegido)

- Pantalla inicial como el diseño aprobado: cabecera Reparado naranja, búsqueda, banner, categorías Fontanería, Albañilería y Pladur, Parquet y Reformas.
- Iconos vectoriales con microanimaciones (respetan `prefers-reduced-motion`); fichas de categoría con servicios reales del catálogo y precios orientativos con IVA incluido.
- Navegación inferior fija con Inicio, Solicitudes, Agenda, Chat y Perfil; adaptable a Android, iOS, tablets y web.
- Solicitud cliente con dirección, teléfono, descripción, fotos, fecha y horario preferido. El horario queda incorporado en la descripción de la solicitud para mantener compatibilidad con la base actual.
- Sin credenciales Supabase, se muestra la **misma interfaz de cliente** y se pueden probar flujos y guardar solicitudes **solo localmente**; no se finge el envío real al equipo. Para atender solicitudes reales hay que configurar Supabase.

- La gestión administrativa continúa accesible desde Perfil para cuentas de personal autorizado, sin añadir opciones internas al menú público de cinco pestañas.

### Fidelidad respecto a la referencia
Se han ajustado el texto de portada, la proporción 2×2 de categorías y el orden y descripción de servicios. No se han inventado los precios ni sustituido los datos reales por los del boceto. La coincidencia total de las ilustraciones todavía está pendiente.

### Recursos visuales de referencia
Se ha incorporado `public/mirror-atlas.webp`, un atlas comprimido construido con recortes de la imagen de referencia que el propietario compartió. Sustituye en la portada las ilustraciones vectoriales aproximadas por los dibujos del propio boceto y añade fotografías de fontanería en sus fichas. El atlas es de resolución limitada por proceder de una captura; los textos, precios y botones permanecen independientes y funcionales. En móvil, el banner se reproduce visualmente desde el recorte; en escritorio conserva su composición adaptable.

## Paleta viva del boceto (octubre de 2026)
La nueva hoja `vivid-theme.css` se carga después de `customer-theme.css` y ajusta azules, naranjas, verdes y violetas para parecerse más a la imagen aprobada. Mantiene el contenido, servicios y botones existentes; incrementa saturación, brillo y contraste de los recortes gráficos en CSS, y conserva la preferencia del dispositivo de reducir animaciones. Esto es un ajuste visual, no una prueba de identidad píxel a píxel ni una validación en teléfonos físicos.

### Filtros de categoría
El icono de ajustes situado al final del buscador permite abrir y cerrar accesos directos a las cuatro categorías. El control funciona tanto en el flujo local como en el conectado; no es un elemento decorativo.

### Continuidad de solicitud tras identificarse
En el modo conectado, si el cliente elige un trabajo antes de iniciar sesión, Reparado conserva esa selección durante el acceso y muestra su formulario al identificarse. La autenticación se resuelve únicamente a través del evento `SIGNED_IN` para evitar que dos cargas simultáneas redirijan al usuario a la portada.


## Validación responsive automatizada (Android y iPhone)
`npm run test:visual` ejecuta Playwright con Chrome móvil emulado a 390 px (tamaño tipo iPhone), 412 px (tamaño tipo Android) y 820 px (tablet). Se prueban la portada, cuatro categorías, el menú inferior, la presencia de las imágenes, el filtro, el formulario y el botón Volver. Las capturas se guardan como artefacto de GitHub Actions durante siete días. La ejecución emula pantallas; no sustituye una prueba en un dispositivo iOS o Android real, ni certifica que las imágenes coincidan píxel por píxel con el boceto.

### Corrección basada en capturas móviles
La auditoría visual automatizada detectó que el estilo SVG `overflow: visible` dejaba pintar fuera del recorte la imagen completa del atlas en las cuatro tarjetas. Se fuerza el recorte y el aislamiento en cada ilustración, se elimina el texto duplicado del banner y se comprueba el estilo de recorte mediante Playwright antes de publicar.

Las pruebas visuales ahora guardan, además de Inicio, una captura de la pantalla **Fontanería** para compararla con el segundo teléfono del boceto.


### Servicio destacado y listado completo
La categoría muestra primero cuatro servicios tal como se ve en el boceto seleccionado. Un botón «Ver todos los servicios» despliega el resto sin eliminar ninguno; se conservan las denominaciones técnicas e importes originales en el formulario y la base de datos. Esta interacción tiene pruebas automatizadas en móvil.

### Ilustraciones independientes del boceto
Las cuatro tarjetas utilizan imágenes WebP recortadas directamente de la referencia facilitada, guardadas en `public/categories/`. Ya no se dibujan desde regiones compartidas del atlas y se eliminan los fragmentos cruzados. La cabecera de cada categoría sigue utilizando un SVG adaptable. El banner y las miniaturas de servicios siguen pendientes de mayor resolución.

### Fotografías de los cuatro servicios principales de Fontanería
Las miniaturas de fugas, desatascos, termos y grifería se incluyen como cuatro WebP independientes en `public/services/`, extraídos de la referencia; se comprueba su carga en iPhone, Android y tablet.


## APK de prueba para Android
GitHub Actions ejecuta el flujo «Reparado Android beta APK» tras cambios de la app o desde «Run workflow». Instala Java 21, compila la web con Vite, crea la plataforma Android con Capacitor 8 y ejecuta Gradle para producir `app-debug.apk`. El resultado estará disponible durante 14 días como artefacto `Reparado-Android-Beta-Debug-APK` en la ejecución de GitHub Actions. Es una APK **debug para pruebas**: no está firmada como versión de tienda, no es adecuada para distribución pública y requiere instalar manualmente desde el móvil. Si no existen los secretos VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, conserva el modo de almacenamiento local y no envía solicitudes al personal. Para iOS, el proyecto contiene Capacitor iOS, pero faltan el proyecto compilado, la firma Apple Developer, las pruebas en dispositivo y la distribución TestFlight/App Store.


## Comprobación iOS sin firma
La acción `Reparado iOS simulator check` utiliza un runner Mac, genera el proyecto Capacitor iOS y compila un `.app` para el simulador de Xcode (sin código de firma). Se conserva en GitHub como artefacto durante 14 días si supera la compilación. **No es una aplicación instalable directamente en iPhone**: para TestFlight o App Store hará falta el certificado/perfil de Apple Developer, un identificador de paquete verificado y pasar las pruebas de privacidad, permisos, notificaciones y publicación.

### Búsqueda completa de servicios
El buscador utiliza el mismo filtro en la app conectada y en el modo local. Encuentra reparaciones por nombre de servicio o por categoría, muestra resultados fuera de los cuatro destacados y permite pasar a la solicitud directamente. La búsqueda local se valida con pruebas de navegación.

## Puesta en producción de Reparado
Consultar [`docs/production-readiness.md`](docs/production-readiness.md) para la configuración de Supabase, pruebas de seguridad, notificaciones y las publicaciones Android y Apple. Las apps nativas de pruebas no deben distribuirse como versiones finales sin esas comprobaciones.

### Cabecera 3D original de Fontanería
Se incluye `public/hero-plumbing.webp`, recorte con bordes suavizados del grifo 3D del boceto original. El título, la descripción y el botón de volver siguen siendo HTML accesible, sin convertir la página completa en una captura.


### Recuperación al arrancar y pruebas sobre la compilación final
La versión de cliente incluye un guardián de arranque independiente del bundle JavaScript: si falla la carga o no hay contenido tras nueve segundos, se presenta una pantalla visible con botón «Volver a intentar», sin borrar las solicitudes locales. Se conserva la portada de inmediato cuando hay una conexión Supabase lenta. Playwright ahora ejecuta `vite build` seguido de `vite preview` y comprueba **la compilación de producción**, incluye un escenario con JavaScript bloqueado y prueba datos locales dañados. Las pruebas no sustituyen un diagnóstico en WebView real de Android/iOS.


### Identidad nativa del icono
Los flujos de compilación Android e iOS generan ahora los iconos adaptativos y recursos de inicio desde `assets/icon.svg`, que coincide con la casa naranja de Reparado. Se utiliza el generador oficial `@capacitor/assets` tras crear y sincronizar el proyecto con Capacitor. Los iconos se actualizan en cada nueva compilación nativa, en lugar de mantener los de Capacitor por defecto.

### Pruebas de compatibilidad con iPhone / Safari
Se ha añadido WebKit al conjunto de pruebas en GitHub Actions. Las mismas comprobaciones de inicio, errores de carga, catálogo, formularios y navegación se ejecutan sobre un navegador Safari/WebKit automatizado, además de Chromium. Esto aproxima el entorno del navegador iPhone, aunque no sustituye un dispositivo Apple real.


### Arranque real de GitHub Pages, incluido el navegador Safari/WebKit
La acción `Verificar Reparado publicado en iPhone y Android` se ejecuta cuando termina la publicación de Pages y abre **la URL pública**, tanto normal como con un parámetro de actualización. Comprueba que aparezcan la portada y las cuatro categorías y guarda errores de carga de JavaScript o de red. El botón de recuperación ahora fuerza una URL sin caché y presenta un código de fallo para diagnosticar el navegador integrado de iPhone. La prueba usa Safari/WebKit emulado y no prueba el navegador de ChatGPT dentro de iOS.
