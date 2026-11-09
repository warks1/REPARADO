export const services=[
 ['Fontanería','Desatasco de lavabo o fregadero',115],
 ['Fontanería','Cambio de sifón',105],
 ['Fontanería','Reparación de fuga',165],
 ['Fontanería','Sustitución de grifo',175],
 ['Fontanería','Mecanismo de cisterna',145],
 ['Fontanería','Cambio de llave de paso',145],
 ['Fontanería','Instalación de termo eléctrico',495],
 ['Fontanería','Revisión de instalación de agua',125],
 ['Albañilería','Reposición de azulejos',165],
 ['Albañilería','Alicatado',69,'m²'],
 ['Albañilería','Solado de gres',75,'m²'],
 ['Albañilería','Rejuntado',39,'m²'],
 ['Albañilería','Tabique de Pladur',65,'m²'],
 ['Albañilería','Trasdosado de Pladur',55,'m²'],
 ['Albañilería','Techo de Pladur',72,'m²'],
 ['Albañilería','Reparación de enlucidos',155],
 ['Parquet','Instalación de parquet/laminado',49,'m²'],
 ['Parquet','Reparación de tablas',165],
 ['Parquet','Acuchillado/lijado',19,'m²'],
 ['Parquet','Barnizado',16,'m²'],
 ['Parquet','Retirada de pavimento',23,'m²'],
 ['Parquet','Colocación de rodapié',22,'m'],
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
 ['Manitas','Cambio de manilla de puerta',69]
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
    ? '\\nMaterial (Manitas): solicitar presupuesto adicional de materiales; no incluido en tarifa.'
    : '\\nMaterial (Manitas): el cliente lo aporta. Precio orientativo sin materiales.';
}

// V61 · Revisión 03-11-2026. Tarifa final con IVA 21 %, materiales y mano de obra estándar.
export const catalogPricingNotice = "Precios orientativos «desde» para Cataluña. Incluyen mano de obra, desplazamiento ordinario en zona, materiales estándar descritos e IVA del 21 %. Los artículos aportados por el cliente se especifican en cada servicio. Los mínimos de superficie, los extras y los trabajos no estándar requieren valoración; el presupuesto final se confirma antes de ejecutar el trabajo.";
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
  "Cambio de manilla de puerta": "Desmontaje y montaje de manilla compatible en puerta existente; juego de manillas, tornillería y piezas aportados por el cliente."
});
