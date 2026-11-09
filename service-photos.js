// Fotografías ilustrativas de servicios que antes solo mostraban un emoji.
// Pexels: enlaces directos de imágenes publicadas bajo su licencia gratuita.
// Se mantienen las fotografías locales originales; las de Pexels requieren conexión.
// Procedencia y condiciones: public/creditos-fotos-servicios.html
const photos = new Map([
  // V86 · Fotografías ilustrativas reales de electricidad con fuente Pexels.
  ["Sustitución de enchufe estándar",5691590],
  ["Sustitución de interruptor o conmutador",5691589],
  ["Instalación de base de enchufe doble",5691588],
  ["Nuevo punto de enchufe superficial",5691642],
  ["Nuevo punto de luz con canalización vista",20500461],
  ["Sustitución de diferencial estándar",9679179],
  ["Sustitución de magnetotérmico estándar",27928760],
  ["Diagnóstico de avería eléctrica doméstica",33694019],
  ["Instalación de detector de movimiento para luz",10410250],
  ["Instalación de timbre eléctrico sencillo",6407436],
  [
    "Cambio de sifón",
    16509869
  ],
  [
    "Mecanismo de cisterna",
    26925303
  ],
  [
    "Cambio de llave de paso",
    6899446
  ],
  [
    "Revisión de instalación de agua",
    19878528
  ],
  [
    "Reposición de azulejos",
    29181494
  ],
  [
    "Alicatado",
    29181494
  ],
  [
    "Solado de gres",
    29181494
  ],
  [
    "Rejuntado",
    35493886
  ],
  [
    "Tabique de Pladur",
    4981812
  ],
  [
    "Trasdosado de Pladur",
    11427524
  ],
  [
    "Techo de Pladur",
    6474123
  ],
  [
    "Reparación de enlucidos",
    5493658
  ],
  [
    "Instalación de parquet/laminado",
    4263067
  ],
  [
    "Reparación de tablas",
    6790935
  ],
  [
    "Acuchillado/lijado",
    7789867
  ],
  [
    "Barnizado",
    8146323
  ],
  [
    "Retirada de pavimento",
    6046819
  ],
  [
    "Colocación de rodapié",
    7031621
  ],
  [
    "Reforma integral de baño",
    35493886
  ],
  [
    "Reforma integral de cocina",
    15124970
  ],
  [
    "Reforma de vivienda",
    8292785
  ]
]);
export const missingServicePhotoNames = Object.freeze([...photos.keys()]);
export function additionalServicePhoto(serviceName){
  const id=photos.get(serviceName);
  if(!id)return null;
  return {
    url:'https://images.pexels.com/photos/'+id+'/pexels-photo-'+id+'.jpeg?auto=compress&cs=tinysrgb&w=420&h=360&fit=crop',
    source:'https://www.pexels.com/photo/'+id+'/'
  };
}
