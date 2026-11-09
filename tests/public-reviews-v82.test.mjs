import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchApprovedReviewsPage,publicReviewsPageSize,
 publicReviewsHasMore} from '../public-reviews-page.js';
import {verifiedReviewSummary} from '../reviews.js';

function mock({total=53,error=false,missingCount=false}={}){
  const calls=[];
  const chain={
    eq(field,value){calls.push(['eq',field,value]);return chain;},
    order(field,options){calls.push(['order',field,options]);return chain;},
    async range(start,end){
      calls.push(['range',start,end]);
      if(error)return {data:null,count:null,error:{message:'offline'}};
      const n=Math.max(0,Math.min(total-1,end)-start+1);
      return {data:Array.from({length:n},(_,i)=>({
        id:'review-'+(i+start),status:'approved',rating:3,
        comment:'Una reseña aprobada auténtica, número '+(i+start),
        created_at:'2026-11-01T12:00:00Z'
      })),count:missingCount?null:total,error:null};
    }
  };
  return {calls,client:{from(table){
    calls.push(['from',table]);return {
      select(fields,options){calls.push(['select',fields,options]);return chain;}
    };
  }}};
}

test('V82: muestra la posibilidad de consultar todas las 53 reseñas por páginas',()=>{
  assert.equal(publicReviewsPageSize,20);
  assert.equal(publicReviewsHasMore(0,53),true);
  assert.equal(publicReviewsHasMore(20,53),true);
  assert.equal(publicReviewsHasMore(40,53),true);
  assert.equal(publicReviewsHasMore(53,53),false);
  assert.equal(publicReviewsHasMore(54,53),false);
  assert.equal(publicReviewsHasMore(0,null),false);
});

test('V82: las páginas públicas solo leen aprobadas, sin datos de cliente ni escritura',async()=>{
  const {calls,client}=mock();
  const result=await fetchApprovedReviewsPage(client,40);
  assert.equal(result.error,false);
  assert.equal(result.count,53);
  assert.equal(result.data.length,13);
  assert.equal(result.data[0].id,'review-40');
  assert.deepEqual(calls,[
    ['from','customer_reviews'],
    ['select','id,rating,comment,created_at,status',{count:'exact'}],
    ['eq','status','approved'],
    ['order','created_at',{ascending:false}],
    ['order','id',{ascending:false}],
    ['range',40,59]
  ]);
});

test('V82: error de red, falta de recuento o página inválida no aparenta 0 reseñas',async()=>{
  for(const options of [{error:true},{missingCount:true}]){
    assert.deepEqual(await fetchApprovedReviewsPage(mock(options).client,0),
      {data:null,count:null,error:true});
  }
  for(const offset of [-1,1.3,NaN,1000001]){
    assert.deepEqual(await fetchApprovedReviewsPage(mock().client,offset),
      {data:null,count:null,error:true});
  }
  assert.deepEqual(await fetchApprovedReviewsPage(null,0),
    {data:null,count:null,error:true});
});

test('V82: la media del subconjunto no debe presentarse como media global',()=>{
  const snippet=[
    {id:'a',status:'approved',rating:5,comment:'Reparación muy bien terminada',created_at:'2026-11-02T00:00:00Z'},
    {id:'b',status:'approved',rating:1,comment:'Hubo problemas con el servicio',created_at:'2026-11-01T00:00:00Z'}
  ];
  assert.deepEqual(verifiedReviewSummary(snippet),{count:2,average:3});
  const ui=readFileSync(new URL('../reviews.js',import.meta.url),'utf8');
  assert.ok(ui.includes("else if(total===stats.count)"));
  assert.ok(ui.includes("'/5 de media de las mostradas'"));
  assert.ok(ui.includes('publicReviewsHasMore(rawLoaded,total)'));
  assert.ok(ui.includes('rawLoaded+=result.data.length'));
  assert.ok(ui.includes("No se pudieron cargar más valoraciones. Puedes reintentarlo."));
  assert.ok(!ui.includes(".limit(50)"));
});
