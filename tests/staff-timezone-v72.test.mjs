import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {
  madridDateTimeInput,madridDateTimeText,
  madridLocalDateTimeToIso,madridVisitDateTimeToIso
} from '../staff-timezone.js';

test('V72: convertir horas catalanas a UTC en invierno y verano',()=>{
  assert.deepEqual(madridLocalDateTimeToIso('2026-01-03T15:15'),
    {iso:'2026-01-03T14:15:00.000Z',error:null});
  assert.deepEqual(madridLocalDateTimeToIso('2026-07-03T15:15'),
    {iso:'2026-07-03T13:15:00.000Z',error:null});
  assert.equal(madridDateTimeInput('2026-01-03T14:15:00Z'),'2026-01-03T15:15');
  assert.equal(madridDateTimeInput('2026-07-03T13:15:00+00:00'),'2026-07-03T15:15');
  assert.equal(madridDateTimeInput(null),'');
  assert.equal(madridDateTimeInput('2026-07-03T15:15'),'');
  assert.equal(madridDateTimeText(null),'Sin fecha');
});

test('V72: no programar fechas inexistentes o horas ambiguas por cambio horario',()=>{
  for(const date of ['2026-03-29T02:00','2026-03-29T02:30','2026-03-29T02:59']){
    assert.match(madridLocalDateTimeToIso(date).error,/no existe/);
  }
  for(const date of ['2026-10-25T02:00','2026-10-25T02:30','2026-10-25T02:59']){
    assert.match(madridLocalDateTimeToIso(date).error,/se repite/);
  }
  assert.equal(madridLocalDateTimeToIso('2026-03-29T03:30').iso,'2026-03-29T01:30:00.000Z');
  assert.equal(madridLocalDateTimeToIso('2026-10-25T03:30').iso,'2026-10-25T02:30:00.000Z');
  for(const date of ['2026-02-30T12:00','2026-13-01T12:00','2026-02-29T12:00','2026-01-02T25:30','mal']){
    assert.ok(madridLocalDateTimeToIso(date).error,date);
  }
});

test('V72: conservar instante anterior si no se modifica la hora ambigua',()=>{
  assert.deepEqual(madridVisitDateTimeToIso('2026-10-25T02:30','2026-10-25T00:30:00Z'),
    {iso:'2026-10-25T00:30:00.000Z',error:null});
  assert.deepEqual(madridVisitDateTimeToIso('2026-10-25T02:30','2026-10-25T01:30:00Z'),
    {iso:'2026-10-25T01:30:00.000Z',error:null});
  assert.match(madridVisitDateTimeToIso('2026-10-25T02:30',null).error,/se repite/);
  assert.deepEqual(madridVisitDateTimeToIso('', '2026-07-03T13:15:00Z'),{iso:null,error:null});
});

test('V72: conversión idéntica desde dispositivos en otra zona horaria',()=>{
  const source='import {madridDateTimeInput,madridVisitDateTimeToIso} from '+
    JSON.stringify(new URL('../staff-timezone.js',import.meta.url).href)+';'+
    'if(madridDateTimeInput("2026-07-03T13:15:00Z")!=="2026-07-03T15:15")process.exit(1);'+
    'if(madridVisitDateTimeToIso("2026-07-03T15:15",null).iso!=="2026-07-03T13:15:00.000Z")process.exit(2);';
  for(const tz of ['UTC','America/Los_Angeles','Asia/Tokyo']){
    const result=spawnSync(process.execPath,['--input-type=module','-e',source],{
      env:{...process.env,TZ:tz},encoding:'utf8',timeout:10000
    });
    assert.equal(result.status,0,tz+' '+result.stderr);
  }
});

test('V72: agenda real utiliza Europe/Madrid al ver y guardar visitas',()=>{
  const app=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.ok(app.includes("import {madridDateTimeInput,madridDateTimeText,madridVisitDateTimeToIso} from './staff-timezone.js'"));
  assert.ok(app.includes('const safeTime = madridDateTimeText;'));
  assert.ok(app.includes('Fecha y hora (Cataluña)'));
  assert.ok(app.includes('madridDateTimeInput(job.scheduled_at)'));
  assert.ok(app.includes('madridVisitDateTimeToIso(date,original.scheduled_at)'));
  assert.ok(app.includes("if(visitTime.error)return message('Fecha y hora no válidas. '+visitTime.error,true)"));
  assert.ok(!app.includes('const stamp=date?new Date(date):null'));
});
