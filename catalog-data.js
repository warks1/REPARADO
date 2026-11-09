export const services=[
 ['Fontanería','Desatasco de lavabo o fregadero',125],
 ['Fontanería','Cambio de sifón',115],
 ['Fontanería','Reparación de fuga',179],
 ['Fontanería','Sustitución de grifo',189],
 ['Fontanería','Mecanismo de cisterna',159],
 ['Fontanería','Cambio de llave de paso',159],
 ['Fontanería','Instalación de termo eléctrico',539],
 ['Fontanería','Revisión de instalación de agua',135],
 ['Albañilería','Reposición de azulejos',179],
 ['Albañilería','Alicatado',75,'m²'],
 ['Albañilería','Solado de gres',82,'m²'],
 ['Albañilería','Rejuntado',43,'m²'],
 ['Albañilería','Tabique de Pladur',72,'m²'],
 ['Albañilería','Trasdosado de Pladur',61,'m²'],
 ['Albañilería','Techo de Pladur',79,'m²'],
 ['Albañilería','Reparación de enlucidos',169],
 ['Parquet','Instalación de parquet/laminado',54,'m²'],
 ['Parquet','Reparación de tablas',179],
 ['Parquet','Acuchillado/lijado',21,'m²'],
 ['Parquet','Barnizado',18,'m²'],
 ['Parquet','Retirada de pavimento',25,'m²'],
 ['Parquet','Colocación de rodapié',24,'m'],
 ['Reformas integrales','Reforma integral de baño',0],
 ['Reformas integrales','Reforma integral de cocina',0],
 ['Reformas integrales','Reforma de vivienda',0],
 // Tarifas orientativas para Cataluña, IVA del 21 % incluido.
 // En Manitas el material lo aporta el cliente; los extras se presupuestan aparte.
 // Trabajos complejos y desplazamientos fuera de zona requieren valoración.
 ['Manitas','Montaje de mueble en kit (mediano)',99],
 ['Manitas','Colocación de estantería',75],
 ['Manitas','Colgar cuadros o espejos (hasta 3)',69],
 ['Manitas','Instalación de barras de cortina o estores',89],
 ['Manitas','Instalación de soporte de TV en pared',109],
 ['Manitas','Ajuste de puertas y bisagras',79],
 ['Manitas','Cambio de cinta de persiana',79],
 ['Manitas','Renovación de silicona de bañera o ducha',79],
 ['Manitas','Instalación de lámpara sencilla',89],
 ['Manitas','Colocación de accesorios de baño',79],
 ['Manitas','Reparación menor de muebles',89],
 ['Manitas','Cambio de manilla de puerta',69],
 // V86 · Electricidad: visitas ordinarias de personal cualificado, IVA 21 % incluido.
 // Suministro de materiales estándar contemplados en cada alcance; instalaciones
 // empotradas, cableados complejos y certificaciones requieren presupuesto específico.
 ['Electricidad','Sustitución de enchufe estándar',89],
 ['Electricidad','Sustitución de interruptor o conmutador',89],
 ['Electricidad','Instalación de base de enchufe doble',125],
 ['Electricidad','Nuevo punto de enchufe superficial',185],
 ['Electricidad','Nuevo punto de luz con canalización vista',195],
 ['Electricidad','Sustitución de diferencial estándar',159],
 ['Electricidad','Sustitución de magnetotérmico estándar',129],
 ['Electricidad','Diagnóstico de avería eléctrica doméstica',125],
 ['Electricidad','Instalación de detector de movimiento para luz',155],
 ['Electricidad','Instalación de timbre eléctrico sencillo',149]
];

// V85 · Manitas: tarifas SOLO de servicio, material aportado por el cliente.
// Referencia orientativa Cataluña 2026: mano de obra, desplazamiento ordinario
// en zona y 21 % IVA incluidos. No se modifican presupuestos ya aceptados.
export const manitasPricingNotice = "Manitas · Precios orientativos «desde» en Cataluña, con mano de obra, herramientas, desplazamiento ordinario en zona e IVA del 21 % incluidos. MATERIAL NO INCLUIDO: muebles, accesorios, fijaciones, recambios, tornillería y consumibles los aporta el cliente. Si necesitas que REPARADO suministre algún material, solicita un presupuesto adicional antes del trabajo. Los casos especiales y desplazamientos fuera de zona se valoran aparte.";
export const servicePriceTerms = service => service?.[2]<=0
  ? 'Sujeto a presupuesto'
  : service?.[0]==='Manitas'
    ? 'Mano de obra, desplazamiento ordinario e IVA del 21 % incluidos · material NO incluido (lo aporta el cliente)'
    : 'Material estándar, mano de obra e IVA incluidos';
