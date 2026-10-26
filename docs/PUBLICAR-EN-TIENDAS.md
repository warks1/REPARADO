# REPARADO · Publicación en App Store y Google Play (26/10/2026)

## Estado y objetivo
**Candidato de publicación, NO aprobado todavía**. Las compilaciones Android Debug e iOS Simulator existentes NO son paquetes aptos para subir directamente. El proyecto usa Capacitor 8, identificador nativo `com.ams.reparado`, y la web pública sigue funcionando en modo demostración.

La integración para tiendas se ha preparado en `.github/workflows/store-release.yml`. Solo se puede lanzar manualmente desde GitHub Actions, con los requisitos siguientes. Nunca enviar a las tiendas una aplicación que no pueda tramitar las solicitudes de los clientes.

## Bloqueadores que debe resolver el propietario

1. **Cuentas**: Apple Developer Program y App Store Connect habilitados; cuenta de Google Play Console habilitada. Registrar la misma identidad `com.ams.reparado` en ambas plataformas y comprobar que pertenece a la titularidad de REPARADO antes de realizar la primera publicación. Este identificador no se puede modificar con libertad después de publicar.
2. **Backend de producción**: proyecto Supabase distinto de **REPARADO Test**, con migraciones de seguridad, almacenamiento de fotos privado, copias de seguridad, roles, Auth y pruebas completas cliente → solicitud → operario → servicio terminado → factura y valoración. Verificar login con usuarios reales de prueba en dispositivos físicos. Mantener registro público de Auth deshabilitado si no se admiten altas libres; la opción de la web NO sustituye esta restricción.
3. **Avisos legales y datos personales**: publicar URL HTTPS de política de privacidad, identidad y contacto del responsable, RGPD, destinatarios, plazos de retención, derechos y servicio de soporte. Declarar correctamente en los cuestionarios de ambas tiendas los datos tratados: nombre, email, teléfono, dirección introducida por el cliente, fotos, texto de las solicitudes, chats, reseñas e identificadores para notificaciones. No atribuir certificaciones, protección absoluta ni prácticas inexistentes.
4. **Eliminación de cuenta**: desplegar `supabase/migration-store-account-deletion.sql` en producción, probar la opción `Mi perfil → Solicitar eliminación de mi cuenta`; establecer procedimiento real de verificación, tramitación, borrado de datos, fotos y reseñas, conservación de facturas cuando proceda y comunicación al solicitante. Publicar una **URL web HTTPS operativa** para solicitar eliminación sin instalar la app, requerida por Google Play. El botón dentro de la app inicia una solicitud, NO ejecuta el borrado automático.
5. **Recursos de la ficha**: capturas reales de iPhone y Android, iconos 1024×1024 Apple y 512×512 Play según especificaciones vigentes, textos, categoría, teléfono/contacto, clasificación por edades, capturas, enlace web de soporte, identificador de la persona responsable y credenciales de prueba para revisión. Las fotos ilustrativas externas del catálogo deben verificarse y atribuirse según su licencia.
6. **Firma y distribución**: configurar claves de firma en secretos de GitHub, NO pegarlas en ChatGPT, comentarios, código o documentación pública. Una vez registradas, ejecutar flujo manual y descargar los artefactos AAB/IPA. No se realiza ninguna subida a tiendas automáticamente.

## Configurar el entorno GitHub Actions

Ruta: repositorio → Settings → Secrets and variables → Actions.

**Secretos de producción (mismo backend para iOS/Android, nunca el de pruebas):**
- `REPARADO_STORE_SUPABASE_URL`
- `REPARADO_STORE_SUPABASE_PUBLISHABLE_KEY`: solo clave pública `sb_publishable_...` o `anon` legítima. Nunca `service_role`.

**Variables no secretas (Settings → Variables):**
- `REPARADO_PRIVACY_URL` — política vigente en HTTPS.
- `REPARADO_SUPPORT_URL` — soporte público en HTTPS.
- `REPARADO_DELETE_ACCOUNT_URL` — sitio web REAL para solicitar borrar datos/cuenta.
- `REPARADO_PRODUCTION_APPROVED=true` — activar únicamente después de las pruebas manuales y la aprobación del responsable.

**Google Play** (crear clave de subida en un ordenador seguro, conservar copia cifrada):
- `REPARADO_ANDROID_KEYSTORE_BASE64`: base64 del almacén privado Java (JKS o PKCS12) de subida, sin saltos de línea.
- `REPARADO_ANDROID_KEYSTORE_PASSWORD`
- `REPARADO_ANDROID_KEY_ALIAS`
- `REPARADO_ANDROID_KEY_PASSWORD`

**Apple**, configuración manual de firma para el App ID `com.ams.reparado`:
- `REPARADO_APPLE_TEAM_ID`
- `REPARADO_APPLE_DISTRIBUTION_P12_BASE64`: archivo P12 de Apple Distribution en base64.
- `REPARADO_APPLE_DISTRIBUTION_P12_PASSWORD`
- `REPARADO_APPLE_PROFILE_BASE64`: perfil App Store Connect de distribución en base64.

Crear el entorno de GitHub **store-release** y, preferiblemente, exigir aprobación manual del propietario antes de permitir usar esos secretos. Registrar los secretos como secretos del entorno o del repositorio. Los runners deben ser de confianza.

Para exportar un archivo binario a base64, hacerlo **localmente** y guardar el resultado directamente como secreto; nunca subir archivos P12/JKS al repositorio ni compartirlos en el chat.

## Compilar

