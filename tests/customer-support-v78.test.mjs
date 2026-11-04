import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {supportHistoryPageSize,supportHistoryPageCount,
 supportHistoryCanAdvance,fetchSupportHistoryPage} from '../customer-support-page.js';

function backend({total=37,networkError=false,missingCount=false}={}){
  const calls=[];
  const chain={
    order(column,options){calls.push(['order',column,options]);return chain;},
    range(start,end){
      calls.push(['range',start,end]);
      if(networkError)return Promise.resolve({data:null,count:null,error:{message:'offline'}});
      const n=Math.max(0,Math.min(end,total-1)-start+1);
      return Promise.resolve({
        data:Array.from({length:n},(_,i)=>({id:'incidencia-'+(start+i),subject:'Caso '+(start+i)})),
        count:missingCount?null:total,error:null
      });
    }
  };
  const client={from(table){calls.push(['from',table]);return {
    select(fields,options){calls.push(['select',fields,options]);return chain;}
  }}};
  return {client,calls};
}

test('V78: las incidencias posteriores a las primeras quince siguen disponibles',()=>{
  assert.equal(supportHistoryPageSize,15);
  assert.equal(supportHistoryPageCount(0),1);
  assert.equal(supportHistoryPageCount(15),1);
  assert.equal(supportHistoryPageCount(16),2);
  assert.equal(supportHistoryPageCount(37),3);
  assert.equal(supportHistoryPageCount(null),0);
  assert.equal(supportHistoryCanAdvance(0,37),true);
  assert.equal(supportHistoryCanAdvance(2,37),false);
  assert.equal(supportHistoryCanAdvance(-1,37),false);
});

test('V78: tercera página trae casos 31-37, orden estable y contador RLS',async()=>{
  const {client,calls}=backend();
  const result=await fetchSupportHistoryPage(client,'cliente-a',2);
  assert.equal(result.error,false);
  assert.equal(result.count,37);
  assert.equal(result.data.length,7);
  assert.equal(result.data[0].id,'incidencia-30');
  assert.equal(result.data.at(-1).id,'incidencia-36');
  assert.deepEqual(calls,[
    ['from','support_reports'],
    ['select','id,subject,status,created_at',{count:'exact'}],
    ['order','created_at',{ascending:false}],
    ['order','id',{ascending:false}],
    ['range',30,44]
  ]);
  assert.ok(!JSON.stringify(calls).includes('user_id'));
});

test('V78: caída de red, contador desconocido o sesión inválida no fingen historial vacío',async()=>{
  for(const options of [{networkError:true},{missingCount:true}]){
    const {client}=backend(options);
    assert.deepEqual(await fetchSupportHistoryPage(client,'cliente-a',0),
      {data:null,count:null,error:true});
  }
  const {client}=backend();
  for(const page of [-1,NaN,1.2,100001]){
    assert.deepEqual(await fetchSupportHistoryPage(client,'cliente-a',page),
      {data:null,count:null,error:true});
  }
  assert.deepEqual(await fetchSupportHistoryPage(client,'',0),
    {data:null,count:null,error:true});
});

test('V78: navegación, perfiles, reintentos y sesiones antiguas siguen protegidos',()=>{
  const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.ok(connected.includes("fetchSupportHistoryPage(supabase,uid,supportHistoryPage)"));
  assert.ok(connected.includes("historyPager.setAttribute('aria-label','Páginas de mis incidencias')"));
  assert.ok(connected.includes("supportHistoryCanAdvance(supportHistoryPage,count)"));
  assert.ok(connected.includes("requestSeq!==historyRequestSeq"));
  assert.ok(connected.includes("historyPanel.isConnected&&currentView==='profile'&&isCurrentUser(uid)"));
  assert.ok(connected.includes('supportHistoryPage=0;\n          void refreshSupportHistory();'));
  assert.ok(!connected.includes(".order('created_at',{ascending:false}).limit(15)"));
});
