# REPARADO V53 · Guardar resumen de presupuesto desde iPhone y Android

La pantalla **Mis solicitudes** ya permite descargar la constancia informativa de una aceptación de presupuesto, con fecha y desglose base/IVA/total. V53 añade compatibilidad nativa para guardarla o compartirla en iPhone y Android.

## Funcionamiento

- **Web:** se descarga el mismo archivo HTML de la versión V36.
- **iOS/Android (Capacitor):** se genera un archivo HTML temporal en `Directory.Cache`, y se abre el menú nativo de compartir para que el usuario elija dónde guardarlo, imprimirlo o abrirlo.
- El archivo no se envía de forma automática por email ni se sube a almacenamiento externo.
- El fichero tiene nombre aleatorio (sin nombre ni domicilio del cliente) y se intenta borrar a los **90 segundos** de cerrar el diálogo. Ante fallo o cambio de sesión durante la preparación se intenta borrar inmediatamente.
- El botón se desactiva mientras actúa para evitar dobles operaciones. La vista y la sesión se comprueban antes y después de generar el archivo.

El archivo HTML es un **resumen informativo** derivado de un registro de aceptación guardado en Supabase. No es una factura, comprobante de pago ni documento con firma electrónica verificada. No afirmar que el resumen es legalmente vinculante por sí solo ni que el navegador genera un PDF.

## Pruebas pendientes de producción

- Probar el menú de guardar/compartir en dispositivos físicos iPhone y Android y la apertura del HTML en destinos compatibles.
- Revisar los archivos en caché al cancelar o interrumpir el menú, suspender la app, reiniciar y cambiar de cuenta.
- Validar que un cliente A no puede consultar la solicitud ni el resumen de B mediante RLS autenticado real.
- Completar emisor fiscal, números y rectificaciones si se requiere factura real: este flujo NO sustituye la facturación.
