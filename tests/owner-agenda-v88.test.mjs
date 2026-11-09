import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownerValidOperatorId,ownerVisibleVisits,ownerWeekStart,ownerWeekDays}
  from '../owner-calendar.js';

const alice='a0000000-0000-4000-8000-000000000001';
const bruno='b0000000-0000-4000-8000-000000000002';
const customer='c0000000-0000-4000-8000-000000000003';
const profiles=[
  {id:alice,full_name:'Operaria A',role:'operator'},
  {id:bruno,full_name:'Operario B',role:'operator'},
  {id:customer,full_name:'Cliente',role:'customer'}
];

test('V88: el selector solo admite un técnico real del directorio privado',()=>{
  assert.equal(ownerValidOperatorId(profiles,alice),alice);
  assert.equal(ownerValidOperatorId(profiles,bruno),bruno);
  for(const invalid of [null,'',customer,'not-a-uuid',
    'd0000000-0000-4000-8000-000000000004',{},999]){
    assert.equal(ownerValidOperatorId(profiles,invalid),null);
  }
  assert.equal(ownerValidOperatorId(null,alice),null);
});

test('V88: filtrar visitas no altera la lista original ni expone otras asignaciones',()=>{
  const rows=[
    {id:'1',operator_id:alice},
    {id:'2',operator_id:bruno},
    {id:'3',operator_id:alice},
    {id:'4',operator_id:null}
  ];
  assert.deepEqual(ownerVisibleVisits(rows,alice).map(x=>x.id),['1','3']);
  assert.deepEqual(ownerVisibleVisits(rows,bruno).map(x=>x.id),['2']);
  assert.deepEqual(ownerVisibleVisits(rows).map(x=>x.id),['1','2','3','4']);
  assert.equal(rows.length,4);
  assert.deepEqual(ownerVisibleVisits([],alice),[]);
  assert.deepEqual(ownerVisibleVisits(null,alice),[]);
});

test('V88: cualquier fecha del calendario abre la semana de lunes a domingo',()=>{
  assert.equal(ownerWeekStart('2027-01-14'),'2027-01-11');
  assert.deepEqual(ownerWeekDays('2027-01-14'),[
    '2027-01-11','2027-01-12','2027-01-13','2027-01-14',
    '2027-01-15','2027-01-16','2027-01-17'
  ]);
  assert.throws(()=>ownerWeekStart('2027-02-31'));
});

test('V88: el directorio pasa el ID del operador y nunca obtiene acceso de administrador',()=>{
  const people=readFileSync(new URL('../owner-people.js',import.meta.url),'utf8');
  const calendar=readFileSync(new URL('../owner-calendar.js',import.meta.url),'utf8');
  const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.ok(people.includes('else onCalendar(person.id);'));
  assert.ok(connected.includes('onCalendar:id=>showOwnerCalendar(id)'));
  assert.ok(connected.includes('async function showOwnerCalendar(initialOperatorId=null)'));
  assert.ok(connected.includes('main,supabase,initialOperatorId,'));
  assert.ok(calendar.includes('data-owner-operator-filter'));
  assert.ok(calendar.includes('data-owner-date'));
  assert.ok(calendar.includes('data-owner-today'));
  assert.ok(calendar.includes('selectedOperatorId=ownerValidOperatorId'));
  assert.ok(calendar.includes('selected.operator_id||selectedOperatorId'));
  assert.ok(calendar.includes("if(!isActive())return;"));
  assert.ok(connected.includes("const ownerOnly=()=>Boolean(session?.user?.id&&profile?.role==='admin')"));
});
