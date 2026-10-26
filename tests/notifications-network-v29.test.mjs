import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchOwnNotifications,markOwnNotificationRead} from '../notifications-data.js';

function fakeDatabase({listError=false,writeError=false,writeId='n1',throwRead=false,throwWrite=false,missing=false}={}){
  const operations=[];
  const supabase={from(table){
    assert.equal(table,'notifications');
    return {
      select(columns){
        operations.push(['select',columns]);
        if(throwRead)throw Error('network broken');
        return {
          eq(field,value){operations.push(['eq',field,value]);return this},
          order(field,order){operations.push(['order',field,order]);return this},
          async limit(n){operations.push(['limit',n]);return {data:missing?[]:[{id:'n1',title:'Aviso',read:false}],error:listError?{message:'internal secret'}:null}}
        }
      },
      update(changes){
        operations.push(['update',changes]);if(throwWrite)throw Error('network broken');
        return {
          eq(field,value){operations.push(['eq',field,value]);return this},
          select(columns){
            operations.push(['returning',columns]);
            return {async maybeSingle(){return {data:writeError?null:{id:writeId},error:writeError?{message:'private detail'}:null}}}
          }
        }
      }
    }
  }};
  return {supabase,operations};
}

test('mis avisos filtra solo por el usuario autenticado y limita a 50',async()=>{
 const f=fakeDatabase();
 const result=await fetchOwnNotifications(f.supabase,'customer-A');
 assert.equal(result.error,false);
 assert.equal(result.rows.length,1);
 assert.deepEqual(f.operations,[
  ['select','id,title,body,read,created_at'],
  ['eq','user_id','customer-A'],
  ['order','created_at',{ascending:false}],
  ['limit',50]
 ]);
});
test('sin sesión no consulta al backend; una caída de red devuelve error sin detalles internos',async()=>{
 const f=fakeDatabase({throwRead:true});
 const unauth=await fetchOwnNotifications(f.supabase,null);
 assert.deepEqual(unauth,{rows:[],error:true});
 assert.equal(f.operations.length,0);
 const lost=await fetchOwnNotifications(f.supabase,'A');
 assert.deepEqual(lost,{rows:[],error:true});
});
test('marcar como leído exige la confirmación de la fila y su propietario',async()=>{
 const f=fakeDatabase();
 assert.equal(await markOwnNotificationRead(f.supabase,'customer-A','n1'),true);
 assert.deepEqual(f.operations,[
  ['update',{read:true}],['eq','id','n1'],['eq','user_id','customer-A'],
  ['returning','id']
 ]);
 assert.equal(await markOwnNotificationRead(f.supabase,'customer-A','n2'),false);
 const bad=fakeDatabase({writeError:true});
 assert.equal(await markOwnNotificationRead(bad.supabase,'customer-A','n1'),false);
 const thrown=fakeDatabase({throwWrite:true});
 assert.equal(await markOwnNotificationRead(thrown.supabase,'customer-A','n1'),false);
});
test('sin destinatario ni aviso válido no se escribe en Supabase',async()=>{
 const f=fakeDatabase();
 assert.equal(await markOwnNotificationRead(f.supabase,null,'n1'),false);
 assert.equal(await markOwnNotificationRead(f.supabase,'customer-A',null),false);
 assert.equal(f.operations.length,0);
});
test('avisos y facturas descartan respuestas de otras sesiones o pantallas',()=>{
 const ui=readFileSync(new URL('../notifications.js',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 const invoices=readFileSync(new URL('../invoices.js',import.meta.url),'utf8');
 assert.match(ui,/main\.firstElementChild!==loading/);
 assert.match(ui,/onRefresh\(\)/);
 assert.match(ui,/const current=\(\)=>card\.isConnected&&onRefresh\(\)/);
 assert.match(ui,/if\(button\.disabled\|\|!current\(\)\)return/);
 assert.match(ui,/retry\.dataset\.view='notifications'/);
 assert.ok(!ui.includes('error.message'));
 assert.match(controller,/currentView==='notifications'&&isCurrentUser\(userId\)/);
 assert.match(controller,/currentView==='invoices'&&isCurrentUser\(userId\)/);
 assert.match(controller,/else if\(view==='invoices'\)loadInvoices\(\)/);
 assert.match(invoices,/main\.firstElementChild!==loading/);
 assert.match(invoices,/retry\.dataset\.view='invoices'/);
 assert.ok(!invoices.includes('error.message'));
});
