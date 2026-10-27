// REPARADO V45 · exportación de visitas a calendarios compatibles con iCalendar.
// No pide permisos de calendario ni envía datos a servidores externos.
// La cita se consulta previamente por el usuario autenticado con RLS.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder=new TextEncoder();

export function calendarEscape(value){
  // RFC 5545: escape de barras, comas, punto y coma y saltos de línea.
  // Los controles invisibles ajenos a saltos de línea no forman parte del texto.
  return String(value??'').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,'')
    .replace(/\\/g,'\\\\').replace(/\n/g,'\\n')
    .replace(/,/g,'\\,').replace(/;/g,'\\;');
}
export function calendarFold(line){
  const folded=[];
  let part='',bytes=0,limit=75;
  for(const char of line){
    const size=encoder.encode(char).length;
    if(bytes+size>limit){
      folded.push(part);part='';bytes=0;limit=74;
    }
    part+=char;bytes+=size;
  }
  folded.push(part);
  return folded.join('\r\n ');
}
function utcIcs(date){
  return date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}
export function visitCalendarText(visit,{generatedAt=new Date()}={}){
  if(!uuid.test(String(visit?.id||'')))throw new Error('Identificador de cita no válido.');
  if(visit.status!=='scheduled')throw new Error('La visita no está programada.');
  const stamp=String(visit.scheduled_at||'');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(stamp))
    throw new Error('La hora de la cita no está confirmada.');
  const start=new Date(stamp);
  if(!Number.isFinite(start.getTime())||!(generatedAt instanceof Date)||
      !Number.isFinite(generatedAt.getTime()))
    throw new Error('La hora de la cita no es válida.');
  // La agenda no almacena la duración del trabajo: solo crear un bloque provisional.
  const service=String(visit.service_name||'').trim().slice(0,160) || 'Reparación a domicilio';
  const desc='Visita REPARADO. Confirma los detalles y posibles cambios dentro de la aplicación. '+ 
    'El bloque de una hora es provisional: no indica la duración del trabajo.';
  const lines=[
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//REPARADO//Agenda de visitas//ES',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    'UID:'+visit.id.toLowerCase()+'@reparado.local',
    'DTSTAMP:'+utcIcs(generatedAt),
    'DTSTART:'+utcIcs(start),
    'DURATION:PT1H',
    'SUMMARY:'+calendarEscape('REPARADO · '+service),
    'DESCRIPTION:'+calendarEscape(desc),
    'STATUS:CONFIRMED',
    'BEGIN:VALARM','TRIGGER:-PT1H','ACTION:DISPLAY',
    'DESCRIPTION:'+calendarEscape('Recordatorio: visita REPARADO'),
    'END:VALARM','END:VEVENT','END:VCALENDAR'
  ];
  return lines.map(calendarFold).join('\r\n')+'\r\n';
}
export function visitCalendarFilename(visit){
  if(!uuid.test(String(visit?.id||'')))throw new Error('Identificador de cita no válido.');
  return 'REPARADO-visita-'+visit.id.toLowerCase()+'.ics';
}
export function downloadVisitCalendar(visit){
  const ics=visitCalendarText(visit);
  const filename=visitCalendarFilename(visit);
  const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  try{
    const link=document.createElement('a');link.href=url;link.download=filename;
    link.style.display='none';document.body.appendChild(link);
    try{link.click()}finally{link.remove()}
  }finally{
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
}
