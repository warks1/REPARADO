import test from 'node:test';
import assert from 'node:assert/strict';
import {localReceipt,localRequestBackup,localBackupName,historicalEvents,readableTimestamp} from '../local-document.js';

test('el resguardo muestra que no es una factura ni una reserva',()=>{
 const html=localReceipt({id:'id-1',service:'Reparación de fuga',street:'Barcelona & <script>alert(1)</script>',price:121,date:'2026-12-01',period:'Mañana',created_at:'2026-10-20T20:00:00Z'});
 assert.ok(html.includes('NO es una factura ni una cita confirmada'));
 assert.ok(html.includes('NO ha sido enviada al equipo'));
 assert.ok(html.includes('121,00'));
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(!html.includes('<script>'));
});
test('la copia es explícitamente local y solo incluye datos permitidos',()=>{
 const input={id:'ab/123',service:'Parquet',phone:'600000000',street:'Calle',history:[{type:'created',at:'2026-10-20T20:00:00Z'}],secret_token:'no copiar'};
 const data=localRequestBackup(input,'2026-10-20T21:00:00Z');
 assert.equal(data.format,'reparado-local-request');
 assert.equal(data.sent_to_company,false);
 assert.equal(data.appointment_confirmed,false);
 assert.equal(data.request.phone,'600000000');
 assert.equal(data.request.secret_token,undefined);
 assert.deepEqual(data.request.history,[{type:'created',at:'2026-10-20T20:00:00Z'}]);
 assert.equal(localBackupName(input),'reparado-solicitud-ab123.json');
});
test('el historial conserva fechas reales y omite registros corruptos',()=>{
 assert.deepEqual(historicalEvents({history:[{type:'created',at:'2026-10-20T20:00:00Z'},{type:'unknown',at:'2026-10-20T20:01:00Z'}]}).map(x=>x.label),['Solicitud guardada en el dispositivo']);
 assert.equal(historicalEvents({history:null}).length,0);
 assert.equal(readableTimestamp(''),'Sin fecha registrada');
});
