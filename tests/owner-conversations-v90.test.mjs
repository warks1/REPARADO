import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchOwnerConversationsPage,fetchOwnerInboxPage,ownerMessagesPageSize,
  ownerMessagePageCount} from '../owner-messages.js';

const a='a0000000-0000-4000-8000-000000000001';
const b='b0000000-0000-4000-8000-000000000002';
const id='c0000000-0000-4000-8000-000000000003';
const entry=(customerId=a,body='Necesito presupuesto')=>({
  customer_id:customerId,last_message_id:id,
  sender_id:customerId,last_message_at:'2026-11-09T10:00:00Z',
  last_body:body
});
function mock({rows=[entry()],total=1,rpcError=null,profileError=null}={}){
  const calls=[];
  const db={
    async rpc(name,args){
      calls.push(['rpc',name,args]);
      return {data:rpcError?null:{total,rows},error:rpcError};
    },
    from(table){
      calls.push(['from',table]);
      return {select(fields){
        calls.push(['select',fields]);
        return {async in(key,values){
          calls.push(['in',key,values]);
          return {data:rows.map(r=>({id:r.customer_id,full_name:'Cliente ficticio'})),
            error:profileError};
        }};
      }};
    }
  };
  return {db,calls};
}

test('V90: una fila por conversación, recuento de clientes y paginación estable',async()=>{
 const {db,calls}=mock({rows:[entry(a),entry(b)],total:91});
 const result=await fetchOwnerConversationsPage(db,1);
 assert.equal(result.error,false);
 assert.equal(result.mode,'conversations');
 assert.equal(result.count,91);
 assert.equal(result.data.length,2);
 assert.equal(result.data[0].customer_id,a);
 assert.equal(result.data[0].body,'Necesito presupuesto');
 assert.equal(result.names[a],'Cliente ficticio');
 assert.equal(result.names[b],'Cliente ficticio');
 assert.equal(ownerMessagePageCount(result.count),4);
 assert.deepEqual(calls[0],['rpc','reparado_owner_conversations',{
   p_offset:ownerMessagesPageSize,p_limit:ownerMessagesPageSize
 }]);
 assert.ok(!calls.some(x=>JSON.stringify(x).includes('auth.users')));
});

test('V90: no devuelve datos cuando falla seguridad, red o validación',async()=>{
 for(const opts of [
   {rpcError:{code:'42501',message:'No autorizado'}},
   {rpcError:{code:'08006',message:'Conexión perdida'}},
   {rows:[{customer_id:'invalido'}]},
   {rows:[entry()],total:-1},
   {rows:[entry()],total:'1'},
   {rows:[entry()],profileError:{code:'42501'}}
 ]){
   const result=await fetchOwnerConversationsPage(mock(opts).db,0);
   assert.equal(result.error,true);
   assert.equal(result.unavailable,false);
 }
 assert.equal((await fetchOwnerConversationsPage(null,0)).error,true);
 assert.equal((await fetchOwnerConversationsPage(mock().db,-1)).error,true);
 assert.equal((await fetchOwnerConversationsPage(mock().db,100001)).error,true);
});

test('V90: solo permite vista anterior si no está desplegada la función RPC',async()=>{
 const errors=['PGRST202','42883'];
 for(const code of errors){
   const db=mock({rpcError:{code}}).db;
   const legacy={from(table){
     if(table==='messages')return {
       select:()=>({order:()=>({order:()=>({range:async()=>({
         data:[],count:0,error:null
       })})})})};
     throw Error('No se esperan perfiles vacíos');
   },rpc:db.rpc};
   const result=await fetchOwnerInboxPage(legacy,0);
   assert.equal(result.error,false);
   assert.equal(result.mode,'messages');
 }
 const unauthorized=mock({rpcError:{code:'42501'}}).db;
 const result=await fetchOwnerInboxPage(unauthorized,0);
 assert.equal(result.error,true);
 assert.equal(result.mode,undefined,'no se revelan mensajes por fallback');
});

test('V90: contratos SQL de mínima autorización y sin crear datos de ejemplo',()=>{
 const sql=readFileSync(new URL('../supabase/migration-v90-owner-inbox.sql',import.meta.url),'utf8');
 const js=readFileSync(new URL('../owner-messages.js',import.meta.url),'utf8');
 assert.match(sql,/security invoker/i);
 assert.match(sql,/not coalesce\(\(select public\.is_reparado_admin\(\)\),false\)/);
 assert.match(sql,/from public\.messages m/);
 assert.match(sql,/distinct on \(m\.customer_id\)/);
 assert.match(sql,/revoke all on function public\.reparado_owner_conversations/);
 assert.match(sql,/grant execute on function public\.reparado_owner_conversations/);
 assert.doesNotMatch(sql,/insert into public\.messages|update public\.messages/i);
 assert.ok(js.includes('if(!grouped.unavailable)return {error:true}'));
 assert.ok(js.includes("La lectura de Outlook y el estado no leído aún no están integrados."));
});
