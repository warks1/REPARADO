import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moderationPageSize,moderationPageCount,
 moderationCanAdvance,fetchPendingModerationPage} from '../review-moderation-page.js';

function mock({total=126,fail=false,missingCount=false}={}){
  const calls=[];
  const chain={
    eq(field,value){calls.push(['eq',field,value]);return chain},
    order(field,options){calls.push(['order',field,options]);return chain},
    async range(start,end){
      calls.push(['range',start,end]);
      if(fail)return {data:null,count:null,error:{message:'offline'}};
      const length=Math.max(0,Math.min(total-1,end)-start+1);
      return {data:Array.from({length},(_,i)=>({
         id:'r'+(start+i),rating:4,status:'pending',comment:'Trabajo real verificado',
         created_at:'2026-10-31T12:00:00Z'
      })),count:missingCount?null:total,error:null};
    }
  };
  return {calls,client:{from(table){calls.push(['from',table]);return {
    select(fields,options){calls.push(['select',fields,options]);return chain}
  }}}};
}

test('V81: 126 reseñas pendientes generan tres páginas',()=>{
  assert.equal(moderationPageSize,50);
  assert.equal(moderationPageCount(0),1);
  assert.equal(moderationPageCount(50),1);
  assert.equal(moderationPageCount(51),2);
  assert.equal(moderationPageCount(126),3);
  assert.equal(moderationPageCount(null),0);
  assert.equal(moderationCanAdvance(0,126),true);
  assert.equal(moderationCanAdvance(1,126),true);
  assert.equal(moderationCanAdvance(2,126),false);
  assert.equal(moderationCanAdvance(-1,126),false);
});

test('V81: página 3 se consulta con estado pendiente, orden estable y recuento real',async()=>{
  const {client,calls}=mock();
  const found=await fetchPendingModerationPage(client,2);
  assert.equal(found.error,false);
  assert.equal(found.count,126);
  assert.equal(found.data.length,26);
  assert.equal(found.data[0].id,'r100');
  assert.equal(found.data.at(-1).id,'r125');
  assert.deepEqual(calls,[
    ['from','customer_reviews'],
    ['select','id,rating,comment,status,created_at',{count:'exact'}],
    ['eq','status','pending'],
    ['order','created_at',{ascending:true}],
    ['order','id',{ascending:true}],
    ['range',100,149]
  ]);
});

test('V81: errores, recuento ausente y páginas inválidas no simulan bandeja vacía',async()=>{
  for(const options of [{fail:true},{missingCount:true}]){
    const {client}=mock(options);
    assert.deepEqual(await fetchPendingModerationPage(client,0),
      {data:null,count:null,error:true});
  }
  for(const page of [-1,1.3,NaN,100001]){
    assert.deepEqual(await fetchPendingModerationPage(mock().client,page),
      {data:null,count:null,error:true});
  }
  assert.deepEqual(await fetchPendingModerationPage(null,0),
    {data:null,count:null,error:true});
});

test('V81: administración navega y actualiza los pendientes sin 100 registros de límite',()=>{
  const ui=readFileSync(new URL('../review-moderation.js',import.meta.url),'utf8');
  assert.ok(ui.includes('fetchPendingModerationPage(supabase,page)'));
  assert.ok(ui.includes('data-moderation-page="prev"'));
  assert.ok(ui.includes('data-moderation-page="next"'));
  assert.ok(ui.includes('moderationCanAdvance(page,total)'));
  assert.ok(ui.includes('page>=moderationPageCount(count)'));
  assert.ok(ui.includes("await refresh(status==='approved'?"));
  assert.ok(ui.includes(".update({status})"));
  assert.ok(ui.includes(".eq('id',id).eq('status','pending')"));
  assert.ok(ui.includes("if(!data||data.length!==1)"));
  assert.ok(!ui.includes(".limit(100)"));
});
