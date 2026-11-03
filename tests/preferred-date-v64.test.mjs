import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {todayInCatalonia,preferredDateIssue,preferredDateField,preferredDateMinimum,validExistingPreferredDate} from '../date-preference.js';

test('V64: calendario de Cataluña en verano, invierno y cambios de horario',()=>{
  const pairs=[
    ['2026-01-01T22:30:00Z','2026-01-01'],
    ['2026-01-01T23:30:00Z','2026-01-02'],
    ['2026-06-01T21:30:00Z','2026-06-01'],
    ['2026-06-01T22:30:00Z','2026-06-02'],
    ['2026-03-28T23:30:00Z','2026-03-29'],
    ['2026-03-29T01:30:00Z','2026-03-29'],
    ['2026-10-25T00:30:00Z','2026-10-25'],
    ['2026-10-25T01:30:00Z','2026-10-25']
  ];
  for(const [instant,day] of pairs)
    assert.equal(todayInCatalonia(new Date(instant)),day,instant);
});

test('V64: las fechas anteriores a hoy y las imposibles no se aceptan',()=>{
  const now=new Date('2026-11-03T18:15:00Z'); // 19:15 hora de Cataluña.
  assert.equal(todayInCatalonia(now),'2026-11-03');
  assert.equal(preferredDateIssue('',now),null); // Fecha opcional.
  assert.equal(preferredDateIssue(null,now),null);
  assert.equal(preferredDateIssue('2026-11-03',now),null);
  assert.equal(preferredDateIssue('2026-11-04',now),null);
  assert.match(preferredDateIssue('2026-11-02',now),/ya ha pasado/);
  for(const bad of ['2026-02-29','2026-13-01','2026/11/03','mañana'])
    assert.match(preferredDateIssue(bad,now),/válida/);
});

test('V64: campo fecha informa que la visita está pendiente de confirmar',()=>{
  const markup=preferredDateField();
  assert.match(markup,/name="preferred_date"/);
  assert.match(markup,/type="date"/);
  assert.match(markup,/min="\d{4}-\d{2}-\d{2}"/);
  assert.match(markup,/equipo confirmará la visita/);
  const input={min:''};
  preferredDateMinimum(input,new Date('2026-06-01T22:30:00Z'));
  assert.equal(input.min,'2026-06-02');
  assert.equal(validExistingPreferredDate('2026-02-29'),'');
  assert.equal(validExistingPreferredDate('2026-10-01'),'2026-10-01');
});

test('V64: solicitudes conectadas y locales comprueban fecha antes de registrar',()=>{
  const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  const local=readFileSync(new URL('../local-preview.js',import.meta.url),'utf8');
  for(const code of [connected,local]){
    assert.match(code,/preferredDateField\(\)\+formPeriodPicker\(\)/);
    assert.match(code,/preferredDateMinimum/);
    assert.match(code,/preferredDateIssue/);
  }
  assert.ok(connected.indexOf('preferredDateIssue(fields.get')<
    connected.indexOf("const created=await submitRepairRequest("));
  assert.ok(local.includes('preferredDateIssue(data.get'));
  assert.ok(local.includes('preferredDateIssue(date)'));
  assert.match(local,/min="\x27\+todayInCatalonia\(\)/);
});
