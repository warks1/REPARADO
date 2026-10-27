# REPARADO V48 · Verificación de enlaces públicos antes de firmar

Las tiendas no aceptan una política de privacidad oculta, inaccesible o inexistente. En especial, **Apple exige una URL pública de la política** y Google Play exige una política accesible en web (no PDF). Las fichas también deben ofrecer soporte y eliminación de cuenta según corresponda.

El proceso comercial de **Android e iOS** ejecuta `node scripts/store-public-pages-check.mjs`, después del chequeo de producción y de las altas públicas de Supabase. La comprobación bloquea la firma cuando alguna página no está lista.

## Qué verifica

- Tres enlaces diferenciados por configuración: `REPARADO_PRIVACY_URL`, `REPARADO_SUPPORT_URL` y `REPARADO_DELETE_ACCOUNT_URL`.
- HTTPS, sin contraseñas, direcciones IP, rutas locales, puertos arbitrarios, parámetros ni marcadores ficticios; no acepta URL duplicadas.
- Una respuesta directa HTTP 2xx de HTML; no sigue redirecciones, no acepta PDF o errores 404.
- Contenido básico identificable de **REPARADO** y relativo a privacidad, soporte o eliminación.
- Falla de forma cerrada ante respuestas no válidas, fallo de red, contenido demasiado grande o página vacía.

**No prueba cumplimiento legal**: una página con texto genérico puede superar esta revisión básica. Antes de publicar, el responsable debe validar que la política tenga identificación del responsable, contacto, finalidades y bases legales, categorías de datos (nombre, teléfono, domicilio, fotos, mensajes, facturas), terceros, conservación, derechos y autoridad de control según la legislación aplicable. No se debe inventar identidad empresarial, plazos de retención ni proveedores.

El script hace **solo solicitudes GET públicas**, no registra claves, no utiliza permisos elevados y no transmite datos de clientes. No cambia los endpoints privados ni publica el entorno REPARADO Test.

## Estado y acciones pendientes

1. Decidir y verificar la identidad legal de la empresa/responsable.
2. Preparar la política de privacidad completa con asesoramiento legal.
3. Publicar la política en una URL HTTPS estable y sin restricciones geográficas.
4. Verificar las páginas ya existentes de ayuda y eliminación de cuenta y asociar sus URL definitivas en GitHub Environment `store-release`.
5. Ejecutar los chequeos y la firma comercial solo al tener también preparado Supabase de producción y los certificados reales.

### Referencias

- [Apple App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Google Play requisitos de privacidad](https://support.google.com/googleplay/android-developer/answer/16543315?hl=es)
