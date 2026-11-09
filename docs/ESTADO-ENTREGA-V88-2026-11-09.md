# REPARADO · Estado de entrega y pendientes reales (09/11/2026)

> Inventario de preparación, no autorización para publicación ni certificado de seguridad.

## Código incluido hasta V88

- Panel propietario exclusivo de cuentas con rol `admin` más RLS del servidor: solicitudes, presupuesto, agenda y operarios, chat interno, directorios, soporte, reseñas y borradores fiscales.
- Agenda semanal en `Europe/Madrid`, validación de solapamiento en backend V7, carga progresiva de visitas y presupuestos, navegación por fecha, filtro de operarios, acceso desde directorio y sugerencia de asignación.
- Catálogo de seis categorías, incluyendo Electricidad; precios orientativos con IVA 21 %, categoría Manitas sin material y reformas integrales por presupuesto; fotografías ilustrativas con créditos.
- Solicitud de trabajos, fotos, aceptación, estados, notificaciones internas, moderación de reseñas reales y descarga de datos del cliente.
- Proceso técnico de prueba de Android/iOS, metadatos de tiendas y validaciones de seguridad previas a la firma; **las compilaciones de prueba no son publicaciones ni certifican un circuito fiscal**.

## Evidencia de infraestructura consultada

Supabase conectado: **solo `REPARADO Test`**, en región europea `eu-west-3`, PostgreSQL 17.11. No hay un proyecto de producción conectado, por lo que no existe evidencia del funcionamiento final con clientes comerciales.

Auditoría de esquema de solo lectura del 09/11/2026:
- Las doce tablas públicas inspeccionadas tienen RLS habilitada.
- La protección del catálogo público de reseñas y de las incidencias se basa también en permisos **por columna**. `has_table_privilege(...,'SELECT')=false` no significa necesariamente que falten permisos: las columnas permitidas sí tienen los `GRANT` correspondientes. **No ampliar a `GRANT SELECT` de tabla completa** sin revisar RLS y confidencialidad.
- El asesor de Supabase notifica que **la protección contra contraseñas filtradas está desactivada**.
- El asesor también señala siete funciones `SECURITY DEFINER` llamables por usuarios autenticados. Algunas son RPC intencionadas; revisar su autorización y prueba de aislamiento antes de producción, no retirar permisos a ciegas.
- Las dos colas privadas de correo no tienen políticas RLS de acceso directo: es intencional si solo las usa un backend privilegiado.

## Requisitos de salida pendientes, dependientes de cuentas externas

| Área | Antes de darla por terminada |
| --- | --- |
| Producción | Crear un proyecto Supabase independiente, revisar coste/plan con el titular, ejecutar migraciones en el orden correcto, auditar API, RLS, Storage, Auth, copias de seguridad y cuentas reales de prueba |
| Seguridad de acceso | Bloquear altas públicas en Auth si se conserva acceso por invitación; verificar contraseñas filtradas, MFA para administradores, rate limit y recuperación |
| Correos | Configurar y verificar dominio/remitente, proveedor de envío y worker seguro. La **lectura de Outlook en el panel no está integrada**; exige Microsoft Graph/OAuth y autorización de las cuentas |
| Push | Preparar credenciales APNs/FCM, backend de envío autenticado, permisos y pruebas físicas. La bandeja interna no prueba el envío remoto |
| Facturación | Validar identidad fiscal, serie, numeración, documentos definitivos, rectificativas, almacenamiento y requisitos fiscales españoles con asesoría; los borradores actuales **no son facturas emitidas** |
| RGPD | Aprobar y publicar política de privacidad y datos del responsable, condiciones, retención, derechos y proceso efectivo de eliminación |
| Distribución | Confirmar Apple Developer/App Store Connect, abrir Google Play Console, certificados, perfiles, capturas reales, metadata y pruebas en dispositivos; ejecutar firma solo con autorización |

## Criterio de cierre verificable

1. Dos clientes reales de prueba, un técnico y el titular completan el recorrido completo: invitación → acceso → solicitud con fotos → presupuesto → aceptación → asignación → cita → chat → finalización → reseña.
2. Aislamiento comprobado por rol: cliente A no puede leer datos de B; el técnico no entra al panel titular; las fotos y mensajes quedan privados; una sesión caducada no autoriza operaciones.
3. Emails y notificaciones anunciadas llegan en dispositivos reales; reintentos no duplican avisos, facturas o solicitudes.
4. Se completan las pruebas de las tiendas, se revisa el cumplimiento legal y el titular aprueba la publicación.

## Referencias de trabajo

- [Bloqueadores de publicación, issue #92](https://github.com/warks1/REPARADO/issues/92)
- [Configuración de Auth, issue #30](https://github.com/warks1/REPARADO/issues/30)
- [Seguridad de tokens push, issue #32](https://github.com/warks1/REPARADO/issues/32)
- [Facturación fiscal, issue #75](https://github.com/warks1/REPARADO/issues/75)
- `docs/PUBLICAR-EN-TIENDAS.md` y `docs/PROPIETARIO-V84.md`.

**No se ha consultado ni incluido ningún secreto ni contenido personal de los clientes en este informe.**
