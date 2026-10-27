# REPARADO V47 · PrivacyInfo.xcprivacy para iOS

Apple exige que las aplicaciones declaren los usos de determinadas API del sistema. Desde V46, REPARADO utiliza `@capacitor/filesystem` para escribir temporalmente una cita `.ics` y compartirla desde iPhone. Capacitor documenta el uso de la categoría **FileTimestamp**, con el motivo **C617.1**.

## Instalación en las compilaciones automatizadas

La fuente versionada es `native/ios/PrivacyInfo.xcprivacy`; `ios/` se regenera en GitHub Actions y no debe editarse como fuente principal.

Después de `npx cap add ios` y `npx cap sync ios` se ejecutan:

```sh
python3 scripts/install-ios-privacy.py
ruby scripts/link-ios-privacy.rb
plutil -lint ios/App/App/PrivacyInfo.xcprivacy
```

El instalador **conserva las declaraciones existentes** al añadir FileTimestamp/C617.1. El script Ruby agrega el archivo a `Copy Bundle Resources` del target `App`, sin duplicar referencias. El sistema de compilación **comprueba el archivo final** en la raíz de `App.app`, no solo la existencia de un archivo fuente. En el caso de la compilación comercial se comprueba también el `.xcarchive` antes de exportar el IPA.

El control se aplica a la compilación de simulador, al archivo iOS de prueba sin firma y al flujo de IPA firmado para App Store. Si falta el archivo o el motivo requerido, **la compilación falla antes de dar por válida la entrega**.

## Límites y tareas restantes

Esta declaración solo cubre el acceso FileTimestamp del plugin de archivos. No equivale a haber completado la sección **App Privacy** de App Store Connect: el equipo debe revisar datos recogidos (nombre, correo, teléfono, domicilios, solicitudes, fotografías, mensajes), finalidades, retención, proveedores, seguimiento y derechos RGPD. No se ha añadido una declaración vacía de datos recogidos porque sería engañosa.

La integración tampoco demuestra que Apple vaya a aprobar la app. Antes de enviarla se debe revisar la lista completa de SDK y sus manifiestos, probar la importación de calendarios en un iPhone físico, y ejecutar el análisis de privacidad del archivo distribuible con Xcode.

Documentación de referencia:
- [Apple — agregar un manifiesto de privacidad](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk)
- [Capacitor Filesystem — requisitos Apple](https://capacitorjs.com/docs/apis/filesystem)
- [Apple — informe de privacidad de aplicaciones](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
