import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateQuoteLines} from '../quote-calculator.js';

test('el calculador suma partidas y no duplica el IVA incluido',()=>{
 const q=calculateQuoteLines([
  {name:'Mano de obra',quantity:2,unitPrice:'60.50'},
  {name:'Material',quantity:'1,5',unitPrice:'24,20'}
 ]);
 assert.deepEqual(q.lines.map(x=>x.total),[121,36.30]);
 assert.equal(q.total,157.30);
 assert.equal(q.base+q.vat,q.total);
 assert.equal(q.percent,21);
});
test('aplica redondeo monetario por partida, no coma flotante acumulada',()=>{
 const q=calculateQuoteLines([{name:'Parquet',quantity:'1.25',unitPrice:'19.99'}]);
 assert.deepEqual(q.lines.map(x=>x.total),[24.99]);
 assert.equal(q.total,24.99);
});
test('rechaza cantidades mal formadas, partidas vacías y totales fuera de rango',()=>{
 assert.throws(()=>calculateQuoteLines([]),/entre 1 y 12/);
 assert.throws(()=>calculateQuoteLines([{name:'',quantity:1,unitPrice:1}]),/descripción obligatoria/);
 assert.throws(()=>calculateQuoteLines([{name:'Servicio',quantity:0,unitPrice:1}]),/rango permitido/);
 assert.throws(()=>calculateQuoteLines([{name:'Servicio',quantity:1,unitPrice:'1.999'}]),/dos decimales/);
 assert.throws(()=>calculateQuoteLines([{name:'Servicio',quantity:'-3',unitPrice:1}]),/número válido/);
 assert.throws(()=>calculateQuoteLines([{name:'Servicio',quantity:9999,unitPrice:999999}]),/límite permitido/);
 assert.throws(()=>calculateQuoteLines(Array.from({length:13},()=>({name:'S',quantity:1,unitPrice:1}))),/entre 1 y 12/);
});
