import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {customerChatPageSize,customerChatPageCount,
 customerChatCanReadOlder,fetchCustomerChatPage} from '../customer-chat-page.js';

function mock({count=124,offline=false,unknownCount=false}={}){
 const calls=[];
 const q={
  eq(k,v){calls.push(['eq',k,v]);return q},
  order(k,v){calls.push(['order',k,v]);return q},
  range(start,end){
   calls.push(['range',start,end]);
   if(offline)return Promise.resolve({data:null,count:null,error:{code:'offline'}});
   const n=Math.max(0,Math.min(count-1,end)-start+1);
   return Promise.resolve({data:Array.from({length:n},(_,i)=>({id:'msg-'+(count-start-i),body:'Mensaje'})),
     count:unknownCount?null:count,error:null});
  }
 };
 return {calls,supabase:{from(table){
  calls.push(['from',table]);
  return {select(columns,opts){calls.push(['select',columns,opts]);return q}};
 }}};
}

test('V74: límite 50, recuentos y lectura de mensajes antiguos',()=>{
 assert.equal(customerChatPageSize,50);
 assert.equal(customerChatPageCount(0),1);
 assert.equal(customerChatPageCount(50),1);
 assert.equal(customerChatPageCount(51),2);
 assert.equal(customerChatPageCount(124),3);
 assert.equal(customerChatPageCount(null),0);
 assert.equal(customerChatCanReadOlder(0,124),true);
 assert.equal(customerChatCanReadOlder(1,124),true);
 assert.equal(customerChatCanReadOlder(2,124),false);
});

test('V74: consulta la página 3 solo del usuario y devuelve mensajes ordenados para leer',async()=>{
 const {supabase,calls}=mock({count:124});
 const value=await fetchCustomerChatPage(supabase,'cliente-v74',2);
 assert.equal(value.error,false);
 assert.equal(value.count,124);
 assert.equal(value.data.length,24);
 assert.equal(value.data[0].id,'msg-1');
 assert.equal(value.data.at(-1).id,'msg-24');
 assert.deepEqual(calls,[
  ['from','messages'],
  ['select','id,sender_id,body,created_at',{count:'exact'}],
  ['eq','customer_id','cliente-v74'],
  ['order','created_at',{ascending:false}],
  ['order','id',{ascending:false}],
  ['range',100,149]
 ]);
});

test('V74: conexión fallida o recuento ausente no equivalen a sin mensajes',async()=>{
 for(const config of [{offline:true},{unknownCount:true}]){
  const {supabase}=mock(config);
  assert.deepEqual(await fetchCustomerChatPage(supabase,'cliente-v74',0),{data:null,count:null,error:true});
 }
 const {supabase}=mock();
 for(const bad of [-1,1.7,NaN,100001]){
  assert.deepEqual(await fetchCustomerChatPage(supabase,'cliente-v74',bad),{data:null,count:null,error:true});
 }
 assert.deepEqual(await fetchCustomerChatPage(supabase,'',0),{data:null,count:null,error:true});
});

test('V74: controles accesibles y estado de sesión preservado en el chat',()=>{
 const app=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(app.includes('async function loadChat(){'));
 assert.ok(app.includes('fetchCustomerChatPage(supabase,userId,requestedPage)'));
 assert.ok(app.includes('aria-label="Páginas del chat"'));
 assert.ok(app.includes('data-chat-page="older"'));
 assert.ok(app.includes('data-chat-page="newer"'));
 assert.ok(app.includes('data-refresh-chat'));
 assert.ok(app.includes('authEpoch!==epoch'));
 assert.ok(app.includes('customerChatPage=0;'));
 assert.ok(app.includes('await loadChat();'));
 assert.ok(app.includes("from('messages').insert({customer_id:authorId,sender_id:authorId,body})"));
});
