# REPARADO V60 — Guardar y recuperar borradores de facturas

## Qué funciona
Desde **Panel interno → trabajo terminado → Preparar borrador de factura**:
1. Rellenar datos fiscales del emisor, destinatario, concepto y fecha del servicio.
2. Pulsar **Preparar borrador y desglose IVA** para validar y previsualizar base, cuota IVA 21 % y total.
3. Pulsar **Guardar borrador privado** para conservarlo en Supabase. La operación NO asigna un número ni emite factura.
4. Pulsar **Recuperar borrador guardado** al volver al trabajo; comprobar identidad/importe/estado antes de cargar.

Los datos fiscales NO se guardan en localStorage ni se envían por correo. Solo se guardan voluntariamente en la tabla privada de borradores. La interfaz invalida la vista previa al modificar cualquier dato.

## Seguridad del servidor
Migración: `supabase/migration-invoice-drafts-v60.sql`.
- Tabla `public.invoice_drafts`, RLS habilitado; sin accesos anónimos y sin INSERT, UPDATE, DELETE directo desde aplicaciones.
- SELECT solamente para sesión de **administrador** según `is_reparado_admin()`.
- RPC `reparado_save_invoice_draft` verifica rol, identidad, estado **completed**, importe idéntico al registrado y datos fiscales básicos.
- La operación realiza bloqueo de fila y UPSERT único por `request_id` para evitar duplicados.
- Rechaza borradores adicionales si ese trabajo ya tiene una factura definitiva registrada.
- En caso de pérdida de conexión, no confirma el guardado: se recomienda recuperar primero antes de reintentar.
- La validación de formato de NIF no verifica la autenticidad del identificador.

## Despliegue correcto
1. Revisar CI de esta PR: `npm test`, `npm run build` y `tests/billing-draft-db-v60.py` sobre PostgreSQL temporal.
2. Aplicar SOLO en **REPARADO Test** mediante una migración antes de probar la UI conectada; nunca aplicar SQL de prueba destructivo a proyectos remotos.
3. Comprobar aislamiento con dos clientes, un operario y administrador; guardar/recuperar un borrador con identificadores **ficticios**.
4. Repetir migración y auditarlas antes de implantar en producción; no usar Test en GitHub Pages público.

## Qué todavía NO hace
NO genera factura fiscal ni PDF final. No existe numeración correlativa, fecha de expedición oficial, PDF almacenado, entrega al cliente, conciliación de pagos, rectificativas, ni interoperabilidad SIF/VERI*FACTU. La opción imprimir/guardar PDF produce explícitamente un documento **BORRADOR**.

La AEAT exige datos del emisor y destinatario, número correlativo por serie, fecha, descripción, importes y cuotas del impuesto. La integración fiscal deberá validar los requisitos españoles antes de habilitar emisión:
https://www3.agenciatributaria.gob.es/Sede/iva/facturacion-registro/facturacion-iva/contenido-facturas.html

Nota: El calendario de adaptación SIF informado por la AEAT es 1 de enero de 2027 para determinados sujetos del IS y 1 de julio de 2027 para otros obligados, sujeto al ámbito aplicable y revisiones:
https://www3.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/nota-informativa-ampliacion-plazo-adaptacion-facturacion.html
