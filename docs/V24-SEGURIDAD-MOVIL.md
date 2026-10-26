# REPARADO V24 — Seguridad móvil y solicitudes más fiables

## Cambios

- Los registros nativos de notificaciones se asocian a una cuenta cada vez.
- Al cerrar sesión desde la app, se espera cualquier registro pendiente, se intenta revocar su token de forma autenticada y **se bloquea el cambio de cuenta si falla esa revocación**.
- La API V24 sólo permite registrar el token que proporciona el dispositivo y revocar el token propio, y nunca entrega tokens ajenos. Los roles públicos no reciben permisos directos de escritura/lectura sobre public.device_tokens.
- Los formularios de nueva solicitud evitan envíos dobles, restauran el botón al fallar la conexión y muestran un aviso si la base puede haber guardado el trabajo aunque no llegase la confirmación.
- Una foto que falle al subir no elimina la solicitud ya registrada: muestra cuántas fotos no pudieron añadirse.

## Orden de despliegue

1. Ejecutar las comprobaciones CI de la PR V24, incluidas PostgreSQL temporal y Node. No usar los scripts de pruebas locales contra bases reales.
2. Instalar **supabase/migration-v24.sql** en el Supabase **de pruebas** después de V19 y comprobar que las RPC están disponibles para una cuenta invitada, nunca para anon.
3. Probar acceso y cierre de sesión A → B desde el **mismo iPhone y Android físicos**; verificar que el token no sigue vinculado a A, así como el comportamiento sin red y en segundo dispositivo.
4. Confirmar que no se muestran datos personales en las notificaciones del sistema ni en la pantalla bloqueada.
5. Revisar el servidor de envíos FCM/APNs: **no activar envío remoto** hasta que se compruebe que el token pertenece a la cuenta activa y se controle caducidad, revocación y cierres de sesión externos.
6. Aplicar la migración validada al entorno definitivo antes de distribuir un paquete nativo conectado; nunca publicar REPARADO Test como backend de producción.

## Limitaciones y operaciones pendientes

- Las pruebas de JavaScript y PostgreSQL temporal **no certifican** el comportamiento real de APNs/FCM ni los permisos de usuarios reales.
- El cierre de sesión desde otro dispositivo, caducidad de sesión, instalaciones antiguas y notificaciones en vuelo requieren validación adicional del backend de envíos.
- Los clientes con una versión antigua de REPARADO que usa upsert directo de device_tokens necesitan actualizarse tras V24; el backend bloquea ese acceso deliberadamente.
- La aplicación no envía todavía push remotos y esta actualización no habilita ese servicio.
- El acceso por invitación debe cerrarse también en Supabase Authentication, no sólo en la UI.
- La protección frente a contraseñas filtradas estaba desactivada en REPARADO Test cuando se revisó; debe activarse en el panel de Auth si el plan lo permite.
- Para publicación comercial siguen pendientes pruebas reales con dos clientes/operario/admin, cuenta de producción, política legal, avisos externos y firma de apps.
