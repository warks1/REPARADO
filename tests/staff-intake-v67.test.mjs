import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterJobs,jobCounters,jobFilters} from '../staff-workflows.js';

const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
const theme=readFileSync(new URL('../vivid-theme.css',import.meta.url),'utf8');

test('V67: trabajos nuevos se separan de pendientes de presupuesto y agenda',()=>{
 const jobs=[
  {id:'n1',status:'new',operator_id:null},
  {id:'q1',status:'quoted',operator_id:null},
  {id:'a1',status:'accepted',operator_id:'u1'},
  {id:'s1',status:'scheduled',operator_id:'u1'},
  {id:'f1',status:'completed',operator_id:'u1'}
 ];
 assert.deepEqual(filterJobs(jobs,'new').map(x=>x.id),['n1']);
 assert.deepEqual(filterJobs(jobs,'pending').map(x=>x.id),['n1','q1','a1']);
 assert.equal(jobCounters(jobs).new,1);
 assert.equal(jobCounters(jobs).pending,3);
 assert.deepEqual(jobFilters.filter(f=>f.id==='new').map(f=>f.label),['Nuevas']);
});

test('V67: administración ofrece botón para revisar y recargar solicitudes del servidor',()=>{
 const start=code.indexOf('async function renderAdmin('),end=code.indexOf('async function',start+10);
 assert.ok(start>=0);
 const section=code.slice(start,end>start?end:undefined);
 assert.match(section,/staff-new-queue/);
 assert.ok(section.includes('data-admin-filter="new"'));
 assert.match(section,/data-reload-staff/);
 assert.match(section,/renderAdmin\(adminFilter\)/);
 assert.match(section,/Historial completo por páginas de 50/);
 assert.match(section,/Recuento de todas las solicitudes nuevas del servidor/);
 assert.match(section,/los avisos por correo dependen de una configuración externa/);
});

test('V67: la bandeja está limitada a administrador, sin mostrar datos a clientes u operarios',()=>{
 assert.ok(code.includes("if(!userIsStaff()){renderHome();return}"));
 assert.ok(code.includes('fetchStaffWorkCounts(supabase,{operatorId:admin?null:staffUserId})'));
 assert.ok(code.includes('if(!userIsStaff()){renderHome();return}'));
 assert.ok(code.includes('${admin?`<div class="staff-new-queue"'));
 assert.ok(theme.includes('.staff-new-queue{'));
 assert.ok(theme.includes('.staff-queue-actions button:focus-visible'));
 assert.ok(theme.includes('@media(max-width:540px)'));
});
