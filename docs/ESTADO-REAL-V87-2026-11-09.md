# REPARADO · Estado real de producto y publicación — 9 de noviembre de 2026

**Objetivo:** entregar una aplicación de reparación y servicios en Cataluña, con espacios separados para clientes, operarios y propietario. Este informe distingue lo **implementado y comprobado por CI** de lo que **todavía no está habilitado o verificado para atender clientes reales**.

## Estado del repositorio

| Componente | Estado comprobado | Límite relevante |
|---|---|---|
| Catálogo | **47 servicios** en seis categorías: Fontanería, Albañilería/Pladur, Parquet, Reformas integrales, Manitas y Electricidad | Son importes orientativos «desde», no presupuestos aceptados |
| Tarificación | Gama media-alta propuesta para Cataluña, IVA 21 % incluido | Manitas **sin** material; demás categorías con material estándar especificado; 3 reformas por presupuesto |
| Fotografías | Fichas con imagen ilustrativa y respaldo si falla la carga; créditos publicados | Parte de las fotos se obtiene de Pexels y requiere conexión; comprobar licencias y disponibilidad |
| Clientes | Catálogo, solicitudes con fotos, agenda, presupuestos, chat, reseñas reales, soporte y consulta de documentos | Entrega de solicitudes y datos reales solo con backend conectado y autorizado |
| Operarios | Acceso a trabajos asignados, chat y agenda; controles de asignación | Requiere roles RLS, prueba de permisos de cuentas reales y disponibilidad de operarios |
| Propietario | **Panel privado V84**, 12 accesos, diez indicadores, mensajes, clientes, operarios, presupuestos, calendario y reasignaciones | Exclusivo del rol `admin`; solo existe un admin en el entorno de pruebas. **No** se ha separado un rol propietario permanente para un futuro con más admins |
| Calendario | V84 con conversión horaria `Europe/Madrid`, cambios de operario/hora y pruebas de concurrencia | Historial de «Todos los trabajos» y colas tienen límites de carga documentados; verificar duraciones y desplazamientos reales |
| Correos | Enlaces a Outlook y bandeja de mensajes **interna** de REPARADO | **No existe lectura ni envío integrado de las bandejas externas de Outlook** |
| Facturación | Lectura de historial y **borradores privados** de facturas | Los borradores **no equivalen a facturas fiscales emitidas**; falta validación fiscal y operativa definitiva |
| Notificaciones | Mensajería y avisos dentro de la app | **Push remoto APNs/FCM no verificado** de extremo a extremo en producción |
| Compilación | Flujos de QA web, Android e iOS; pruebas de AAB e iOS sin firma comercial | Ningún paquete firmado comercialmente ni subida a tiendas acreditada |
| Backend | Supabase Test en región europea, activo | **No hay proyecto de producción independiente** en la cuenta conectada |

## Hitos integrados

