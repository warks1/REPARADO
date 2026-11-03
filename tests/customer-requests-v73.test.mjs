import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {customerRequestsPageSize,customerRequestsPageCount,
 customerRequestsCanAdvance,fetchCustomerRequestsPage} from '../customer-requests-page.js';

function mock({count=126,networkError=false,missingCount=false}={}){
 const calls=[];
 const chain={
  eq(field,value){calls.push(['eq',field,value]);return chain},
  order(field,opts){calls.push(['order',field,opts]);return chain},
  range(start,end){
   calls.push(['range',start,end]);
   if(networkError)return Promise.resolve({data:null,count:null,error:{message:'offline'}});
   const size=Math.max(0,Math.min(end,count-1)-start+1);
   return Promise.resolve({data:Array.from({length:size},(_,i)=>({id:'r-'+(start+i)})),
     count:missingCount?null:count,error:null});
  }
 };
 return {calls,client:{from(table){calls.push(['from',table]);return {
  select(cols,opts){calls.push(['select',cols,opts]);return chain}
 }}}};
}

test('V73: exactamente 50 por página y contador sin falsos ceros',()=>{
 assert.equal(customerRequestsPageSize,50);
 assert.equal(customerRequestsPageCount(0),1);
 assert.equal(customerRequestsPageCount(1),1);
 assert.equal(customerRequestsPageCount(50),1);
 assert.equal(customerRequestsPageCount(51),2);
 assert.equal(customerRequestsPageCount(126),3);
 assert.equal(customerRequestsPageCount(null),0);
 assert.equal(customerRequestsPageCount(-1),0);
 assert.equal(customerRequestsCanAdvance(0,126),true);
 assert.equal(customerRequestsCanAdvance(1,126),true);
 assert.equal(customerRequestsCanAdvance(2,126),false);
 assert.equal(customerRequestsCanAdvance(-1,126),false);
});

test('V73: página 3 consulta registros 101-126 filtrados por propietario en Supabase',async()=>{
 const {calls,client}=mock({count:126});
 const result=await fetchCustomerRequestsPage(client,'cliente-prueba','id,service_name',2);
 assert.equal(result.error,false);
 assert.equal(result.count,126);
 assert.equal(result.data.length,26);
 assert.equal(result.data[0].id,'r-100');
 assert.equal(result.data.at(-1).id,'r-125');
 assert.deepEqual(calls,[
  ['from','service_requests'],
  ['select','id,service_name',{count:'exact'}],
  ['eq','customer_id','cliente-prueba'],
  ['order','created_at',{ascending:false}],
  ['range',100,149]
 ]);
});

test('V73: errores y recuentos desconocidos no se interpretan como historial vacío',async()=>{
 for(const opts of [{networkError:true},{missingCount:true}]){
  const {client}=mock(opts);
  assert.deepEqual(await fetchCustomerRequestsPage(client,'cliente-a','id',0),
    {data:null,count:null,error:true});
 }
 const {client}=mock();
 for(const page of [-1,1.2,NaN,100001]){
  assert.deepEqual(await fetchCustomerRequestsPage(client,'cliente-a','id',page),
    {data:null,count:null,error:true});
 }
 assert.deepEqual(await fetchCustomerRequestsPage(client,'','id',0),
    {data:null,count:null,error:true});
});

test('V73: solo listado de solicitudes del cliente, navegación y controles existentes',()=>{
 const app=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(app.includes("fetchCustomerRequestsPage(supabase,userId,"));
 assert.ok(app.includes('aria-label="Páginas de mis solicitudes"'));
 assert.ok(app.includes('data-requests-page="next"'));
 assert.ok(app.includes('data-requests-page="prev"'));
 assert.ok(app.includes('customerRequestsCanAdvance(requestedPage,count)'));
 assert.ok(app.includes('if(count>0 && requestedPage>=customerRequestsPageCount(count)){customerRequestsPage=0;return loadRequests();}'));
 assert.ok(app.includes('let customerRequestsPage=0;'));
 assert.ok(app.includes('await loadRequests();'));
 assert.ok(app.includes("async function loadRequests(){"));
 assert.ok(app.includes("data-accept-quote="));
 assert.ok(app.includes("data-customer-photos="));
 assert.ok(app.includes("data-rate-request="));
});
