import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {supportHistoryMarkup,supportStatusLabel} from '../support-ticket-ui.js';

test('estados de incidencias son claros y traducidos al castellano',()=>{
 assert.equal(supportStatusLabel('open'),'Recibida');
 assert.equal(supportStatusLabel('reviewing'),'En revisión');
 assert.equal(supportStatusLabel('resolved'),'Resuelta');
 assert.equal(supportStatusLabel('unexpected'),'Estado no disponible');
});
test('sin incidencias no inventa casos ni mensajes enviados',()=>{
 assert.ok(supportHistoryMarkup([]).includes('Todavía no has comunicado ninguna incidencia'));
 assert.ok(!supportHistoryMarkup([]).includes('support-history-card'));
});
test('historial muestra asunto y estado sin inyectar HTML ni revelar descripción',()=>{
 const data=[{id:'id',subject:'<img src=x onerror=alert(1)>',status:'reviewing',
    description:'Contraseña y datos personales que nunca deberían salir en el resumen',
    created_at:'2026-10-26T08:00:00Z'}];
 const html=supportHistoryMarkup(data);
 assert.ok(html.includes('&lt;img'));
 assert.ok(!html.includes('<img'));
 assert.ok(html.includes('En revisión'));
 assert.ok(!html.includes('Contraseña y datos personales'));
});
test('hay límite de historial visible y fechas malformadas no rompen la interfaz',()=>{
 const data=Array.from({length:21},(_,i)=>({subject:'Fallo '+i,status:'open',created_at:'invalid'}));
 const html=supportHistoryMarkup(data);
 assert.equal((html.match(/data-support-history/g)||[]).length,15);
 assert.ok(html.includes('Fecha no disponible'));
 assert.ok(!html.includes('Fallo 20'));
});
test('consultas del historial ocurren solo autenticadas y sin leer user_id ajeno',()=>{
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(code.includes("id=\"customer-support-history\""));
 assert.ok(code.includes("!userIsStaff()?"));
 assert.ok(code.includes(".select('id,subject,status,created_at')"));
 assert.ok(code.includes("isCurrentUser(uid)"));
 assert.ok(code.includes("data-refresh-support"));
 assert.ok(code.includes('refreshSupportHistory();'));
 assert.ok(!code.includes(".select('id,subject,status,created_at,user_id')"));
});
