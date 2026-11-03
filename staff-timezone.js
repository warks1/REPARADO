// REPARADO V72 · Agenda en horario civil de Cataluña, sin depender del dispositivo.
// datetime-local no lleva huso horario: convertir explícitamente a Europe/Madrid.
const formatter = new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
const displayFormatter = new Intl.DateTimeFormat('es-ES',{
  timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'
});
function wallTime(date){
  if(!(date instanceof Date)||!Number.isFinite(date.getTime()))return '';
  const parts=formatter.formatToParts(date);
  const part=type=>parts.find(x=>x.type===type)?.value||'';
  return part('year')+'-'+part('month')+'-'+part('day')+'T'+part('hour')+':'+part('minute');
}
export function madridDateTimeInput(instant){
  if(!instant)return '';
  // Rechazar valores sin zona: interpretarlos con la zona local del móvil
  // podría modificar silenciosamente una cita ya confirmada.
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(String(instant)))return '';
  return wallTime(new Date(instant));
}
export function madridDateTimeText(instant){
  if(!instant)return 'Sin fecha';
  const date=new Date(instant);
  return Number.isFinite(date.getTime())?displayFormatter.format(date):'Sin fecha';
}
export function madridLocalDateTimeToIso(value){
  const raw=String(value??'').trim();
  if(!raw)return {iso:null,error:null};
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw))
    return {iso:null,error:'Introduce una fecha y una hora válidas.'};
  const [year,month,day,hour,minute]=raw.match(/\d+/g).map(Number);
  if(year<2000||year>2100||month<1||month>12||day<1||day>31||hour>23||minute>59)
    return {iso:null,error:'Introduce una fecha y una hora válidas.'};
  const localMillis=Date.UTC(year,month-1,day,hour,minute);
  // UTC+1 (invierno), UTC+2 (verano): las dos opciones se comprueban
  // con Intl para detectar horas que no existen o que se repiten por DST.
  const matches=[60,120].map(offset=>new Date(localMillis-offset*60000))
    .filter(date=>wallTime(date)===raw);
  if(matches.length===0)
    return {iso:null,error:'Esa fecha u hora no existe en Cataluña. Revisa el cambio horario y elige otra hora.'};
  if(matches.length>1)
    return {iso:null,error:'Esa hora se repite durante el cambio horario de octubre en Cataluña. Elige otra hora para evitar una visita ambigua.'};
  return {iso:matches[0].toISOString(),error:null};
}
export function madridVisitDateTimeToIso(value,previousInstant){
  const raw=String(value??'').trim();
  // Si solo se cambia el estado o el operario, conservar el instante
  // original aunque fuera una de las dos horas repetidas de octubre.
  if(raw && madridDateTimeInput(previousInstant)===raw){
    const date=new Date(previousInstant);
    if(Number.isFinite(date.getTime()))return {iso:date.toISOString(),error:null};
  }
  return madridLocalDateTimeToIso(raw);
}
