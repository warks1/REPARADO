// REPARADO V65 · Primera comprobación de la zona de servicio en Cataluña.
// Solo se comprueba el prefijo provincial del CP; no certifica que un CP,
// municipio o dirección exactos existan. La visita se confirma manualmente.
export const cataloniaServiceNotice =
  'Atendemos solicitudes en Cataluña: Barcelona (08), Girona (17), Lleida (25) y Tarragona (43). Comprueba que el código postal y el municipio coinciden. La disponibilidad y el desplazamiento se confirman por presupuesto.';

const capitalPrefix=Object.freeze({
  barcelona:'08',
  girona:'17',gerona:'17',
  lleida:'25',lerida:'25',
  tarragona:'43'
});

const normalizedCity=value=>String(value??'').trim().toLocaleLowerCase('es-ES')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'');

export function serviceAreaIssue(postalCode,city){
  const postal=String(postalCode??'').trim();
  if(!/^[0-9]{5}$/.test(postal))
    return 'Introduce un código postal válido de cinco cifras.';
  const prefix=postal.slice(0,2);
  if(!['08','17','25','43'].includes(prefix))
    return 'De momento, REPARADO admite solicitudes de trabajo en Cataluña (CP 08, 17, 25 o 43).';
  const municipality=String(city??'').trim();
  if(municipality.length<2||municipality.length>90)
    return 'Indica el municipio del servicio para comprobar la zona de atención.';
  // Detecta incoherencias claras entre las cuatro capitales y su provincia.
  // No afirma validar todos los municipios ni la existencia exacta del CP.
  const namedPrefix=capitalPrefix[normalizedCity(municipality)];
  if(namedPrefix&&namedPrefix!==prefix)
    return 'El municipio y el código postal parecen pertenecer a provincias distintas. Revisa ambos datos.';
  return null;
}

export function serviceAreaNoticeMarkup(){
  return '<p class="notice service-area-note">'+cataloniaServiceNotice+'</p>';
}
