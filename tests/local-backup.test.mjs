import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLocalCollection,restoreLocalCollection} from '../local-backup.js';
const row={id:'abc1',category:'Fontanería',service:'Grifería',street:'Calle A',postal_code:'08001',price:121,date:'2026-11-23',history:[{type:'created',at:'2026-10-20T20:00:00Z'}]};

test('copia general conserva datos sin falsos envíos ni autorizaciones',()=>{
 const data=makeLocalCollection([row],'2026-10-20T22:00:00Z');
 assert.equal(data.sent_to_company,false);
 assert.equal(data.appointment_confirmed,false);
 assert.equal(data.requests.length,1);
 assert.equal(data.requests[0].service,'Grifería');
 const merged=restoreLocalCollection(JSON.stringify(data),[]);
 assert.equal(merged.added,1);
 assert.equal(merged.requests[0].status,'Pendiente (local)');
 assert.deepEqual(merged.requests[0].history,row.history);
});
test('importar no sobrescribe solicitudes existentes y evita repetidos',()=>{
 const pack=makeLocalCollection([row,row]);
 const result=restoreLocalCollection(JSON.stringify(pack),[{id:'abc1',status:'Mis datos locales'}]);
 assert.equal(result.added,0);
 assert.equal(result.duplicates,2);
 assert.equal(result.requests[0].status,'Mis datos locales');
 const another={...row,id:'xyz'};
 const add=restoreLocalCollection(JSON.stringify(makeLocalCollection([another])),[{id:'abc1'}]);
 assert.equal(add.added,1);
 assert.deepEqual(add.requests.map(r=>r.id),['abc1','xyz']);
});
test('admite la copia individual descargada desde una ficha',()=>{
 const single={format:'reparado-local-request',version:1,request:row};
 const result=restoreLocalCollection(JSON.stringify(single),[]);
 assert.equal(result.requests[0].id,'abc1');
});
test('rechaza copias erróneas sin permitir escrituras parciales',()=>{
 const valid=makeLocalCollection([row,{...row,id:'bad',date:'2026-02-31'}]);
 assert.throws(()=>restoreLocalCollection(JSON.stringify(valid),[]),/fecha inválida/);
 assert.throws(()=>restoreLocalCollection('not json',[]),/JSON válido/);
 assert.throws(()=>restoreLocalCollection(JSON.stringify({format:'malicioso',version:1,requests:[row]}),[]),/Formato/);
 assert.throws(()=>restoreLocalCollection(JSON.stringify(makeLocalCollection([{...row,price:-1}])),[]),/precio inválido/);
 assert.throws(()=>restoreLocalCollection(JSON.stringify({format:'reparado-local-collection',version:1,requests:[{...row,history:[{type:'admin',at:'2026-10-20T20:00:00Z'}]}]}),[]),/historial incorrecto/);
});
