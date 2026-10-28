import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {savePrivateBillingDraft,readPrivateBillingDraft} from '../billing-draft-storage.js';

const job={
 id:'10000000-0000-4000-8000-000000000001',
 customer_id:'00000000-0000-4000-8000-000000000001',
 status:'completed',price:121
};
const fields={
 issuer_name:'REPARADO EJEMPLO',issuer_nif:'B12345678',issuer_address:'Calle prueba 1',
 recipient_name:'Cliente de prueba',recipient_nif:'12345678Z',
 recipient_address:'Calle prueba 2',description:'Reparación de fuga',operation_date:'2026-10-28'
};
test('V60: guardar borrador envía al servidor solo importe confirmado y datos revisados',async()=>{
 let calls=[];
 const supabase={rpc:async(name,params)=>{
  calls.push({name,params});
  return {data:'20000000-0000-4000-8000-000000000001',error:null};
 }};
 const saved=await savePrivateBillingDraft({supabase,job,fields});
 assert.ok(saved);
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'reparado_save_invoice_draft');
 assert.equal(calls[0].params.p_request_id,job.id);
 assert.equal(calls[0].params.p_expected_total,121);
 assert.equal(calls[0].params.p_issuer_nif,'B12345678');
 assert.equal(calls[0].params.p_operation_date,'2026-10-28');
 assert.equal(JSON.stringify(calls).includes('invoice_issued'),false);
});
test('V60: trabajos no completados o datos inválidos no hacen peticiones de escritura',async()=>{
 let called=false;const supabase={rpc:async()=>{called=true;throw Error('No debe contactar servidor')}};
 for(const bad of [{job:{...job,status:'quoted'},fields},{job,fields:{...fields,issuer_nif:'!'}}]){
  await assert.rejects(savePrivateBillingDraft({supabase,...bad}));
 }
 assert.equal(called,false);
});
test('V60: fallo de red no confirma guardado',async()=>{
 for(const rpc of [async()=>({error:new Error('database denied'),data:null}),
                   async()=>{throw new Error('NetworkError');}]){
  await assert.rejects(savePrivateBillingDraft({supabase:{rpc},job,fields}),/No se pudo/);
 }
});
test('V60: recuperar borrador exige mismo propietario, trabajo y precio',async()=>{
 const data={...fields,request_id:job.id,customer_id:job.customer_id,total:121};
 const fake=record=>({
  from(table){
   assert.equal(table,'invoice_drafts');
   return {select(){return this},eq(column,id){assert.equal(column,'request_id');assert.equal(id,job.id);return this},
     maybeSingle:async()=>({data:record,error:null})};
  }
 });
 const got=await readPrivateBillingDraft({supabase:fake(data),job});
 assert.deepEqual(got,fields);
 assert.equal(await readPrivateBillingDraft({supabase:fake(null),job}),null);
 for(const wrong of [{...data,customer_id:'foreign'}, {...data,total:130},{...data,request_id:'other'}]){
  await assert.rejects(readPrivateBillingDraft({supabase:fake(wrong),job}),/no coincide/);
 }
});
test('V60: pantalla solo prepara un borrador, controla cuenta y no emite factura',()=>{
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.match(code,/savePrivateBillingDraft\(\{supabase,job,fields\}\)/);
 assert.match(code,/readPrivateBillingDraft\(\{supabase,job\}\)/);
 assert.match(code,/currentView==='admin'&&profile\?\.role==='admin'/);
 assert.match(code,/data-save-billing/);
 assert.match(code,/data-load-billing/);
 assert.match(code,/draftForm\.addEventListener\('input'/);
 const migration=readFileSync(new URL('../supabase/migration-invoice-drafts-v60.sql',import.meta.url),'utf8');
 assert.match(migration,/enable row level security/);
 assert.match(migration,/REPARADO_BILLING_ADMIN_REQUIRED/);
 assert.match(migration,/for update/);
 assert.match(migration,/revoke all on public\.invoice_drafts from public,anon,authenticated/);
 assert.match(migration,/on conflict\(request_id\) do update/);
 assert.doesNotMatch(migration,/drop table public\.invoices/);
});
