# REPARADO V93 · Seis categorías con el mismo diseño

Corrección solicitada a partir de la captura de iPhone del 09/11/2026.

## Qué se corrige

Las tarjetas **Manitas** y **Electricidad** dejaban de coincidir con Fontanería,
Albañilería y Pladur, Parquet y Reformas porque tenían reglas especiales de CSS
`grid-column:1/-1`, alturas, tamaños de letra, flechas e imágenes posicionadas
a la derecha. Aparecían como dos banners apaisados debajo de cuatro tarjetas
cuadradas.

Ahora las **seis** se representan con el mismo HTML, disposición **dos columnas
y tres filas**, mismas proporciones `220/165`, animación, títulos, textos
y botones circulares. Los PNG restaurados y colores de las cuatro tarjetas
aprobadas no se han modificado.

Las ilustraciones nuevas de Manitas y Electricidad:
- Son recursos SVG separados y escalables, sin un rectángulo opaco de fondo.
- Se componen dentro del mismo contenedor con degradado y máscara suave.
- Mantienen su estilo cromático cálido (Manitas) y azul (Electricidad).
- Respetan reducción de movimiento en las opciones del dispositivo.

## Qué se mantiene

Los nombres y categorías, los servicios, precios, condiciones de materiales,
enlaces al catálogo, navegación, presupuestos, fotos de servicios, autorizaciones
de Supabase y panel del propietario no cambian con esta corrección visual.

## Comprobación

`tests/category-grid-v93.test.mjs` verifica seis tarjetas de igual estructura,
archivos transparentes y ausencia de reglas horizontales. La prueba Playwright
`e2e/category-grid-v93.spec.mjs` comprueba dimensiones, posición, imágenes,
animación y navegación en iPhone, Safari, Android y tablet; guarda captura de
la cuadrícula. Se incluyen las regresiones de Parquet/Reformas, Electricidad
y Manitas, además de la batería completa y la compilación.

**No confundir una prueba de navegador con un lanzamiento en App Store o Google
Play; la activación del entorno comercial sigue pendiente por separado.**
