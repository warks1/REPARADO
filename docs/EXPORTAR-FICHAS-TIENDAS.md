# REPARADO · Exportación de fichas App Store y Google Play (V40)

La fuente de verdad es [`store-metadata/es-ES.json`](../store-metadata/es-ES.json). Los archivos de `fastlane/metadata` son **copias generadas**, preparadas para importación manual o integración futura con herramientas de publicación. No se ha conectado ninguna cuenta ni enviado información a las tiendas.

## Estructura

**Google Play · idioma español (España)** — formato que reconoce `fastlane supply`:

- `fastlane/metadata/android/es-ES/title.txt`
- `fastlane/metadata/android/es-ES/short_description.txt`
- `fastlane/metadata/android/es-ES/full_description.txt`

**Apple App Store · idioma español (España)** — formato que reconoce `fastlane deliver` con `metadata_path=fastlane/metadata/ios`:

- `fastlane/metadata/ios/es-ES/name.txt`
- `fastlane/metadata/ios/es-ES/subtitle.txt`
- `fastlane/metadata/ios/es-ES/description.txt`
- `fastlane/metadata/ios/es-ES/promotional_text.txt`
- `fastlane/metadata/ios/es-ES/keywords.txt`

## Modificar las descripciones

1. Editar únicamente `store-metadata/es-ES.json`. Revisar que el contenido refleja **funciones efectivamente disponibles**, la zona Cataluña y las tarifas orientativas con IVA.
2. Ejecutar `npm run metadata:export` para generar las ocho fichas desde el archivo de origen.
3. Ejecutar `npm run metadata:check` y `npm test`. El control de GitHub Actions impide integrar metadatos desincronizados o que excedan los límites admitidos.
4. Al disponer de cuentas y cumplir los requisitos de producción, introducir los textos en App Store Connect / Play Console o integrar una herramienta de subida **con aprobación y credenciales privadas**.

**No ejecutar comandos de subida reales** solo por haber generado esta carpeta. No hay todavía autorización para cambiar las fichas de tienda. La publicación requiere una cuenta Google Play y el entorno de producción, además de las comprobaciones de privacidad, firma y pruebas con clientes reales.

**Quedan pendientes:** capturas tomadas de la app real en teléfonos, iconos en los formatos exigidos, URL de política de privacidad definitiva, formularios de datos personales y clasificación, credenciales de acceso de revisión y el proceso efectivo de eliminación de cuentas.

## Referencias de formatos

- [fastlane supply: metadatos Android](https://docs.fastlane.tools/actions/upload_to_play_store/)
- [fastlane deliver: archivos localizados Apple](https://docs.fastlane.tools/actions/deliver/)

El directorio de Apple es deliberadamente `fastlane/metadata/ios` para no mezclar el formato `name.txt` de Apple con el `title.txt` de Google. Cuando se configure deliver habrá que indicar esa ruta expresamente. **No se guardan API keys, contraseñas de tiendas ni certificados en estos archivos.**

## Descargar todas las fichas en un ZIP (V41)

La tarea de GitHub Actions **«REPARADO V41 · Descargar fichas de App Store y Google Play»** empaqueta los ocho textos de las tiendas, el JSON original y la ficha legible. Se ejecuta al incorporar cambios en las descripciones y también se puede iniciar manualmente:

1. Abrir [Actions del repositorio](https://github.com/warks1/REPARADO/actions).
2. Seleccionar **REPARADO V41 · Descargar fichas de App Store y Google Play**.
3. Pulsar **Run workflow** sobre la rama `main`. Al finalizar, abrir la ejecución y descargar el artefacto `REPARADO-Fichas-AppStore-GooglePlay`.
4. Extraer el ZIP interior `REPARADO-Fichas-AppStore-GooglePlay-es-ES.zip` para disponer de las carpetas de Apple y Google, junto a la descripción en texto plano.

No necesita cuentas de desarrollador ni secretos; únicamente genera un **paquete de textos**, no una app instalable. Los artefactos de Actions caducan a los **14 días**.

La compilación comercial de App Store y Google Play y su validación previa comprueban además `npm run metadata:check`: si la descripción original y los archivos exportados no coinciden, se detiene la compilación antes de firmar los paquetes.

La ficha y el ZIP **no se envían automáticamente** a Google ni a Apple. El responsable de la cuenta deberá introducir los textos y confirmar capturas, privacidad y publicación.
