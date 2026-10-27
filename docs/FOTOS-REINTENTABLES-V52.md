# REPARADO V52 · Reintentos de fotografías sin duplicados

Cuando una solicitud ya se ha guardado pero se pierde la respuesta de la subida de una foto, el cliente puede reintentar desde **Mis solicitudes** sin crear otra solicitud. Para nuevas imágenes se utiliza un nombre derivado de SHA-256 del contenido, dentro de la ruta privada cliente/solicitud. El nombre es estable si se vuelve a seleccionar la misma imagen aunque el archivo local haya cambiado de nombre.

## Comportamiento

- Siempre consulta la carpeta privada actual antes de subir. Las imágenes anteriores con nombres aleatorios cuentan dentro del límite de cuatro, pero **no se pueden reconocer como duplicadas por contenido**.
- Si ya existe el nombre de la misma foto, informa de que estaba adjuntada y no vuelve a subirla.
- Si Supabase devuelve error de red tras haberla guardado, consulta de nuevo la carpeta; solo indica «recuperada» si aparece el nombre esperado.
- Antes de subir cada fichero verifica que la sesión y la pantalla siguen correspondiendo al mismo cliente. Si cambia la cuenta, aborta las siguientes subidas.
- Se conserva la política RLS que exige solicitud real, cliente propietario y bucket privado. La huella no concede acceso a otros clientes.
- La app muestra por separado fotos nuevas, recuperadas, presentes y fallidas. Nunca elimina fotografías existentes por reintentar.

## Limitaciones

El límite de cuatro está controlado en la interfaz. **La política de Storage V12 no aplica una cuota atómica en el servidor**; no se garantiza que dos dispositivos subiendo simultáneamente no excedan el máximo. Esa garantía necesitará un backend transaccional de subida y revisión de la arquitectura Storage antes de activarlo en producción.

Los archivos con los mismos bytes pueden deduplicarse; si el usuario recorta, recomprime o modifica una foto, su huella cambia y se tratará como distinta. El hash del contenido no se debe utilizar como identificador público, aunque la carpeta esté protegida por RLS.

Se requiere Web Crypto SHA-256, habitual en HTTPS e instalaciones nativas modernas. Si no está disponible, se informa de fallo en lugar de subir con un nombre sin poder reintentarlo de forma fiable.

## Pruebas pendientes antes de producción

1. Dos clientes autenticados: uno no ve ni sube fotografías al trabajo ajeno.
2. Simular pérdida de respuesta de Storage y reintentar desde Android e iPhone.
3. Revisar rutas con objetos anteriores de nombres aleatorios, un total de cuatro y selecciones duplicadas.
4. Probar cierre de sesión a mitad de una subida y reconexión con una cuenta distinta.
