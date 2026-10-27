# REPARADO V51 · Inventario de datos y declaraciones de privacidad

**Documento interno de trabajo. NO es una política de privacidad aprobada ni debe publicarse en la tienda.**

Base revisada: estructura de REPARADO Test y código de la app, 27 de octubre de 2026. Antes de producción hay que confirmar la recogida real y todos los proveedores.

## Inventario de tratamientos por función

| Función | Datos registrados o tratados | Finalidad que debe revisarse |
|---|---|---|
| Autenticación (auth.users) | Email, identificador y credenciales administradas por Supabase | Acceso por invitación y recuperación |
| Perfil (profiles) | Nombre, teléfono, rol, fecha | Gestión de la cuenta |
| Solicitudes (service_requests) | Servicio, descripción, precio, dirección, portal, código postal, teléfono, citas, operario, presupuesto aceptado | Gestión de reparación, visita y presupuestos |
| Fotografías privadas (Storage) | Fotos o capturas aportadas por cliente | Evaluar trabajos y presupuestar |
| Mensajes (messages) | Contenido, interlocutores, fecha | Chat vinculado al servicio |
| Avisos (notifications) | Texto, destinatario, estado leído, fecha | Comunicaciones operativas |
| Dispositivos (device_tokens) | Token push, plataforma, usuario, fecha | Futuras notificaciones remotas; aún no habilitadas en producción |
| Reseñas (customer_reviews) | Calificación, comentario, solicitud, fecha, moderación | Opiniones públicas solo cuando se aprueban |
| Facturas (invoices) | Número, referencia, base, IVA, total, estado y ruta de PDF | Documentación contable; emisión fiscal final pendiente |
| Incidencias (support_reports) | Resumen, descripción, sección, estado, fecha | Soporte al cliente |
| Eliminación de cuenta | Estado y fechas de petición | Tramitar eliminación y derechos del interesado |
| Colas de correo | Referencias, estado, intentos de envío y errores | Comunicaciones operativas internas |

La app aplica roles y RLS en la base y mantiene las fotografías en un bucket privado. La existencia de esos controles **no demuestra por sí sola cumplimiento del RGPD ni protección absoluta**.

## Revisión de fichas de las tiendas

**Apple App Privacy:** revisar las categorías Contact Info (nombre, email, teléfono, dirección), User Content (mensajes, fotografías, comentarios y soporte), Identifiers (ID de cuenta y tokens de dispositivo cuando proceda) y datos económicos asociados a solicitudes/facturas, aplicando las definiciones oficiales de Apple. Las direcciones introducidas por el cliente no prueban que la app utilice GPS del dispositivo.

**Google Play Data Safety:** revisar cada categoría de datos, finalidad, proveedores, cifrado, retención, acceso y posibilidad de solicitar eliminación dentro y fuera de la app. No afirmar que no se recogen datos: la app utiliza contacto, domicilio, fotos, solicitudes y mensajes.

**Visibilidad:** las fotos de solicitudes son privadas; las reseñas moderadas y aprobadas pueden mostrarse públicamente. No publicar reseñas ficticias.

**Integraciones:** Supabase para cuenta/base/archivos, correos Outlook para consultas, y futuras integraciones Apple/Google (publicación y notificaciones). Confirmar subencargados, transferencias, ubicación y contratos antes de hacer declaraciones definitivas.

## Pendientes imprescindibles para la política legal

- Identidad fiscal del responsable (nombre o razón social, NIF y domicilio): **PENDIENTE**.
- Bases jurídicas por finalidad y tratamiento, incluidos mensajes/fotos y obligaciones fiscales: **PENDIENTE DE REVISIÓN**.
- Períodos o criterios de conservación (solicitudes, comunicaciones, facturas, fotos, copias): **PENDIENTE**.
- Encargados, destinatarios, transferencias internacionales y garantías: **PENDIENTE**.
- Derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, y gestión de solicitudes: **PENDIENTE DE REVISIÓN OPERATIVA**.
- Declaraciones App Store Connect y Google Play Console: **PENDIENTE**.
- URL pública de política de privacidad completa, accesible y aprobada: **NO PUBLICADA**.

Referencias:
- https://www.aepd.es/derechos-y-deberes/conoce-tus-derechos/derecho-de-informacion
- https://www.aepd.es/derechos-y-deberes/cumple-tus-deberes/medidas-de-cumplimiento/actividades-tratamiento
- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- https://support.google.com/googleplay/android-developer/answer/16543315?hl=es

**No copiar este inventario a una web pública como política definitiva.** Debe completarlo el responsable con información real y aprobarlo antes de la publicación comercial.
