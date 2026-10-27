# REPARADO V44 · Copia privada de datos visibles del cliente

La opción **Mi perfil → Descargar mis datos visibles** permite a una cuenta con rol `customer` descargar un archivo JSON con sus datos consultables desde la aplicación.

## Alcance de la copia

- Perfil propio: nombre, teléfono, rol y fecha de alta.
- Solicitudes propias: servicio, datos de contacto y dirección aportados, estado, agenda e importes del presupuesto.
- Mensajes de los chats de ese cliente.
- Avisos propios.
- Facturas visibles al cliente (sin borradores ni archivos adjuntos).
- Incidencias de soporte propias.
- Estado de la solicitud propia de eliminación de cuenta, cuando existe.

**No equivale a una exportación completa del artículo 15 del RGPD.** No incluye fotografías, archivos adjuntos, algunas valoraciones por las restricciones de lectura de columnas, tokens de sesiones ni datos internos. Para solicitar información adicional el cliente puede escribir a `reparado_soporte@outlook.es`.

## Seguridad y funcionamiento

La exportación requiere una sesión real validada por Supabase Auth al principio y al final. Se ejecuta exclusivamente para cuentas **cliente**: los administradores tienen permisos amplios de lectura y no deben usar este flujo, especialmente en la tabla de incidencias donde la RLS les permite ver información ajena. Las consultas de solicitudes, mensajes, avisos y facturas filtran explícitamente por el identificador de la cuenta. Los registros que tienen propietario visible se validan también después de ser recibidos.

La lectura de las incidencias se basa en la política RLS existente, que para una cuenta `customer` permite únicamente los registros propios. La columna `user_id` de `support_reports` no está concedida para lectura del cliente; por ello no se utiliza como filtro REST. Lo mismo ocurre con la columna de propietario de `account_deletion_requests`: el cliente consulta su única fila propia mediante RLS.

Se descargan lotes de 200 registros por sección, hasta un máximo de 10.000 cada una. Ante fallo de conexión, fallo de permiso, sesión cambiada o exceso de datos, **no se genera ningún archivo parcial**. No se insertan ni cambian filas, no se usan claves de administrador y no se envía el contenido por email o servidores externos.

El documento descargado contiene información personal, incluyendo direcciones y números de teléfono aportados por el usuario; se muestra un aviso para que lo conserve de forma privada. La descarga depende de que el navegador/WebView admita guardar archivos; debe probarse expresamente en iPhone y Android reales antes de considerarla finalizada.

## Pruebas que faltan antes de producción

- Verificar la descarga real con un cliente de prueba en iOS Safari/WebView y Android Chrome/WebView.
- Confirmar que la cuenta A jamás puede descargar registros de B y que una desconexión durante la lectura no produce descarga.
- Revisar con el responsable los procedimientos de acceso, portabilidad, rectificación y eliminación de datos, la identidad legal y la política de privacidad.
- Activar el servidor de producción y comprobar que tiene aplicadas las migraciones de las tablas expuestas.

La exportación no sustituye el trámite de eliminación ya disponible en la aplicación.

## V49 · Guardar o compartir datos desde la aplicación móvil

En la **web**, el botón sigue descargando un archivo JSON del cliente. En Android/iOS **nativos** usa los plugins de Capacitor ya instalados para abrir el selector del sistema con un archivo local de `Directory.Cache`. El cliente debe elegir explícitamente dónde guardarlo; la app **no envía datos automáticamente por email o a terceros**.

Esta operación necesita una sesión autenticada en Supabase que coincida con `usuario_id` del archivo. Se comprueba que la sesión siga siendo la misma antes de escribir y antes de abrir el menú nativo; si cambia de cuenta, se borra el archivo temporal y se suspende la operación. Cada archivo tiene un nombre aleatorio único para evitar que dos sesiones compartan el mismo fichero. Ante fallo al escribir o compartir se intenta borrar de inmediato.

Tras cerrar el menú se programa su eliminación de la caché **90 segundos después** para que el receptor termine de leerlo. La cancelación/terminación del proceso por el sistema operativo puede impedir esa limpieza: los datos son confidenciales y siguen requiriendo protección del dispositivo. La copia no debe guardarse en carpetas públicas por defecto.

**Aviso visible:** el archivo puede contener teléfonos, direcciones, mensajes y otros datos personales. El usuario debe conservarlo en un destino privado y no compartirlo con terceros desconocidos.

Quedan pendientes pruebas reales en Android y iPhone, especialmente en caso de cancelar el diálogo, perder conectividad, cambiar de cuenta y reiniciar la aplicación. Esta descarga **no reemplaza la respuesta del responsable a una solicitud de acceso RGPD**.
