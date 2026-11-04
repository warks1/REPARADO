import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchOwnNotifications,markOwnNotificationRead,
  notificationsPageSize,notificationsPageCount,notificationsCanAdvance} from '../notifications-data.js';

function fakeDatabase({listError=false,writeError=false,writeId='n1',
 throwRead=false,throwWrite=false,missing=false,missingCount=false,total=1}={}){
  const operations=[];
  const supabase={from(table){
    assert.equal(table,'notifications');
    return {
      select(columns,options){
        operations.push(['select',columns,options]);
        if(throwRead)throw Error('network broken');
        return {
          eq(field,value){operations.push(['eq',field,value]);return this},
          order(field,order){operations.push(['order',field,order]);return this},
          async range(start,end){
            operations.push(['range',start,end]);
            const n=missing?0:Math.max(0,Math.min(end,total-1)-start+1);
            return {data:Array.from({length:n},(_,i)=>({
              id:'n'+(start+i+1),title:'Aviso '+(start+i+1),read:false
            })),count:missingCount?null:total,error:listError?{message:'internal secret'}:null}
          }
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

test('V79: mis avisos filtra por propietario y navega 50 por página',async()=>{
 const f=fakeDatabase();
 const result=await fetchOwnNotifications(f.supabase,'customer-A');
 assert.equal(result.error,false);
 assert.equal(result.rows.length,1);
 assert.equal(result.count,1);
 assert.deepEqual(f.operations,[
  ['select','id,title,body,read,created_at',{count:'exact'}],
  ['eq','user_id','customer-A'],
  ['order','created_at',{ascending:false}],
  ['order','id',{ascending:false}],
  ['range',0,49]
 ]);
 assert.equal(notificationsPageSize,50);
 assert.equal(notificationsPageCount(0),1);
 assert.equal(notificationsPageCount(50),1);
 assert.equal(notificationsPageCount(51),2);
 assert.equal(notificationsPageCount(126),3);
 assert.equal(notificationsCanAdvance(0,126),true);
 assert.equal(notificationsCanAdvance(2,126),false);
});

test('V79: la tercera página recupera avisos 101-126 sin duplicados',async()=>{
 const f=fakeDatabase({total:126});
 const response=await fetchOwnNotifications(f.supabase,'customer-A',2);
 assert.equal(response.error,false);
 assert.equal(response.count,126);
 assert.equal(response.rows.length,26);
 assert.equal(response.rows[0].id,'n101');
 assert.equal(response.rows.at(-1).id,'n126');
 assert.ok(f.operations.some(x=>x[0]==='range'&&x[1]===100&&x[2]===149));
});

test('sin sesión, contador válido o red no muestra avisos engañosos',async()=>{
 const f=fakeDatabase({throwRead:true});
 assert.deepEqual(await fetchOwnNotifications(f.supabase,null),{rows:[],count:null,error:true});
 assert.equal(f.operations.length,0);
 assert.deepEqual(await fetchOwnNotifications(f.supabase,'A'),{rows:[],count:null,error:true});
 for(const opts of [{missingCount:true},{listError:true}]){
   const db=fakeDatabase(opts);
   assert.deepEqual(await fetchOwnNotifications(db.supabase,'A'),{rows:[],count:null,error:true});
 }
 for(const page of [-1,NaN,1.5,100001]){
   assert.deepEqual(await fetchOwnNotifications(fakeDatabase().supabase,'A',page),
     {rows:[],count:null,error:true});
 }
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
 assert.match(ui,/main\\.firstElementChild!==loading/);
 assert.match(ui,/onRefresh\\(\\)/);
 assert.match(ui,/const current=\\(\\)=>card\\.isConnected&&onRefresh\\(\\)/);
 assert.match(ui,/if\\(button\\.disabled\\|\\|!current\\(\\)\\)return/);
 assert.match(ui,/retry\\.dataset\\.view='notifications'/);
 assert.ok(!ui.includes('error.message'));
 assert.ok(ui.includes("aria-label','Páginas de mis avisos'"));
 assert.ok(ui.includes('notificationsCanAdvance(page,count)'));
 assert.ok(ui.includes('page:lastPage'));
 assert.match(controller,/currentView==='notifications'&&isCurrentUser\\(userId\\)/);
 assert.match(controller,/currentView==='invoices'&&isCurrentUser\\(userId\\)/);
 assert.match(controller,/else if\\(view==='invoices'\\)loadInvoices\\(\\)/);
 assert.match(invoices,/main\\.firstElementChild!==loading/);
 assert.match(invoices,/retry\\.dataset\\.view='invoices'/);
 assert.ok(!invoices.includes('error.message'));
});
