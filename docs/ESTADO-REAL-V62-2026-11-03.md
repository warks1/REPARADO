# REPARADO · Estado real de verificación V62 (03/11/2026)

Este documento registra **hechos comprobados**. No sustituye los ensayos en dispositivos ni la aprobación legal/fiscal del lanzamiento.

## GitHub y aplicación

- V61 integrada en `main` (commit `535605981e3b61c5d6a38c97687111364a992ca6`): catálogo de **34 servicios con precio orientativo** para Cataluña, incluyendo los materiales estándar descritos, desplazamiento ordinario, mano de obra e IVA del 21 %; **3 reformas integrales por presupuesto**. El precio contratado debe confirmarse antes de ejecutar trabajos.
- La ejecución del commit V61 ha finalizado satisfactoriamente para la publicación de GitHub Pages, interfaz móvil, APK Android de pruebas, compilación iOS de simulador, acceso por invitación, reglas de agenda, privacidad y pruebas automatizadas de facturación.
- **GitHub Pages publicado NO equivale a una aplicación conectada en producción.** El despliegue web admite modo demostración cuando faltan variables de un backend real. No se ha verificado una solicitud real desde la web a un Supabase de producción.
- La APK de depuración y la compilación de simulador **no son** AAB/IPA comerciales con firma y distribución en las tiendas.

## Supabase: situación verificada

- La cuenta conectada contiene un proyecto **REPARADO Test** en la UE, activo y saludable, y **ningún proyecto separado de producción** en la lista disponible.
- El 03/11/2026 se aplicó allí `reparado_v60_private_invoice_drafts`; quedaron creados `public.invoice_drafts` y `public.reparado_save_invoice_draft(...)`.
- Se comprobaron **20/20** controles de `supabase/auditoria-readonly-v9.sql`, **4/4** de `supabase/auditoria-fotos-v12.sql`, **10/10** de `supabase/auditoria-cuentas-test-v12.sql` y **14/14** de `supabase/auditoria-readonly-v62-invoice-drafts.sql`. Los resultados fueron `OK` para cada control.
- La V60 tiene RLS, lectura limitada por política administrativa, ningún acceso directo de escritura para cuentas autenticadas, ningún acceso anónimo y una RPC restringida. No había solicitudes, facturas finales ni borradores registrados al verificar: los controles sobre integridad de **datos existentes** están vacíos y no demuestran un guardado/recuperación real mediante la app.
- El asesor de seguridad aún identifica **siete RPC SECURITY DEFINER ejecutables por `authenticated`**, que necesitan revisión de necesidad y comprobaciones de autorización; dos colas de correo con RLS y sin políticas (diseño de denegación a usuarios públicos, revisar acceso del trabajador interno); y **protección de contraseñas filtradas desactivada**, a revisar en los ajustes de Auth.

## Auditoría V62

El archivo `supabase/auditoria-readonly-v62-invoice-drafts.sql` contiene 14 comprobaciones **de solo lectura** de esquema, permisos, funciones y consistencia de borradores. Ejecutarlo solamente después de aplicar la migración V60; devuelve exclusivamente `OK` o `PENDIENTE`, sin datos personales. El resultado `OK` de la configuración no sustituye probar la autorización con sesiones y dispositivos reales.

## Bloqueos de lanzamiento

1. Crear/validar un proyecto **Supabase de producción diferente de REPARADO Test**; migrar con seguridad, configurar Auth y el almacenamiento privado, comprobar copias de seguridad, aislación entre cuentas y funcionamiento desde dispositivos reales.
2. Verificar que **Supabase Auth bloquea los nuevos registros** si la aplicación solo admite invitaciones, activar protección de contraseñas filtradas cuando esté disponible y revisar MFA/controles de administradores.
3. Publicar y comprobar enlaces HTTPS para privacidad, soporte y eliminación de cuenta; implantar de verdad el proceso de eliminación de datos conforme a las obligaciones aplicables.
4. Probar con cuentas invitadas todo el circuito cliente → fotos → solicitud → presupuesto → asignación → trabajo → borrador fiscal → valoración. Los **borradores no son facturas emitidas**. Numeración, emisión definitiva, pago y exigencias fiscales deberán implementarse y validarse aparte.
5. Preparar credenciales de firma **sin compartir secretos**, certificados, capturas reales y fichas de tiendas. **Google Play Console** y envío a App Store Connect requieren acciones de titularidad y revisión externas; los flujos no publican automáticamente.
6. Validar fotografía/licencias, push remoto FCM/APNs (no confundir con notificaciones internas) y las funcionalidades anunciadas antes de abrir servicio a clientes.

**Criterio:** mantener el preflight comercial bloqueado hasta completar y documentar esas comprobaciones. Nunca enlazar REPARADO Test al despliegue público de clientes.

Consultar también `docs/PUBLICAR-EN-TIENDAS.md`, `docs/FACTURACION-V60.md` y `docs/production-readiness.md`.
