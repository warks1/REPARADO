import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {billingDraftFormMarkup,prepareBillingDraft,billingDraftDocument} from '../billing-draft.js';

const job={
  id:'10000000-0000-4000-8000-000000000005',status:'completed',price:121,
  service_name:'Cambio de grifo',street:'Carrer de Ribes',address_number:'30',
  postal_code:'08013',city:'Barcelona'
};
const fields={
  issuer_name:'REPARADO · Servicios',issuer_nif:'B12345678',
  issuer_address:'Calle de ejemplo, 2, Barcelona',
  recipient_name:'Cliente de prueba',recipient_nif:'12345678Z',
  recipient_address:'Carrer de Ribes, 30, 08013, Barcelona',
  description:'Reparación de grifería',operation_date:'2026-10-28'
};

test('V59: el borrador usa total IVA incluido y muestra base/cuota exactas',()=>{
  const a=prepareBillingDraft(job,fields);
  assert.equal(a.price,121);
  assert.equal(a.base,100);
  assert.equal(a.vat,21);
  assert.equal(a.taxPercent,21);
  const other=prepareBillingDraft({...job,price:60},fields);
  assert.equal(other.price,60);
  assert.equal(other.base,49.59);
  assert.equal(other.vat,10.41);
});

test('V59: sin trabajo completado, datos fiscales, IVA válido o fecha correcta no hay borrador',()=>{
  for(const status of ['new','quoted','accepted','scheduled','in_progress','cancelled'])
    assert.throws(()=>prepareBillingDraft({...job,status},fields),/terminado/);
  for(const price of [null,undefined,0,-1,NaN,Infinity,10.999,1000000])
    assert.throws(()=>prepareBillingDraft({...job,price},fields));
  for(const update of [
    {issuer_name:''},{issuer_nif:'?'},{issuer_address:''},
    {recipient_name:''},{recipient_nif:'!'},{recipient_address:''},
    {description:''},{operation_date:'2026-02-30'}
  ])assert.throws(()=>prepareBillingDraft(job,{...fields,...update}));
});

test('V59: previsualizar no inventa número, fecha de expedición ni factura emitida',()=>{
  const html=billingDraftDocument(job,fields);
  for(const value of ['BORRADOR','NO ES UNA FACTURA EMITIDA','Número de factura','Pendiente de asignar','IVA','100,00 €','21,00 €','121,00 €'])assert.ok(html.includes(value));
  assert.ok(!html.includes('Factura RP-'));
  const editor=billingDraftFormMarkup(job);
  assert.ok(editor.includes('data-billing-draft-form'));
  assert.ok(editor.includes('Carrer de Ribes, 30, 08013, Barcelona'));
  assert.ok(editor.includes('no se guardan')||editor.includes('No se guardan'));
});

test('V59: campos suministrados se escapan para impedir HTML/scripts de cliente',()=>{
  const dangerous='<img src=x onerror=alert(1)>';
  const html=billingDraftDocument(job,{...fields,recipient_name:dangerous,description:dangerous});
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img src=x onerror='));
  const form=billingDraftFormMarkup({...job,service_name:'"><script>bad</script>'});
  assert.ok(!form.includes('<script>bad</script>'));
});

test('V59: solo admin y trabajo completado pueden abrir la preparación; no hay inserción',()=>{
  const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  const source=readFileSync(new URL('../billing-draft.js',import.meta.url),'utf8');
  assert.match(code,/admin && job\.status==='completed' && job\.price!=null/);
  assert.match(code,/currentView!=='admin'\|\|profile\?\.role!=='admin'/);
  assert.match(code,/billingDraftFormMarkup\(job\)/);
  assert.match(code,/billingDraftDocument\(job,Object\.fromEntries\(new FormData\(draftForm\)\)\)/);
  assert.doesNotMatch(source,/\.from\(['"]invoices['"]\)|\.insert\(|\.update\(|\.rpc\(/);
  assert.match(code,/Imprimir \/ guardar borrador PDF/);
});
