import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkInvoiceAmounts,formatInvoiceEuro,invoiceStatusLabels} from '../invoice-math.js';

test('Facturación: el IVA incluido del 21 % cuadra con base y total',()=>{
 assert.deepEqual(checkInvoiceAmounts({subtotal:100,vat:21,total:121}),{valid:true,reason:null});
 assert.deepEqual(checkInvoiceAmounts({subtotal:'49.59',vat:'10.41',total:'60.00'}),{valid:true,reason:null});
 assert.equal(checkInvoiceAmounts({subtotal:100,vat:20,total:120}).valid,false);
 assert.equal(checkInvoiceAmounts({subtotal:100,vat:21,total:125}).valid,false);
 assert.equal(checkInvoiceAmounts({subtotal:-1,vat:0,total:-1}).valid,false);
 assert.equal(checkInvoiceAmounts({subtotal:'',vat:0,total:0}).valid,false);
 assert.equal(checkInvoiceAmounts({subtotal:Infinity,vat:0,total:0}).valid,false);
 assert.equal(checkInvoiceAmounts({subtotal:'texto',vat:0,total:0}).valid,false);
});
test('Facturación: formato de importes es-ES, sin asumir 0 en campos vacíos',()=>{
 assert.match(formatInvoiceEuro(121),/121,00/);
 assert.match(formatInvoiceEuro(60),/60,00/);
 assert.equal(formatInvoiceEuro(null),'Importe no disponible');
 assert.equal(formatInvoiceEuro(''),'Importe no disponible');
 assert.equal(invoiceStatusLabels.issued,'Emitida');
});
test('Facturación: la vista no finge PDFs ni omite avisos de importes inconsistentes',()=>{
 const ui=readFileSync(new URL('../invoices.js',import.meta.url),'utf8');
 assert.ok(ui.includes("checkInvoiceAmounts(bill)"));
 assert.ok(ui.includes("formatInvoiceEuro(value)"));
 assert.ok(ui.includes("role','alert'"));
 assert.ok(ui.includes("Importes pendientes de revisión:"));
 assert.ok(ui.includes(".neq('status','draft')"));
 assert.ok(!ui.includes('window.print('));
});
test('Migración V9: números únicos, datos de cliente y documentos inmutables',()=>{
 const sql=readFileSync(new URL('../supabase/migration-v9.sql',import.meta.url),'utf8');
 assert.ok(sql.includes('REPARADO_EXISTING_INVOICE_DUPLICATE_NUMBER'));
 assert.ok(sql.includes('create unique index if not exists reparado_invoice_final_number_unique_v9'));
 assert.ok(sql.includes('upper(btrim(number))'));
 assert.ok(sql.includes('abs(vat-round(subtotal*0.21,2))'));
 assert.ok(sql.includes('REPARADO_INVOICE_CUSTOMER_MISMATCH'));
 assert.ok(sql.includes('REPARADO_INVOICE_FINAL_LOCKED'));
 assert.ok(sql.includes('revoke insert,update,delete on public.invoices from anon,authenticated'));
});
