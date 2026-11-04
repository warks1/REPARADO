import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {invoicePageSize,invoicePageCount,invoiceCanAdvance,fetchInvoicesPage} from '../invoices.js';

function mock({total=126,networkError=false,missingCount=false}={}){
  const calls=[];
  const chain={
    eq(field,value){calls.push(['eq',field,value]);return chain},
    neq(field,value){calls.push(['neq',field,value]);return chain},
    order(field,options){calls.push(['order',field,options]);return chain},
    range(start,end){
      calls.push(['range',start,end]);
      if(networkError)return Promise.resolve({data:null,count:null,error:{message:'network'}});
      const size=Math.max(0,Math.min(end,total-1)-start+1);
      return Promise.resolve({
        data:Array.from({length:size},(_,i)=>({number:'FAC-'+(start+i+1)})),
        count:missingCount?null:total,error:null
      });
    }
  };
  const client={from(table){calls.push(['from',table]);return {
    select(columns,options){calls.push(['select',columns,options]);return chain}
  }}};
  return {calls,client};
}

test('V76: las facturas no desaparecen después de los primeros 50 registros',()=>{
  assert.equal(invoicePageSize,50);
  assert.equal(invoicePageCount(0),1);
  assert.equal(invoicePageCount(50),1);
  assert.equal(invoicePageCount(51),2);
  assert.equal(invoicePageCount(126),3);
  assert.equal(invoicePageCount(null),0);
  assert.equal(invoiceCanAdvance(0,126),true);
  assert.equal(invoiceCanAdvance(2,126),false);
  assert.equal(invoiceCanAdvance(-1,126),false);
});

test('V76: página tercera consulta las facturas 101-126 de ese cliente, sin borradores',async()=>{
  const {calls,client}=mock();
  const result=await fetchInvoicesPage(client,'cliente-prueba',2);
  assert.equal(result.error,false);
  assert.equal(result.count,126);
  assert.equal(result.data.length,26);
  assert.equal(result.data[0].number,'FAC-101');
  assert.equal(result.data.at(-1).number,'FAC-126');
  assert.deepEqual(calls,[
    ['from','invoices'],
    ['select','number,subtotal,vat,total,status,created_at',{count:'exact'}],
    ['eq','customer_id','cliente-prueba'],
    ['neq','status','draft'],
    ['order','created_at',{ascending:false}],
    ['order','id',{ascending:false}],
    ['range',100,149]
  ]);
});

test('V76: la pérdida de red o del contador no finge un historial vacío',async()=>{
  for(const options of [{networkError:true},{missingCount:true}]){
    const {client}=mock(options);
    assert.deepEqual(await fetchInvoicesPage(client,'cliente-prueba',0),
      {data:null,count:null,error:true});
  }
  const {client}=mock();
  for(const page of [-1,NaN,1.5,100001]){
    assert.deepEqual(await fetchInvoicesPage(client,'cliente-prueba',page),
      {data:null,count:null,error:true});
  }
  assert.deepEqual(await fetchInvoicesPage(client,'',0),
    {data:null,count:null,error:true});
});

test('V76: navegación en Mis facturas y protección frente a respuestas obsoletas',()=>{
  const code=readFileSync(new URL('../invoices.js',import.meta.url),'utf8');
  assert.match(code,/aria-label','Páginas de mis facturas'/);
  assert.match(code,/invoiceCanAdvance\(page,count\)/);
  assert.match(code,/main\.firstElementChild!==section/);
  assert.match(code,/main\.firstElementChild!==loading/);
  assert.match(code,/return renderInvoices\(\{main,supabase,session,onRefresh,page:invoicePageCount\(count\)-1\}\)/);
  assert.ok(!code.includes('.limit(50)'));
  assert.ok(code.includes('checkInvoiceAmounts(bill)'));
  assert.ok(code.includes(".neq('status','draft')"));
});
