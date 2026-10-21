import test from 'node:test';
import assert from 'node:assert/strict';
import {jobStatuses,filterJobs,jobCounters,vatIncluded,sameOperatorSlot,staffVisitGapMinutes,validateAdminJobUpdate} from '../staff-workflows.js';
const jobs=[
 {id:'a',status:'new',operator_id:null},
 {id:'b',status:'accepted',operator_id:'u1'},
 {id:'c',status:'scheduled',operator_id:'u1',scheduled_at:'2026-10-25T08:00:00Z'},
 {id:'d',status:'in_progress',operator_id:'u1',scheduled_at:'2026-10-26T08:00:00Z'},
 {id:'e',status:'completed',operator_id:'u1'},
 {id:'f',status:'cancelled',operator_id:null},
 {id:'g',status:'scheduled',operator_id:'u2',scheduled_at:'2026-10-24T08:00:00Z'}
];
test('panel interno: estadísticas y filtros no ocultan el catálogo',()=>{
 assert.equal(jobStatuses.length,7);
 assert.deepEqual(jobCounters(jobs),{all:7,pending:2,unassigned:1,agenda:3,active:1,finished:2});
 assert.deepEqual(filterJobs(jobs,'agenda').map(j=>j.id),['g','c','d']);
 assert.deepEqual(filterJobs(jobs,'finished').map(j=>j.id),['e','f']);
 assert.deepEqual(filterJobs(jobs,'pending').map(j=>j.id),['a','b']);
});
test('IVA 21 % incluido: desglosar no aumenta el precio al cliente',()=>{
 assert.deepEqual(vatIncluded(121),{total:121,base:100,vat:21,percent:21});
 assert.deepEqual(vatIncluded(60),{total:60,base:49.59,vat:10.41,percent:21});
 assert.equal(vatIncluded(''),null);
 assert.equal(vatIncluded(-10),null);
 assert.equal(vatIncluded(Number.POSITIVE_INFINITY),null);
});
test('programación: detectar citas separadas por menos de una hora',()=>{
 const conflict=sameOperatorSlot(jobs,{requestId:'x',operatorId:'u1',scheduledAt:'2026-10-25T08:00:00Z'});
 assert.deepEqual(conflict.map(x=>x.id),['c']);
 assert.deepEqual(sameOperatorSlot(jobs,{requestId:'c',operatorId:'u1',scheduledAt:'2026-10-25T08:00:00Z'}),[]);
 assert.deepEqual(sameOperatorSlot(jobs,{requestId:'x',operatorId:'u2',scheduledAt:'2026-10-25T08:00:00Z'}),[]);
});
test('validación de presupuestos y asignación de operarios',()=>{
 assert.equal(validateAdminJobUpdate({status:'quoted',operatorId:null,scheduledAt:null,price:null})!==null,true);
 assert.equal(validateAdminJobUpdate({status:'scheduled',operatorId:null,scheduledAt:null,price:121})!==null,true);
 assert.equal(validateAdminJobUpdate({status:'scheduled',operatorId:'u1',scheduledAt:'2026-10-25T09:30:00',price:121}),null);
 assert.equal(validateAdminJobUpdate({status:'bad',operatorId:'u1',scheduledAt:null,price:0})!==null,true);
});

test('la agenda utiliza un margen preventivo de 60 minutos por operario',()=>{
 assert.equal(staffVisitGapMinutes,60);
 const proposals=[
  {id:'a',operator_id:'u1',status:'scheduled',scheduled_at:'2026-10-25T08:00:00Z'},
  {id:'b',operator_id:'u1',status:'in_progress',scheduled_at:'2026-10-25T11:00:00Z'},
  {id:'c',operator_id:'u2',status:'scheduled',scheduled_at:'2026-10-25T08:15:00Z'},
  {id:'d',operator_id:'u1',status:'cancelled',scheduled_at:'2026-10-25T08:10:00Z'},
  {id:'e',operator_id:'u1',status:'completed',scheduled_at:'2026-10-25T08:20:00Z'}
 ];
 const conflicts=when=>sameOperatorSlot(proposals,{requestId:'new',operatorId:'u1',scheduledAt:when}).map(j=>j.id);
 assert.deepEqual(conflicts('2026-10-25T08:45:00Z'),['a']);
 assert.deepEqual(conflicts('2026-10-25T07:45:00Z'),['a']);
 assert.deepEqual(conflicts('2026-10-25T09:00:00Z'),[]);
 assert.deepEqual(conflicts('2026-10-25T10:15:00Z'),['b']);
 assert.deepEqual(sameOperatorSlot(proposals,{requestId:'a',operatorId:'u1',scheduledAt:'2026-10-25T08:45:00Z'}),[]);
 assert.deepEqual(sameOperatorSlot(proposals,{requestId:'new',operatorId:'u2',scheduledAt:'2026-10-25T08:45:00Z'}).map(j=>j.id),['c']);
 assert.deepEqual(sameOperatorSlot(proposals,{requestId:'new',operatorId:'u1',scheduledAt:'2026-10-25T08:45:00Z',gapMinutes:0}),[]);
 assert.deepEqual(sameOperatorSlot(proposals,{requestId:'new',operatorId:'u1',scheduledAt:'fecha-invalida'}),[]);
});

test('un trabajo en curso requiere operario y fecha, igual que uno programado',()=>{
 const data={status:'in_progress',operatorId:null,scheduledAt:null,price:89};
 assert.match(validateAdminJobUpdate(data),/operario y fecha/);
 assert.match(validateAdminJobUpdate({...data,operatorId:'u1'}),/operario y fecha/);
 assert.equal(validateAdminJobUpdate({...data,operatorId:'u1',scheduledAt:'2026-10-25T10:30:00Z'}),null);
 assert.equal(validateAdminJobUpdate({...data,status:'scheduled',operatorId:'u1',scheduledAt:'2026-10-25T10:30:00Z'}),null);
});
