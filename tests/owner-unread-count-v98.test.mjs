import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchOwnerUnreadConversationCount} from '../owner-unread-count.js';
import {ownerDashboardMarkup,ownerSections,ownerMetrics} from '../owner-dashboard.js';

test('V98: consulta exclusivamente el RPC de recuento autenticado',async()=>{
 let called=0;
 const supabase={async rpc(name){
   called++;
   assert.equal(name,'reparado_owner_unread_conversations');
   return {data:7,error:null};
 }};
 const result=await fetchOwnerUnreadConversationCount(supabase);
 assert.deepEqual(result,{count:7,error:false});
 assert.equal(called,1);
});

test('V98: cero confirmado es correcto pero no se inventa un cero si hay error',async()=>{
 assert.deepEqual(await fetchOwnerUnreadConversationCount({
   rpc:async()=>({data:0,error:null})
 }),{count:0,error:false});
 for(const args of [null,undefined,-1,1.2,'3',Number.MAX_SAFE_INTEGER+1]){
  const value=await fetchOwnerUnreadConversationCount({
   rpc:async()=>({data:args,error:null})
  });
  assert.deepEqual(value,{count:null,error:true});
 }
 assert.deepEqual(await fetchOwnerUnreadConversationCount({
   rpc:async()=>({data:null,error:{code:'42501'}})
 }),{count:null,error:true});
 assert.deepEqual(await fetchOwnerUnreadConversationCount({
   rpc:async()=>{throw Error('sin red')}
 }),{count:null,error:true});
 assert.deepEqual(await fetchOwnerUnreadConversationCount(null),
   {count:null,error:true});
});

test('V98: insignia de mensajes solo con total positivo confirmado',()=>{
 const counts=Object.fromEntries(ownerMetrics.map(m=>[m.id,2]));
 const extra={acceptedUnassigned:2,pastVisits:1};
 const positive=ownerDashboardMarkup(counts,extra,6);
 assert.ok(positive.includes('6 sin leer'));
 assert.ok(positive.includes('aria-label="6 conversaciones sin leer"'));
 assert.equal((positive.match(/owner-inbox-pending/g)||[]).length,1);
 const noUnread=ownerDashboardMarkup(counts,extra,0);
 assert.ok(!noUnread.includes('owner-inbox-pending'));
 assert.ok(!noUnread.includes('sin leer'));
 const unknown=ownerDashboardMarkup(counts,extra,null);
 assert.ok(!unknown.includes('owner-inbox-pending'));
 assert.equal(ownerSections.length,13);
});

test('V98: estado de lectura y panel permanecen protegidos por admin y RLS',()=>{
 const sql=readFileSync(new URL('../supabase/migration-v98-owner-unread-count.sql',import.meta.url),'utf8');
 assert.match(sql,/security invoker/);
 assert.match(sql,/not coalesce\(\(select public\.is_reparado_admin\(\)\),false\)/);
 assert.match(sql,/readmark\.admin_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/m\.sender_id=m\.customer_id/);
 assert.match(sql,/revoke all on function public\.reparado_owner_unread_conversations/);
 assert.match(sql,/from public,anon,authenticated/);
 assert.doesNotMatch(sql,/insert into public\.messages|update public\.messages/i);
 const js=readFileSync(new URL('../owner-dashboard.js',import.meta.url),'utf8');
 assert.ok(js.includes('fetchOwnerUnreadConversationCount(supabase)'));
 assert.ok(js.includes('unread.error?null:unread.count'));
 assert.ok(js.includes("root.querySelector('.owner-modules').replaceWith("));
 assert.ok(js.includes("id!==refreshId"));
 const app=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(app.includes("const ownerOnly=()=>Boolean(session?.user?.id&&profile?.role==='admin')"));
 assert.ok(app.includes("if(!ownerOnly()){if(!session)showLogin();else renderHome();return}"));
});
