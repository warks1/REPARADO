import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quoteAcceptanceSummary,quoteAcceptanceFilename} from '../quote-acceptance-summary.js';

const id='10000000-0000-4000-8000-000000000003';
const record={id,service_name:'Sustitución de grifo',accepted_at:'2026-10-27T07:30:00Z',accepted_price:121,status:'completed'};
const source=readFileSync(new URL('../connected.js',import.meta.url),'utf8');

test('V36: resumen HTML independiente, importes con IVA y fecha registrada',()=>{
  const html=quoteAcceptanceSummary(record);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.match(html,/Resumen de aceptación de presupuesto/);
  assert.match(html,/121,00 €/);
  assert.match(html,/100,00 €/);
  assert.match(html,/21,00 €/);
  assert.match(html,/27 de octubre de 2026/);
  assert.match(html,/No es una factura/);
  assert.match(html,/no es una factura|No es una factura/);
  assert.equal(quoteAcceptanceFilename(record),'REPARADO-presupuesto-aceptado-'+id+'.html');
  assert.doesNotMatch(html,/https?:\/\//);
});
test('V36: texto malicioso se escapa y no se copia información privada innecesaria',()=>{
  const html=quoteAcceptanceSummary({...record,service_name:'<img src=x onerror=alert(1)>'});
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img'));
  assert.doesNotMatch(html,/600000000|Calle Test|<script>/);
});
test('V36: nunca inventa resúmenes sin aceptación registrada ni importe válido',()=>{
  for(const changes of [
    {accepted_at:null},{accepted_price:null},{accepted_price:-1},
    {accepted_at:'fecha falsa'},{id:'../../token'},{accepted_price:Infinity}
  ])assert.throws(()=>quoteAcceptanceSummary({...record,...changes}));
  assert.throws(()=>quoteAcceptanceFilename({id:'../token'}));
});
test('V36: la descarga solo está disponible para una solicitud visible con aceptación',()=>{
  assert.match(source,/data-download-accepted-quote/);
  assert.match(source,/data\.find\(item=>item\.id===button\.dataset\.downloadAcceptedQuote\)/);
  assert.match(source,/!isCurrentUser\(userId\)\|\|currentView!=='requests'\|\|!button\.isConnected/);
  assert.match(source,/downloadQuoteAcceptanceSummary\(record\)/);
});