- **V83** · Bloqueo de firma para evitar tiendas con configuración de demo o exposición de lectura anónima de columnas privadas: commit `47a12080f51e7f0dd3c4256142923c980b03ac90`, [PR #102](https://github.com/warks1/REPARADO/pull/102).
- **V85** · Manitas sin material e indicación del cliente en el formulario: commit `628559a303bc1d9f2efa586e48a86c31917d479d`, [PR #104](https://github.com/warks1/REPARADO/pull/104).
- **V86** · Electricidad, 47 servicios, fotos y 22 reajustes de tarifas: commit `156721c97b7a00a913718d3c650848de903b5587`, [PR #106](https://github.com/warks1/REPARADO/pull/106). La revisión anterior a su fusión superó **34 workflows**.
- **V84** · Panel privado del propietario con agenda, directorios y mensajería: commit `cf712207a7153f8d170a49454a7ea80eec9c18b0`, [PR #103](https://github.com/warks1/REPARADO/pull/103). La revisión anterior a su fusión superó **32 workflows**, incluidos navegadores móviles.

El orden de numeración refleja cuándo se abrieron los cambios, no el orden final en que se fusionaron. **La rama `main` contiene los cuatro hitos.** Las pruebas automatizadas verifican código y simulaciones; **no equivalen a ensayos reales en Apple TestFlight, Google Play o cuentas personales**.

## Seguridad: información verificada y pendiente

Consulta read-only del asesor de Supabase sobre el proyecto **REPARADO Test** el 9/11/2026:

- **WARN**: protección de contraseñas filtradas desactivada en Supabase Auth. Activarla en el Dashboard para un despliegue real, si está disponible en el plan.
- **WARN**: siete funciones `SECURITY DEFINER` invocables por `authenticated`. Varias están previstas para acciones legítimas de usuario, pero **requieren revisión individual de autorización e identidad**; no revocar a ciegas porque rompería la aplicación.
- **INFO**: dos colas de salida de correo tienen RLS activado sin políticas. Es un **bloqueo deliberado para usuarios públicos**; verificar la ejecución mediante el componente interno autorizado.
- Una comprobación read-only de los privilegios de las **51 columnas de seis tablas privadas** en Test indicó **cero columnas legibles por `anon`**. Esto no demuestra el aislamiento entre dos usuarios autenticados ni certifica producción.
- Las pruebas SQL de RLS, concurrencia y aislamiento que corren en PostgreSQL temporal de CI son importantes, pero no sustituyen una prueba autenticada completa contra el servidor comercial.

No almacenar `service_role`, claves privadas de firma o contraseñas en el frontend, el repositorio, documentación pública ni el chat.

## Bloqueos obligatorios antes de atender clientes reales

1. **Titularidad y servidor comercial:** crear o validar un Supabase de **producción independiente de REPARADO Test**, en región adecuada de la UE, con copias de seguridad, políticas RLS y almacenamiento de fotos privado. Desplegar todas las migraciones necesarias con control de cambios.
2. **Autenticación:** bloquear nuevas altas públicas si se usan invitaciones, comprobar recuperación de cuenta, sesiones/MFA administrativas, protección de contraseñas comprometidas y autorizaciones de las siete RPC.
3. **Ensayo real con cuentas distintas:** dos clientes, un operario y un administrador deben completar solicitud → adjuntos → presupuesto → aceptación → asignación → calendario → cambios de cita → mensajes → finalización → documentos → reseña → solicitud de eliminación de cuenta. Verificar que cada usuario **no puede ver datos de otro**. Probar también errores de red y sesiones caducadas.
4. **Operación y facturación:** personal habilitado para cada oficio (en especial electricidad), tarifas y materiales revisados con costes reales, duración y desplazamientos; emisión de factura fiscal conforme a requisitos vigentes, no solo borradores; soporte, correo y canales de notificaciones que estén realmente operativos.
5. **RGPD y páginas públicas:** identidad real del responsable, políticas y avisos legales revisados, plazos de conservación, contratos con proveedores, procedimiento efectivo de eliminación de cuentas y fotos, URLs HTTPS verificadas de privacidad, soporte y eliminación.
6. **Cuentas y distribución:** Apple Developer/App Store Connect y **Google Play Console** verificadas bajo la titularidad adecuada; crear y custodiar claves de firma fuera del repositorio, perfiles, capturas reales, clasificación, declaraciones de datos y credenciales de prueba de revisión.
7. **Entrega controlada:** primero pruebas internas/TestFlight, después comprobación en teléfonos físicos iOS/Android y solo entonces envío a revisión de tiendas y apertura al público.

**El flujo de firma comercial está diseñado para fallar de forma segura** hasta que exista un backend de producción aprobado y las variables, URLs, pruebas de Auth y API privada sean coherentes. No introducir valores ficticios para superar las barreras.

## Accesos para seguir verificando

- [Panel del propietario](PROPIETARIO-V84.md)
- [Tarifas Electricidad y gama media-alta](TARIFAS-CATALUNA-ELECTRICIDAD-V86.md)
- [Tarifas Manitas sin material](TARIFAS-MANITAS-SIN-MATERIAL-V85.md)
- [Publicación App Store y Google Play](PUBLICAR-EN-TIENDAS.md)
- [Detalle técnico de producción](production-readiness.md)
- [Workflows de GitHub](https://github.com/warks1/REPARADO/actions)

**Criterio de cierre:** código integrado y pruebas automatizadas verdes significa *candidato técnico*, no *lanzamiento comercial completado*. Las pruebas manuales, la habilitación de producción y la publicación en tiendas no están hechas.
