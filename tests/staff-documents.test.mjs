import test from 'node:test';
import assert from 'node:assert/strict';
import {staffDocument,staffProgress,staffProgressMarkup,readableJobDate} from '../staff-documents.js';
const job={
 id:'trabajo-1',service_name:'Reparación de fuga',status:'scheduled',
 street:'Calle <script>alert(1)</script>',address_number:'25',city:'Barcelona',
 phone:'600000000',description:'Grifo & sifón',operator_name:'Técnico asignado',
 scheduled_at:'2026-11-12T10:30:00Z',price:121
};
test('progreso solo refleja estado registrado y no inventa fechas',()=>{
 const progress=staffProgress('scheduled');
 assert.equal(progress.steps.length,6);
 assert.equal(progress.steps.filter(s=>s.current).length,1);
 assert.equal(progress.steps[3].label,'Programada');
 assert.equal(progress.steps[5].completed,false);
 assert.ok(staffProgressMarkup('scheduled').includes('aria-current="step"'));
 assert.ok(staffProgressMarkup('cancelled').includes('Trabajo cancelado'));
 assert.equal(readableJobDate(null),'Sin fecha programada');
});
test('orden de trabajo es informativa y escapa datos del cliente',()=>{
 const html=staffDocument(job,{kind:'order'});
 assert.ok(html.includes('ORDEN DE TRABAJO INTERNA'));
 assert.ok(html.includes('121,00 €'));
 assert.ok(html.includes('100,00 €'));
 assert.ok(html.includes('21,00 €'));
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('no es una factura'));
});
test('presupuesto no simula aceptación ni facturación',()=>{
 const html=staffDocument(job,{kind:'quote',price:'242.00'});
 assert.ok(html.includes('BORRADOR INTERNO DE PRESUPUESTO'));
 assert.ok(html.includes('No ha sido enviado ni aceptado'));
 assert.ok(html.includes('242,00 €'));
 assert.ok(!html.includes('<script>'));
 assert.throws(()=>staffDocument(job,{kind:'quote',price:''}),/importe válido/);
 assert.throws(()=>staffDocument(job,{kind:'quote',price:-1}),/importe válido/);
 assert.throws(()=>staffDocument(job,{kind:'invoice',price:121}),/Documento no válido/);
});

test('borrador por partidas incluye desglose y comprueba coincidencia con el precio',()=>{
 const items=[
  {name:'Mano de obra',quantity:'2',unitPrice:'60.50'},
  {name:'Material & accesorios',quantity:'1',unitPrice:'24.20'}
 ];
 const html=staffDocument(job,{kind:'quote',price:145.20,items});
 assert.ok(html.includes('Partidas del borrador'));
 assert.ok(html.includes('Mano de obra'));
 assert.ok(html.includes('Material &amp; accesorios'));
 assert.ok(html.includes('145,20 €'));
 assert.throws(()=>staffDocument(job,{kind:'quote',price:120,items}),/no coincide con el desglose/);
});
