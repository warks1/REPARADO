import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchOwnerConversationsPage} from '../owner-messages.js';

const customer='a0000000-0000-4000-8000-000000000001';
const message='b0000000-0000-4000-8000-000000000002';
function dbWithReadState(state){
 return {
   async rpc(name,args){
     assert.equal(name,'reparado_owner_conversations');
     assert.deepEqual(args,{p_offset:0,p_limit:30});
     return {error:null,data:{total:1,rows:[{
       customer_id:customer,last_message_id:message,
       sender_id:customer,last_message_at:'2026-11-09T10:00:00Z',
       last_body:'Mensaje ficticio para pruebas',
       ...(state===null?{}:{has_unread:state})
     }]}};
   },
   from(table){
     assert.equal(table,'profiles');
     return {select(columns){
       assert.equal(columns,'id,full_name');
       return {async in(key,values){
         assert.deepEqual(values,[customer]);
         return {data:[{id:customer,full_name:'Cliente de pruebas'}],error:null};
       }};
     }};
   }
 };
}

test('V91: muestra pendiente de leer sólo cuando lo confirma el servidor',async()=>{
 for(const unread of [true,false]){
  const result=await fetchOwnerConversationsPage(dbWithReadState(unread),0);
  assert.equal(result.error,false);
  assert.equal(result.data[0].unread,unread);
 }
});

test('V91: en V90 sin migración V91 no se inventan indicadores de lectura',async()=>{
 const result=await fetchOwnerConversationsPage(dbWithReadState(null),0);
 assert.equal(result.error,false);
 assert.equal(result.data[0].unread,null);
});

test('V91: marca sólo tras obtener correctamente la página 0 de un chat admin',()=>{
 const src=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 const chat=src.slice(src.indexOf('async function loadStaffChat('),src.indexOf('async function loadSupportReports('));
 assert.match(chat,/if\(result\.error\)\{/);
 assert.match(chat,/returnView==='owner-messages'&&ownerOnly\(\)&&requestedPage===0/);
 assert.match(chat,/result\.data\[result\.data\.length-1\]/);
 assert.match(chat,/reparado_mark_owner_chat_read/);
 assert.match(chat,/p_customer_id:customerId,p_last_message_id:newest\.id/);
 assert.match(chat,/authEpoch!==chatEpoch/);
});

test('V91: permisos RLS y marcador monotónico en SQL',()=>{
 const sql=readFileSync(new URL('../supabase/migration-v91-owner-read-state.sql',import.meta.url),'utf8');
 assert.match(sql,/owner_conversation_reads enable row level security/);
 assert.match(sql,/security invoker/);
 assert.match(sql,/not coalesce\(\(select public\.is_reparado_admin\(\)\),false\)/);
 assert.match(sql,/revoke all on public\.owner_conversation_reads from public,anon,authenticated/);
 assert.match(sql,/incoming\.id=excluded\.last_read_message_id/);
 assert.match(sql,/incoming\.created_at,incoming\.id\)>\(previous\.created_at,previous\.id\)/);
 assert.match(sql,/grant execute on function public\.reparado_mark_owner_chat_read/);
 assert.match(sql,/incoming\.sender_id=p\.customer_id/);
 assert.match(sql,/as has_unread/);
 assert.doesNotMatch(sql,/insert into public\.messages|update public\.messages/i);
});
