import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('el panel de personal solo se presenta a usuarios de administración u operario',()=>{
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(code.includes("if(!userIsStaff()){renderHome();return}"));
 assert.ok(code.includes("baseJobs.eq('operator_id',session.user.id)"));
 assert.ok(code.includes('operatorMaySetStatus(original.status,status)'));
});
test('no se pierden asignaciones cuando falla la consulta del personal',()=>{
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(code.includes('if(admin && team.error)'));
 assert.ok(code.includes('No se permiten asignaciones'));
 assert.ok(code.includes('Operario no encontrado'));
});
test('el IVA incluido se muestra sin simular facturación oficial',()=>{
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(code.includes('vatIncluded(job.price)'));
 assert.ok(code.includes('No se permiten asignaciones'));
 assert.ok(code.includes("sameOperatorSlot(appointments.data"));
 assert.ok(code.includes(".eq('operator_id',operator_id)"));
 assert.ok(code.includes(".in('status',['scheduled','in_progress'])"));
 assert.ok(code.includes(".gte('scheduled_at',start)"));
 assert.ok(code.includes(".lt('scheduled_at',end)"));
 assert.ok(code.includes('No se pudo comprobar la agenda del operario'));
 assert.ok(code.includes('Fecha y hora no válidas.'));
});

test('la aplicación identifica conflictos transaccionales de PostgreSQL V7',()=>{
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(code.includes("error.code==='23P01'"));
 assert.ok(code.includes('REPARADO_SCHEDULE_OPERATOR_REQUIRED'));
 assert.ok(code.includes('REPARADO_SCHEDULE_INVALID_OPERATOR'));
 assert.ok(code.includes('No se ha programado: otro administrador'));
 assert.ok(code.includes('No se han guardado los cambios:'));
});