En GitHub: **Actions → REPARADO · Paquetes firmados para Apple y Google → Run workflow → main**. Elegir plataforma (`android`, `ios` o `ambas`), versión `1.0.0` y número de compilación `1` (incrementar en cada nueva subida).

- **Android:** el flujo verifica configuración de producción, tests, API objetivo 36, construye un Android App Bundle **AAB firmado**, comprueba su firma y lo guarda como artefacto `Reparado-Google-Play-AAB-firmado`. Descargar y subir a **Google Play Console**, preferiblemente primero a pruebas internas.
- **iOS:** compila con Xcode en macOS y certificado y perfil de distribución reales, exporta **IPA firmada** como artefacto `Reparado-Apple-AppStore-IPA-firmado`. Descargar y subir usando Xcode/Transporter a App Store Connect, y distribuir inicialmente en TestFlight.

Una compilación satisfactoria no garantiza la aprobación. Los certificados, perfiles, SDK/entitlements y metadatos pueden requerir ajustes específicos que solo se verifican al conectar las cuentas reales. No reenviar IPA/AAB firmados públicamente.

## Reglas actuales de las tiendas

- Apple exige Xcode 26 o posterior para subidas desde el 28/04/2026 y contar con cuenta, perfil, firma de distribución, privacidad, metadatos, clasificación y acceso de revisión. `https://developer.apple.com/news/upcoming-requirements/`
- Apple exige opción de solicitar eliminación dentro de apps que ofrecen cuentas; una solicitud manual debe tramitarse efectivamente en un plazo razonable. `https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/`
- Desde el 31/08/2026 Google Play pide objetivo **API 36** para nuevas apps móviles. `https://support.google.com/googleplay/android-developer/answer/11926878`
- Para cuentas personales de Play nuevas sujetas a sus requisitos de prueba, se necesita un mínimo de **12 testers durante 14 días continuados** antes de solicitar acceso a producción. `https://support.google.com/googleplay/android-developer/answer/14151465`

## Metadatos sugeridos para la ficha (revisar con la empresa)

- **Nombre:** REPARADO
- **Descripción breve:** Solicita reparaciones del hogar en Cataluña y consulta el seguimiento de tus trabajos.
- **Descripción:** REPARADO ayuda a solicitar servicios de fontanería, albañilería y pladur, parquet y pequeños arreglos. Explora servicios y precios orientativos con IVA incluido, describe lo que necesitas y adjunta fotografías. Tras la aceptación del trabajo por el equipo, podrás seguir su estado y comunicarte con REPARADO desde tu cuenta. Las funciones que dependan del backend requieren inicio de sesión y disponibilidad del servicio.
- **Importante:** no indicar pago en app ni factura automática certificada hasta implementar y comprobar dichas funciones.

## No publicar sin cumplir
- [ ] Backend REAL en producción y pruebas con cliente y operario.
- [ ] Responsabilidad legal, soporte, política de privacidad y solicitud web de borrado.
- [ ] Flujo de eliminación procesado, no solo formulario.
- [ ] Firma AAB/IPA y cuentas de desarrollador activas.
- [ ] Capturas reales y formularios de datos/edad completados.
- [ ] Prueba interna/testflight terminada y revisión satisfactoria.

## Correos oficiales para las fichas de las tiendas

- **Soporte y problemas de la aplicación:** `reparado_soporte@outlook.es`. Usar como dirección de soporte pública en App Store Connect y Google Play Console.
- **Consultas y solicitudes de servicios:** `reparado_clientes@outlook.es`. Este es el buzón comercial. En una app conectada, las solicitudes se registran primero en Supabase; el email automático depende de configurar el worker seguro de `docs/CONFIGURAR-CORREOS.md`.
- Los enlaces `mailto:` abren el programa de correo del cliente, pero **no envían nada hasta que la persona pulse Enviar**. No afirmar que se ha recibido un aviso mientras no exista un servicio de envío activado y comprobado.
- La cuenta de Apple Developer ya está disponible; **Google Play Console todavía no**. Alta oficial: https://play.google.com/console/signup (25 USD de pago único, elección de tipo de cuenta y verificación). La cuenta de Google Play deberá crearla el titular con sus credenciales propias, no introducirlas en GitHub.

## Páginas públicas preparadas para las tiendas

Estas páginas estáticas se incluyen en la compilación web de Vite, tanto para GitHub Pages como dentro del paquete Capacitor:

- **Soporte público:** https://warks1.github.io/REPARADO/soporte.html
- **Solicitud web de eliminación de cuenta:** https://warks1.github.io/REPARADO/eliminar-cuenta.html

El segundo enlace permite iniciar una solicitud de borrado desde un dispositivo sin tener la aplicación instalada; abre el correo de soporte del titular. **No envía ningún mensaje automáticamente**, y requiere que el usuario confirme el envío desde su cliente de correo. El formulario dentro de la aplicación autenticada sigue siendo independiente y registra la petición directamente en Supabase.

Antes de subir a App Store/Google Play: comprobar que las URLs están publicadas, que el buzón tiene respuesta y verificación de titularidad, y que se procesa de verdad la eliminación de todos los datos borrables (cuentas, solicitudes, fotos, chats y reseñas). Revisar jurídicamente plazos de retención y RGPD. Un enlace visible **no sustituye** esta operación real.

Referencias de política de las tiendas: https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/ y https://support.google.com/googleplay/android-developer/answer/13327111?hl=es .

Queda pendiente la **política de privacidad definitiva**, que necesita identificación del responsable y información sobre tratamiento y retención; no se han inventado estos datos.
