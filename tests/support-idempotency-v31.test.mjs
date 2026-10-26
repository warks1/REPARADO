import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {submitSupportIssue,supportIssueFailureMessage} from '../support-submission.js';

const KEY='81ee20bb-f5f8-4ab2-a533-59f363947a31';
const draft={userId:'owner-A',subject:'No puedo abrir el chat',
  description:'El chat se queda bloqueado al responder a soporte.',context:'chat',reportId:KEY};
function testBackend(){
 const rows=new Map(),operations=[];
 let loseResponse=false,offline=false,limit=false;
 const client={from(table){
   assert.equal(table,'support_reports');
   return {
     async insert(payload){
       operations.push({method:'insert',payload});
       if(offline)throw Error('offline');
       if(limit)return {error:{message:'REPARADO_SUPPORT_RATE_LIMIT'}};
       const key=payload.user_id+'/'+payload.client_report_id;
       if(rows.has(key))return {error:{code:'23505',message:'duplicate'}};
       rows.set(key,{id:'report-'+(rows.size+1),...payload});
       if(loseResponse)throw Error('response-lost');
       return {error:null};
     },
     select(columns){
       assert.equal(columns,'id');
       let owner,key;
       return {
         eq(column,val){
           if(column==='user_id')owner=val;
           else if(column==='client_report_id')key=val;
           else assert.fail('Untrusted filter '+column);
           operations.push({method:'filter',column,val});return this;
         },
         async maybeSingle(){
           if(offline)throw Error('offline');
           const found=rows.get(owner+'/'+key);
           return {data:found?{id:found.id}:null,error:null};
         }
       };
     }
   };
 }};
 return {client,rows,operations,setDrop:v=>{loseResponse=v},setOffline:v=>{offline=v},setLimit:v=>{limit=v}};
}
test('incidencia registrada correctamente una sola vez',async()=>{
 const x=testBackend();
 assert.deepEqual(await submitSupportIssue({supabase:x.client,...draft}),{ok:true,recovered:false,code:null});
 assert.equal(x.rows.size,1);
});
test('respuesta perdida: recuperar la incidencia por cliente e identificador',async()=>{
 const x=testBackend();x.setDrop(true);
 const one=await submitSupportIssue({supabase:x.client,...draft});
 assert.deepEqual(one,{ok:true,recovered:true,code:null});
 const again=await submitSupportIssue({supabase:x.client,...draft});
 assert.deepEqual(again,{ok:true,recovered:true,code:null});
 assert.equal(x.rows.size,1);
 assert.ok(x.operations.some(o=>o.method==='filter'&&o.column==='user_id'&&o.val==='owner-A'));
 assert.ok(x.operations.some(o=>o.method==='filter'&&o.column==='client_report_id'&&o.val===KEY));
});
test('caída real: no declara éxito ni crea registro al repetir con la misma clave',async()=>{
 const x=testBackend();x.setOffline(true);
 const fail=await submitSupportIssue({supabase:x.client,...draft});
 assert.equal(fail.ok,false);assert.equal(fail.code,'network');
 x.setOffline(false);
 const good=await submitSupportIssue({supabase:x.client,...draft});
 assert.equal(good.ok,true);assert.equal(x.rows.size,1);
});
test('límite de informes: advertir sin divulgar detalles internos',async()=>{
 const x=testBackend();x.setLimit(true);
 const result=await submitSupportIssue({supabase:x.client,...draft});
 assert.deepEqual(result,{ok:false,recovered:false,code:'limit'});
 assert.match(supportIssueFailureMessage(result.code),/límite temporal/);
});
test('cuentas diferentes no recuperan sus respectivos informes',async()=>{
 const x=testBackend();x.setDrop(true);
 await submitSupportIssue({supabase:x.client,...draft});
 await submitSupportIssue({supabase:x.client,...draft,userId:'owner-B'});
 assert.equal(x.rows.size,2);
});
test('faltan credenciales o UUID: rechazar antes de tocar datos privados',async()=>{
 const x=testBackend();
 assert.equal((await submitSupportIssue({supabase:x.client,...draft,reportId:'invalid'})).code,'invalid');
 assert.equal((await submitSupportIssue({supabase:x.client,...draft,userId:null})).code,'invalid');
 assert.equal(x.operations.length,0);
});
test('interfaz conserva clave entre reintentos e invalida respuestas de otra cuenta',()=>{
 const ui=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.match(ui,/let issueReportId=crypto\.randomUUID\(\),previousIssuePayload=null/);
 assert.match(ui,/if\(previousIssuePayload!==null&&previousIssuePayload!==payloadSnapshot\)/);
 assert.match(ui,/reportId:issueReportId/);
 assert.match(ui,/if\(!feedback\.isConnected\|\|!isCurrentUser\(userId\)\|\|currentView!=='profile'\)return/);
 assert.match(ui,/requestSeq!==historyRequestSeq/);
 assert.match(ui,/historyPanel\.isConnected&&currentView==='profile'&&isCurrentUser\(uid\)/);
});
