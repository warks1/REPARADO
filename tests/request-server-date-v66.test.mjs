import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {submitRepairRequest} from '../request-submission.js';

const key='57730960-c227-4bdb-bdbc-72fa034c74e5';
const request={customer_id:'client-1',city:'Girona',postal_code:'17001'};

function fakeDb(insertError,{recoveredId=null,recoveryFails=false}={}){
  const calls=[];
  return {calls,from(table){
    assert.equal(table,'service_requests');
    return {
      insert(row){
        calls.push(['insert',row]);
        return {select(columns){
          assert.equal(columns,'id');
          return {single:async()=>({data:null,error:insertError})};
        }};
      },
      select(columns){
        assert.equal(columns,'id');
        return {
          eq(field,value){calls.push(['filter',field,value]);return this;},
          async maybeSingle(){return recoveryFails
            ?{data:null,error:{message:'No connection'}}
            :{data:recoveredId?{id:recoveredId}:null,error:null};}
        };
      }
    };
  }};
}

test('V66: fecha caducada según PostgreSQL permite corregir y reintentar',async()=>{
  const db=fakeDb({code:'23514',message:'REPARADO_V66_PREFERRED_DATE_PAST'});
  const result=await submitRepairRequest({supabase:db,payload:request,submissionId:key});
  assert.deepEqual(result,{
    id:null,recovered:false,rejected:true,
    error:'La fecha preferida ya ha pasado en Cataluña. Selecciona hoy u otra fecha futura.'
  });
  assert.equal(db.calls.filter(x=>x[0]==='insert').length,1);
  assert.deepEqual(db.calls.filter(x=>x[0]==='filter'),[
    ['filter','customer_id','client-1'],['filter','client_submission_id',key]
  ]);
});

test('V66: constraint de área V65 muestra error comprensible sin filtrar datos',async()=>{
  const db=fakeDb({code:'23514',message:'violates check constraint "reparado_catalonia_area_v65"'});
  const result=await submitRepairRequest({supabase:db,payload:request,submissionId:key});
  assert.equal(result.rejected,true);
  assert.match(result.error,/Cataluña/);
  assert.ok(!result.error.includes('constraint'));
});

test('V66: pérdida de red no autoriza modificar el intento de envío',async()=>{
  const db=fakeDb({message:'Network unavailable'},{recoveryFails:true});
  const result=await submitRepairRequest({supabase:db,payload:request,submissionId:key});
  assert.equal(result.rejected,undefined);
  assert.match(result.error,/Comprueba Mis solicitudes antes de reintentar/);
});

test('V66: recuperación de una solicitud prevalece sobre el mensaje de rechazo',async()=>{
  const db=fakeDb({code:'23514',message:'REPARADO_V66_PREFERRED_DATE_PAST'},{recoveredId:'existing'});
  const result=await submitRepairRequest({supabase:db,payload:request,submissionId:key});
  assert.deepEqual(result,{id:'existing',recovered:true,error:null});
});

test('V66: el formulario permite correcciones solo después de rechazo inequívoco',()=>{
  const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.match(code,/if\(created\.rejected\)firstAttemptPayload=null/);
  const sql=readFileSync(new URL('../supabase/migration-v66-preferred-date.sql',import.meta.url),'utf8');
  assert.match(sql,/before insert on public\.service_requests/i);
  assert.doesNotMatch(sql,/before update on public\.service_requests/i);
  assert.match(sql,/statement_timestamp\(\) at time zone 'Europe\/Madrid'/i);
  assert.match(sql,/REPARADO_V66_REQUIRES_V65_AND_RLS/);
  assert.match(sql,/REPARADO_V66_PREFERRED_DATE_PAST/);
  assert.match(sql,/revoke all on function public\.reparado_guard_preferred_date_v66\(\)/);
});
