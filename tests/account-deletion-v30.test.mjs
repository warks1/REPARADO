import test from 'node:test';
import assert from 'node:assert/strict';
import {readOwnDeletionStatus,submitOwnDeletionRequest,ownDeletionLabel} from '../account-deletion.js';
import {readFileSync} from 'node:fs';

function fakeDeletion(){
  const rows=new Map(),ops=[];
  let userId='A',offline=false,dropReply=false,denyWrite=false,denyRead=false;
  const supabase={from(table){
    assert.equal(table,'account_deletion_requests');
    return {
      select(columns){
        ops.push(['select',columns,userId]);
        return {async maybeSingle(){
          if(offline||denyRead)throw new Error('red');
          return {data:rows.get(userId)||null,error:null}
        }};
      },
      async insert(row){
        ops.push(['insert',row.user_id,userId]);
        if(offline)throw new Error('red');
        if(denyWrite||row.user_id!==userId)return {error:{code:'42501'}};
        if(rows.has(userId))return {error:{code:'23505'}};
        rows.set(userId,{id:'deletion-'+userId,status:'requested',requested_at:'2026-10-26T12:00:00Z'});
        if(dropReply)throw new Error('respuesta perdida');
        return {error:null};
      }
    };
  }};
  return {supabase,rows,ops,user:id=>{userId=id},setOffline:x=>{offline=x},
    setDropReply:x=>{dropReply=x},setDenyWrite:x=>{denyWrite=x},setDenyRead:x=>{denyRead=x}};
}
test('sin solicitud devuelve estado vacío confirmado, sin inventar registro',async()=>{
 const db=fakeDeletion();
 assert.deepEqual(await readOwnDeletionStatus(db.supabase),{ok:true,request:null});
 assert.equal(ownDeletionLabel(null),'No hay ninguna solicitud de eliminación registrada.');
});
test('solicitud confirmada por SELECT propio después de INSERT',async()=>{
 const db=fakeDeletion();
 const r=await submitOwnDeletionRequest(db.supabase,'A');
 assert.equal(r.ok,true);assert.equal(r.request.id,'deletion-A');assert.equal(r.alreadyExisted,false);
 assert.equal(db.rows.size,1);
 assert.match(ownDeletionLabel(r.request),/Recibida/);
});
test('respuestas perdidas y error 23505 recuperan la misma solicitud sin duplicados',async()=>{
 const db=fakeDeletion();db.setDropReply(true);
 const first=await submitOwnDeletionRequest(db.supabase,'A');
 assert.equal(first.ok,true);assert.equal(first.alreadyExisted,true);
 const second=await submitOwnDeletionRequest(db.supabase,'A');
 assert.equal(second.ok,true);assert.equal(second.request.id,first.request.id);
 assert.equal(db.rows.size,1);
});
test('no confirma si la inserción falla y no existe fila de cuenta',async()=>{
 const db=fakeDeletion();db.setDenyWrite(true);
 const r=await submitOwnDeletionRequest(db.supabase,'A');
 assert.equal(r.ok,false);assert.equal(r.uncertain,true);
 assert.equal(db.rows.size,0);
});
test('si la red falla después de guardar, no se anuncia un éxito sin lectura',async()=>{
 const db=fakeDeletion();db.setDenyRead(true);
 const r=await submitOwnDeletionRequest(db.supabase,'A');
 assert.equal(r.ok,false);
 assert.equal(db.rows.size,1);
 db.setDenyRead(false);
 const recovered=await readOwnDeletionStatus(db.supabase);
 assert.equal(recovered.ok,true);assert.equal(recovered.request.id,'deletion-A');
});
test('una sesión distinta no puede recuperar solicitudes de otras cuentas',async()=>{
 const db=fakeDeletion();
 await submitOwnDeletionRequest(db.supabase,'A');
 db.user('B');
 assert.deepEqual(await readOwnDeletionStatus(db.supabase),{ok:true,request:null});
 assert.equal((await submitOwnDeletionRequest(db.supabase,'B')).request.id,'deletion-B');
 assert.equal(db.rows.size,2);
});
test('sin identidad no envía petición; la UI verifica sesión y exige consulta previa al reenvío',async()=>{
 const db=fakeDeletion();
 assert.deepEqual(await submitOwnDeletionRequest(db.supabase,null),{ok:false,request:null,uncertain:false});
 assert.equal(db.ops.length,0);
 const src=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.match(src,/const ownDeletionScreen=\(\)=>deletionStatus\.isConnected&&/);
 assert.match(src,/currentView==='profile'&&isCurrentUser\(deletionOwnerId\)/);
 assert.match(src,/deletionButton\.disabled=deletionLoading\|\|deletionSaving\|\|!deletionVerified\|\|deletionExists/);
 assert.match(src,/No se pudo confirmar el registro\. Pulsa Consultar estado antes de volver a solicitarlo/);
 assert.match(src,/id="refresh-account-deletion-status"/);
 assert.ok(!src.includes("if(error && error.code!=='23505')"));
});
