import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calendarEscape,calendarFold,visitCalendarText,visitCalendarFilename} from '../visit-calendar.js';

const id='10000000-0000-4000-8000-000000000003';
const visit={
  id,service_name:'Reparación de fuga',scheduled_at:'2026-10-28T10:30:00+01:00',
  status:'scheduled',operator_name:'Operario X',phone:'600000000',
  street:'Dirección particular 123',customer_id:'60000000-0000-4000-8000-000000000004'
};
const generatedAt=new Date('2026-10-27T08:12:00Z');
const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');

test('V45: exportar fecha exacta en UTC aunque el servidor envíe otra zona horaria',()=>{
  const output=visitCalendarText(visit,{generatedAt});
  assert.match(output,/BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  assert.match(output,/DTSTAMP:20261027T081200Z/);
  assert.match(output,/DTSTART:20261028T093000Z/);
  assert.match(output,/UID:10000000-0000-4000-8000-000000000003@reparado\.local/);
  assert.match(output,/DURATION:PT1H/);
  assert.match(output,/TRIGGER:-PT1H/);
  assert.match(output,/END:VCALENDAR\r\n$/);
  assert.equal(visitCalendarFilename(visit),'REPARADO-visita-'+id+'.ics');
});

test('V45: escapa texto y evita inyección de nuevas propiedades en iCalendar',()=>{
  assert.equal(calendarEscape('Uno, dos; tres\\cuatro\r\nEND:VEVENT'), 'Uno\\, dos\\; tres\\\\cuatro\\nEND:VEVENT');
  const output=visitCalendarText({...visit,service_name:'Cita\r\nBEGIN:VEVENT\r\nATTENDEE:mailto:malicioso@example.com'},{generatedAt});
  assert.equal((output.match(/BEGIN:VEVENT/g)||[]).length,2); // una literal escapada y la verdadera
  assert.equal((output.match(/\r\nBEGIN:VEVENT\r\n/g)||[]).length,1);
  assert.doesNotMatch(output,/\r\nATTENDEE:/);
  assert.doesNotMatch(output,/mailto:malicioso@example.com\r\n/);
  assert.match(output,/SUMMARY:REPARADO/);
});

test('V45: respeta el límite de 75 octetos por línea con texto Unicode',()=>{
  const folded=calendarFold('SUMMARY:'+('Ñ🏠'.repeat(90)));
  const parts=folded.split('\r\n');
  assert.ok(parts.length>1);
  assert.ok(parts.every(part=>new TextEncoder().encode(part).length<=75));
  assert.equal(parts.slice(1).every(part=>part.startsWith(' ')),true);
  assert.equal(parts.join('').replace(/\n/g,'').replace(/\r/g,'').replace(/ /g,''),('SUMMARY:'+('Ñ🏠'.repeat(90))).replace(/ /g,''));
});

test('V45: el archivo no revela direcciones, teléfonos ni datos personales de otro tipo',()=>{
  const output=visitCalendarText(visit,{generatedAt});
  assert.doesNotMatch(output,/600000000|Dirección particular|Operario X|customer_id/);
  assert.match(output,/bloque de una hora es provisional/);
});

test('V45: solo citas programadas con hora real y UUID admiten exportación',()=>{
  for(const bad of [
    {...visit,id:'../../private'},
    {...visit,status:'new'}, {...visit,status:'cancelled'},
    {...visit,status:'in_progress'},
    {...visit,scheduled_at:null},
    {...visit,scheduled_at:'2026-10-28T10:30:00'},
    {...visit,scheduled_at:'2026-10-28T10:30:00+99:99'}
  ])assert.throws(()=>visitCalendarText(bad,{generatedAt}));
});

test('V45: botón disponible solo desde el listado privado de agenda',()=>{
  assert.match(code,/select\('id,service_name,scheduled_at,status,operator_name'\)/);
  assert.match(code,/\.eq\('customer_id',userId\)/);
  assert.match(code,/data-visit-calendar/);
  assert.match(code,/r\.status==='scheduled'&&r\.scheduled_at/);
  assert.match(code,/authEpoch!==epoch/);
  assert.match(code,/isCurrentUser\(userId\)/);
  assert.match(code,/data\?\.find\(row=>row\.id===button\.dataset\.visitCalendar/);
  assert.match(code,/shareVisitCalendar\(visit\)/);
});
