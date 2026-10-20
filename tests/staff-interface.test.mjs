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
 assert.ok(code.includes('sameOperatorSlot(all'));
 assert.ok(code.includes('Fecha y hora no válidas.'));
});
