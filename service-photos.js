// Fotografías ilustrativas de servicios que antes solo mostraban un emoji.
// Pexels: enlaces directos de imágenes publicadas bajo su licencia gratuita.
// Se mantienen las 16 fotografías locales originales; estas nuevas requieren conexión.
// Procedencia y condiciones: public/creditos-fotos-servicios.html
const photos = new Map([
  [
    "Cambio de sifón",
    5629141
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
    1388944
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
    15124969
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
