import test from 'node:test';
import assert from 'node:assert/strict';
import {submitRepairRequest} from '../request-submission.js';

const KEY='57730960-c227-4bdb-bdbc-72fa034c74e5';
const payload={customer_id:'cliente-A',service_name:'Fuga de agua',street:'Calle de prueba'};
function fakeDb(){
  const rows=new Map(),calls={insert:0,read:0};
  let dropResponse=false,offline=false,failOnce=false;
  const supabase={from:name=>{
    assert.equal(name,'service_requests');
    return {
      insert:record=>({
        select:column=>{
          assert.equal(column,'id');
          return {single:async()=>{
            calls.insert++;
            if(offline||failOnce){
              failOnce=false;return {data:null,error:{message:'Red caída'}};
            }
            const key=record.customer_id+'/'+record.client_submission_id;
            if(!rows.has(key))rows.set(key,{id:'request-'+(rows.size+1),...record});
            const data=rows.get(key);
            return dropResponse?{data:null,error:{message:'Respuesta perdida'}}:{data:{id:data.id},error:null};
          }};
        }
      }),
      select:column=>{
        assert.equal(column,'id');
        let user,key;
        return {eq(field,value){
          if(field==='customer_id')user=value;
          if(field==='client_submission_id')key=value;
          return this;
        },async maybeSingle(){
          calls.read++;
          if(offline)return {data:null,error:{message:'Red caída'}};
          const found=rows.get(user+'/'+key);
          return {data:found?{id:found.id}:null,error:null};
        }};
      }
    };
  }};
  return {supabase,rows,calls,setDropResponse:x=>{dropResponse=x},setOffline:x=>{offline=x},failNext:()=>{failOnce=true}};
}
test('nueva solicitud se envía exactamente una vez',async()=>{
  const db=fakeDb();
  const r=await submitRepairRequest({supabase:db.supabase,payload,submissionId:KEY});
  assert.deepEqual(r,{id:'request-1',recovered:false,error:null});
  assert.equal(db.rows.size,1);assert.equal(db.calls.read,0);
});
test('servidor guarda pero se pierde la respuesta: se recupera la MISMA solicitud',async()=>{
  const db=fakeDb();db.setDropResponse(true);
  const first=await submitRepairRequest({supabase:db.supabase,payload,submissionId:KEY});
  assert.deepEqual(first,{id:'request-1',recovered:true,error:null});
  const second=await submitRepairRequest({supabase:db.supabase,payload,submissionId:KEY});
  assert.equal(second.id,first.id);
  assert.equal(db.rows.size,1);
});
test('la red cae antes de guardar: el reintento mantiene la clave sin crear duplicados',async()=>{
  const db=fakeDb();db.failNext();db.setOffline(true);
  const failure=await submitRepairRequest({supabase:db.supabase,payload,submissionId:KEY});
  assert.equal(failure.id,null);assert.match(failure.error,/No se pudo confirmar/);
  db.setOffline(false);
  const result=await submitRepairRequest({supabase:db.supabase,payload,submissionId:KEY});
  assert.equal(result.id,'request-1');assert.equal(db.rows.size,1);
});
test('clave inválida o falta de usuario: se bloquea ANTES de enviar datos',async()=>{
  const db=fakeDb();
  for(const args of [{payload,submissionId:'<script>'},{payload:{},submissionId:KEY}]){
    const result=await submitRepairRequest({supabase:db.supabase,...args});
    assert.equal(result.id,null);assert.match(result.error,/preparar/);
  }
  assert.equal(db.calls.insert,0);assert.equal(db.calls.read,0);
});
test('la búsqueda de recuperación queda limitada a cliente y clave propios',async()=>{
  const db=fakeDb();db.setDropResponse(true);
  const first=await submitRepairRequest({supabase:db.supabase,payload,submissionId:KEY});
  const another=await submitRepairRequest({supabase:db.supabase,payload:{...payload,customer_id:'cliente-B'},submissionId:KEY});
  assert.notEqual(first.id,another.id);assert.equal(db.rows.size,2);
});
