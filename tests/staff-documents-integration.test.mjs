import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('presupuestos internos solo disponibles para administración',()=>{
 const js=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(js.includes("if(kind==='quote'&&!admin)return"));
 assert.ok(js.includes('data-doc-kind="quote"'));
 assert.ok(js.includes('data-doc-kind="order"'));
 assert.ok(js.includes('staffDocument(job,{kind,price})'));
 assert.ok(js.includes("if(currentView!=='admin'||!userIsStaff())return"));
});
test('documentos imprimibles no conceden permisos ni emiten facturas',()=>{
 const code=readFileSync(new URL('../staff-documents.js',import.meta.url),'utf8');
 assert.ok(code.includes('No ha sido enviado ni aceptado'));
 assert.ok(code.includes('no es una factura'));
 assert.ok(code.includes('Los cambios del formulario pendientes de guardar'));
});

test('el cliente conectado ve las etapas de su propia solicitud',()=>{
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(code.includes('staffProgressMarkup(r.status)'));
 assert.ok(code.includes(".eq('customer_id',session.user.id)"));
 assert.ok(code.includes('accept_reparado_quote'));
});
test('la impresión mantiene una sola orden o presupuesto activo',()=>{
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(code.includes("main.querySelectorAll('[data-document-host]').forEach"));
 assert.ok(code.includes('other.replaceChildren()'));
});
