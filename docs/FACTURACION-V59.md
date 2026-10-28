# REPARADO V59 — Preparación interna de facturas

## Función nueva
En el panel de administración, cada trabajo en estado **Terminado** con importe confirmado dispone de **🧾 Preparar borrador de factura**.

Permite introducir razón social/nombre, NIF y domicilio fiscal del emisor, identificación del cliente, concepto, fecha de realización del servicio y el precio ya registrado. Calcula base imponible, IVA del 21 % y total desde el precio IVA incluido.

El administrador puede previsualizar el borrador e imprimirlo o guardarlo como PDF mediante la impresión del sistema.

## Límites importantes
- **NO emite facturas fiscales.** Cabecera "BORRADOR", sin número correlativo ni fecha de expedición.
- No inserta datos en public.invoices, no cambia su registro y no sube datos fiscales a Storage. Los datos introducidos solo viven en el formulario temporal.
- No está permitida su entrega como factura final, contabilización o marcado como pagada.
- El botón se presenta exclusivamente al administrador para trabajos completados y valorados. Seguridad final de emisión requiere backend de confianza.
- El importe se toma del trabajo guardado y no altera un presupuesto aceptado.
- La validación de formato de NIF no demuestra autenticidad ni situación fiscal.
- En iPhone/iPad guardar como PDF depende de las opciones de impresión de iOS.
- No se admite aún IVA múltiple, exenciones, anticipos ni facturas rectificativas.

## Para terminar el módulo
1. Configurar datos fiscales verificados de emisor, series, cliente, partidas y tipos impositivos.
2. Crear proceso transaccional de emisión de servidor con control de administrador, numeración correlativa por serie, idempotencia, inmutabilidad y auditoría.
3. Generar y almacenar PDF fiscal definitivo en área privada, permitiendo al cliente acceder al documento y notificándolo tras emisión confirmada.
4. Implementar rectificativas, pagos separados de las facturas (la V9 bloquea cambios de estado en facturas emitidas), gestión contable.
5. Comprobar obligaciones españolas con asesor y futura adaptación SIF/VERI*FACTU antes de activar emisión.

## Referencias oficiales
- AEAT facturas ordinarias: https://www3.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-iva-2026/capitulo-10-obligac-formales-suj-registro/obligaciones-materia-facturacion/contenido-general-facturas-ordinarias.html
- AEAT plazos sistemas informáticos: https://www3.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/nota-informativa-ampliacion-plazo-adaptacion-facturacion.html

## Validación
- tests/billing-draft-v59.test.mjs, tests/invoice-integrity-v9.test.mjs, npm test, npm run build.
- Prueba manual en móvil: cuenta admin → trabajo terminado → preparar borrador → completar datos → previsualizar → imprimir/guardar PDF. No usar datos fiscales reales en REPARADO Test.
