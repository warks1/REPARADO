import test from 'node:test';
import assert from 'node:assert/strict';
import {jobStatuses,filterJobs,jobCounters,vatIncluded,sameOperatorSlot,validateAdminJobUpdate} from '../staff-workflows.js';
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
test('programación: mostrar avisos por mismo operario y minuto',()=>{
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
