# REPARADO V100 · Parte de trabajo del operario

## Operativa diaria

1. El propietario asigna un servicio y su fecha al operario desde su calendario.
2. El operario inicia sesión en REPARADO con su cuenta y entra en **Mi perfil → Gestión interna**. En un servicio **Programado**, toca **Abrir servicio y parte**.
3. Pulsa **Iniciar trabajo**. El servicio pasa a **En curso** y el servidor registra la fecha de inicio.
4. Escribe la descripción de la reparación, las comprobaciones y el resultado. Puede usar **Guardar descripción** para conservarla antes de cerrar.
5. Sube fotografías del resultado (JPG/PNG/WEBP/HEIC, máximo 8 MB por archivo y hasta 8 fotos por parte desde la interfaz). Es posible añadir fotos mientras siga **En curso**.
6. Para terminar, escribe como mínimo 20 caracteres y asegúrate de que exista al menos una fotografía guardada. Pulsa **Terminar y cerrar servicio**. El servidor comprueba la asignación y la foto; el estado pasa a **Terminado** y se registra la hora de cierre. El parte queda en modo lectura.

El propietario abre **Panel interno** y el botón **Ver parte de trabajo** de cada encargo. Puede consultar la descripción y las fotografías privadas, incluidas las de servicios terminados. Los clientes no acceden a este panel; las fotos del trabajo están separadas de las fotos aportadas por los clientes en sus solicitudes.

## Seguridad y comportamiento

- La migración `supabase/migration-v100-operator-work-reports.sql` habilita la tabla `public.work_reports` con RLS, el bucket **privado** `work-photos`, las políticas de Storage y las RPC `reparado_start_work` y `reparado_complete_work` con **SECURITY INVOKER**.
- Un operario no puede crear partes ni subir fotos de otros servicios, ni cambiar el precio o el operario. Si el trabajo se reasigna o se cierra desde otra sesión, la operación no se confirma.
- El servidor rechaza cerrar un trabajo de operario sin explicación suficiente y sin al menos una imagen, incluso si una versión antigua de la interfaz intenta actualizar solo el campo `status`.
- Cada fichero se identifica por huella SHA-256 para evitar duplicados por reintentos. No se permite reemplazar ni borrar fotos desde el cliente. Los enlaces a fotos se firman para **120 segundos**, no son URLs públicas permanentes.
- El límite de 8 fotografías se aplica en la interfaz, no como cuota independiente en Storage; el límite de 8 MB y los tipos MIME están definidos también en el bucket del servidor.
- La descripción es un parte interno, **no una factura**. No crea números fiscales ni presupuestos nuevos.

## Despliegue y comprobación

La migración V100 se ha instalado y verificado en **REPARADO Test**. El chequeo del servidor confirmó tabla RLS, bucket privado, dos funciones de invocador y dos políticas de Storage. Una prueba transaccional ficticia confirmó que el servidor devolvía `false` al intentar finalizar sin fotografía; se revirtió y no se guardaron registros de prueba.

Para activar V100 en una instancia comercial de Supabase se debe ejecutar **la misma migración** en ese proyecto tras comprobar las migraciones previas, probar con cuentas reales separadas (cliente, operario, propietario), configurar la retención y eliminación de fotos de intervenciones, revisar el estado de los certificados de iOS/Android y verificar RLS desde cada perfil. Una interfaz funcional en GitHub Pages no prueba que la base de datos comercial esté conectada.

Pruebas de código: `tests/operator-work-v100.test.mjs`; prueba de navegador `e2e-private/operator-work-v100.spec.mjs`. CI: `.github/workflows/qa-operator-work-v100.yml`.

## Trabajos que ya estaban en curso antes de V100

Si el servicio aparece **En curso** pero no tiene parte anterior, el operario asignado verá **Preparar parte de trabajo**. Esa acción crea el parte sin volver a pasar el servicio por Programado y sin cambiar su estado existente. Solo después se habilitan descripción, subida de fotos y cierre. No se inventa una fecha antigua de inicio: el parte puede mostrar cuándo se creó por primera vez.

## V101 · Recuperación de fotografías y confirmaciones visibles

- Después de subir imágenes, el panel **vuelve a consultar Storage** antes de confirmar cuántas fotos hay realmente en el parte. El resultado informa de fotografías nuevas, existentes y fallidas.
- En una subida parcialmente fallida, las imágenes que sí se guardaron siguen visibles. El operario puede volver a seleccionar las fallidas; la huella SHA-256 evita crear otra copia de una foto que ya existe.
- **Actualizar parte y fotografías** recarga el estado del servidor sin perder el texto aún escrito en la descripción. Si la lectura falla por conexión, aparece **Reintentar carga**.
- La confirmación de inicio, guardado, fotos o cierre queda visible **después** de redibujar la pantalla. No se muestra éxito sin confirmar la respuesta del servidor.
- Pruebas de navegador V101: un intento de subir dos fotos con un fallo de red simulado guarda solo una, informa del error y permite el segundo intento sin duplicados. Ningún paso usa cuentas comerciales.

## V102 · Cámara del móvil y cuota obligatoria de fotos en Supabase

El operario puede utilizar la galería o **Hacer una foto ahora (móvil)**.
Este segundo selector solicita la cámara trasera cuando el navegador o
dispositivo lo admite; en otros dispositivos puede abrir un selector de
archivos. La imagen pasa por la misma validación y subida privada, y debe
estar guardada en el servidor antes de cerrar el servicio.

**Cambio crítico de seguridad:** el máximo de 8 fotos no queda solo en la
interfaz. La migración
`supabase/migration-v102-work-photo-quota.sql` impone la cuota al insertar
cada objeto en Supabase Storage, incluso desde clientes antiguos o
peticiones directas. Se comprueba el identificador del operario, la
asignación, el estado «En curso», la ruta, la extensión y el recuento.
Un bloqueo transaccional del parte evita aceptar subidas simultáneas
por encima de la cuota.

El recuento de metadatos se implementa en una función limitada a un esquema
**no expuesto** `reparado_private`, para evitar RLS recursiva en
`storage.objects`. La función no es ejecutable por `anon`. El bucket
`work-photos` sigue siendo privado y con tipos MIME y tamaño máximo
restringidos. No se han ampliado permisos de lectura ni de borrado.

**Verificado en REPARADO Test:** un operario asignado inició un servicio
ficticio, se aceptaron 8 objetos de prueba, el noveno fue rechazado por el
servidor y la transacción completa se revirtió. No quedaron trabajos ni
imágenes ficticias. El script reproducible y reversible está en
`tests/work-photo-quota-v102.sql`.

**Para producción:** ejecutar V100 antes de V102 en Supabase comercial,
validar el resultado con cuentas separadas y revisar políticas de
eliminación/retención del material fotográfico antes de aceptar trabajos
reales. El servicio de facturación fiscal y la publicación en tiendas
siguen siendo tareas independientes.