export const manitasMaterialQuestionMarkup = `<fieldset class="manitas-material-choice">
  <legend>Material para el trabajo de Manitas (no incluido en el precio)</legend>
  <label><input type="radio" name="manitas_material" value="client" checked> Ya tengo y aportaré el material necesario</label>
  <label><input type="radio" name="manitas_material" value="quote"> Necesito presupuesto aparte para el material</label>
</fieldset>`;
export function manitasMaterialRequestNote(service,choice){
  if(service?.[0]!=='Manitas')return '';
  return choice==='quote'
    ? '\nMaterial (Manitas): solicitar presupuesto adicional de materiales; no incluido en tarifa.'
    : '\nMaterial (Manitas): el cliente lo aporta. Precio orientativo sin materiales.';
}

// V86 · Tarificación media-alta orientativa para Cataluña con IVA del 21 %.
// Se actualizan precios de Fontanería, Albañilería y Parquet; Manitas mantiene
// el material aportado por el cliente (V85) y Reformas integrales por presupuesto.
// Los importes de catálogo no reescriben solicitudes, presupuestos ni facturas anteriores.
export const electricidadPricingNotice = "Electricidad · Precios orientativos «desde» para Cataluña, con visita de profesional cualificado, mano de obra, desplazamiento ordinario, materiales estándar indicados e IVA del 21 % incluidos. Reparaciones ocultas, rozas, líneas nuevas complejas, certificados, urgencias y trabajos fuera de zona requieren presupuesto antes de ejecutarse.";
// V61 · Revisión 03-11-2026. Tarifa final con IVA 21 %, materiales y mano de obra estándar.
export const catalogPricingNotice = "Precios orientativos de gama media-alta «desde» para Cataluña. Incluyen mano de obra, desplazamiento ordinario en zona, materiales estándar descritos e IVA del 21 %. Los artículos aportados por el cliente se especifican en cada servicio. Los mínimos de superficie, los extras y los trabajos no estándar requieren valoración; el presupuesto final se confirma antes de ejecutar el trabajo.";
export const serviceInclusions = Object.freeze({
  "Desatasco de lavabo o fregadero": "Desatasco sencillo accesible: mano de obra, herramientas y consumibles incluidos; sin obras ni camión cuba.",
  "Cambio de sifón": "Sifón PVC estándar, juntas, conexiones y sustitución; sin modificación de desagües empotrados.",
  "Reparación de fuga": "Una fuga visible y accesible, racores y tramo corto estándar; sin apertura ni reposición de paredes.",
  "Sustitución de grifo": "Grifo monomando estándar de gama media, latiguillos y montaje en tomas existentes.",
  "Mecanismo de cisterna": "Mecanismo universal de cisterna vista, juntas y sustitución; cisternas empotradas por presupuesto.",
  "Cambio de llave de paso": "Llave de paso estándar, conexiones y sustitución con acceso directo.",
  "Instalación de termo eléctrico": "Termo eléctrico de 80 l estándar, conexiones, sustitución en el mismo punto y puesta en marcha; sin obra eléctrica.",
  "Revisión de instalación de agua": "Visita, revisión visual de instalación accesible y consumibles de diagnóstico; reparaciones aparte.",
  "Reposición de azulejos": "Hasta 1 m² de azulejo cerámico estándar, adhesivo, rejunte y colocación; tono idéntico no garantizado.",
  "Alicatado": "Cerámica gama media, adhesivo, juntas y colocación sobre pared preparada; desde 8 m², sin demolición.",
  "Solado de gres": "Gres gama media, adhesivo, juntas y colocación sobre base preparada; desde 8 m², sin retirada previa.",
  "Rejuntado": "Material de juntas y limpieza para rejuntado convencional; desde 8 m², sin sustituir baldosas.",
  "Tabique de Pladur": "Placas estándar, perfilería, tornillería y juntas listas para pintar; desde 10 m², sin pintura.",
  "Trasdosado de Pladur": "Placas estándar, perfilería, fijaciones y tratamiento de juntas; desde 10 m², sin aislamiento extra ni pintura.",
  "Techo de Pladur": "Falso techo sencillo, placas, perfilería y juntas listas para pintar; desde 10 m², sin pintura.",
  "Reparación de enlucidos": "Reparación localizada hasta 1 m² con yeso o masilla y acabado listo para pintar; sin pintura.",
  "Instalación de parquet/laminado": "Laminado AC5 estándar, manta base y montaje sobre suelo nivelado; desde 15 m², sin rodapié.",
  "Reparación de tablas": "Sustitución de hasta dos lamas laminadas estándar compatibles; tono idéntico no garantizado.",
  "Acuchillado/lijado": "Lijado de parquet de madera apto y abrasivos; desde 20 m², sin barnizado (se contrata aparte).",
  "Barnizado": "Barniz al agua estándar, dos manos y aplicación sobre parquet preparado; desde 20 m², sin lijado profundo.",
  "Retirada de pavimento": "Levantado de suelo flotante y consumibles de recogida; desde 15 m², sin nivelación ni desescombro especial.",
  "Colocación de rodapié": "Rodapié MDF blanco estándar, adhesivos, cortes y colocación; desde 15 metros lineales.",
  "Reforma integral de baño": "Los materiales, calidades y mano de obra se detallan en un presupuesto personalizado tras medir.",
  "Reforma integral de cocina": "Los materiales, mobiliario, instalaciones y mano de obra se detallan en presupuesto personalizado.",
  "Reforma de vivienda": "Los materiales, calidades, alcance y mano de obra se detallan en presupuesto personalizado.",
  "Montaje de mueble en kit (mediano)": "Montaje y ajustes de un mueble mediano en kit aportado por el cliente. No incluye muebles, herrajes, fijaciones ni tornillería: los aporta el cliente.",
  "Colocación de estantería": "Colocación y nivelación de una estantería de tamaño estándar; estantería, escuadras, tacos y tornillos aportados por el cliente.",
  "Colgar cuadros o espejos (hasta 3)": "Nivelación y colocación de hasta tres cuadros o espejos del cliente; anclajes, tacos y demás fijaciones aportados por el cliente.",
  "Instalación de barras de cortina o estores": "Montaje de barra, riel o estor estándar aportado por el cliente, con soportes, tacos y tornillos también del cliente; sin trabajos a medida.",
  "Instalación de soporte de TV en pared": "Instalación y nivelación de soporte de TV en pared apta; soporte, tornillería, tacos especiales y televisor aportados por el cliente.",
  "Ajuste de puertas y bisagras": "Ajuste y reglaje de puertas interiores y bisagras existentes; los herrajes, bisagras o tornillos nuevos los aporta el cliente.",
  "Cambio de cinta de persiana": "Sustitución y ajuste de cinta en persiana accesible; la cinta, recogedor y demás recambios los aporta el cliente.",
  "Renovación de silicona de bañera o ducha": "Retirada de sellado antiguo y aplicación de nueva junta hasta 4 metros; silicona sanitaria y consumibles aportados por el cliente.",
  "Instalación de lámpara sencilla": "Montaje de luminaria sencilla en punto eléctrico existente; lámpara, bombillas y conectores compatibles aportados por el cliente. Sin nuevo cableado.",
  "Colocación de accesorios de baño": "Nivelación e instalación de hasta dos accesorios de baño; accesorios, soportes, tacos y tornillos aportados por el cliente.",
  "Reparación menor de muebles": "Ajuste, encolado o pequeñas reparaciones en un mueble; cola, piezas, tornillería y herrajes aportados por el cliente.",
  "Cambio de manilla de puerta": "Desmontaje y montaje de manilla compatible en puerta existente; juego de manillas, tornillería y piezas aportados por el cliente.",
  "Sustitución de enchufe estándar": "Retirada de una base deteriorada y montaje de enchufe tipo Schuko estándar compatible, con comprobación de funcionamiento sobre cableado existente y seguro. Sin rozas ni línea nueva.",
  "Sustitución de interruptor o conmutador": "Cambio de un interruptor o conmutador estándar compatible, con mecanismo, marco básico y comprobación. Sin reforma del circuito ni reparaciones de cableado oculto.",
  "Instalación de base de enchufe doble": "Sustitución en caja existente por una base doble estándar apta, mecanismo y conexiones compatibles. Requiere caja y circuito con capacidad adecuada; no incluye tendido nuevo.",
  "Nuevo punto de enchufe superficial": "Punto adicional en superficie hasta 2 metros desde derivación accesible autorizada, canaleta, cable y mecanismo estándar. Sin rozas, albañilería ni aumento de potencia.",
  "Nuevo punto de luz con canalización vista": "Punto de iluminación nuevo en superficie hasta 2 metros desde circuito apto, cableado y canaleta estándar; sin luminaria decorativa ni rozas ni trabajos en altura.",
  "Sustitución de diferencial estándar": "Retirada e instalación de un interruptor diferencial doméstico estándar compatible, pruebas básicas. Si dispara por fuga real, el diagnóstico y la reparación son adicionales.",
  "Sustitución de magnetotérmico estándar": "Sustitución de un interruptor magnetotérmico doméstico estándar compatible, con verificación básica del circuito; no incluye reforma ni ampliación de cuadro.",
  "Diagnóstico de avería eléctrica doméstica": "Visita y comprobación inicial de una avería doméstica accesible, con instrumentación y pruebas básicas. Incluye diagnóstico, no sustituye equipos ni cubre reparación posterior.",
  "Instalación de detector de movimiento para luz": "Suministro y colocación de un sensor sencillo estándar compatible en circuito de iluminación existente, ajuste y prueba. Sin nueva línea ni reforma de automatización.",
  "Instalación de timbre eléctrico sencillo": "Suministro e instalación de kit básico de timbre convencional, pulsador y conexión aprovechando canalización accesible y apta. Sin rozas ni videoportero."
});
