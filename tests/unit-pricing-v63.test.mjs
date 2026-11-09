import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../catalog-data.js';
import {unitQuote,unitQuoteText,unitQuantityMarkup,unitQuantityDescription,minimumQuantityByService} from '../unit-pricing.js';
import {localReceipt,localPriceLabel,localRequestBackup} from '../local-document.js';
import {makeLocalCollection,restoreLocalCollection} from '../local-backup.js';

const named=name=>services.find(s=>s[1]===name);

test('V63: todos los servicios por m² o m incluyen un mínimo y no confunden el precio unitario',()=>{
  const unitItems=services.filter(s=>s[3]);
  assert.equal(unitItems.length,11);
  assert.equal(Object.keys(minimumQuantityByService).length,unitItems.length);
  for(const s of unitItems){
    assert.ok(['m','m²'].includes(s[3]));
    assert.ok(minimumQuantityByService[s[1]]>0,s[1]);
    const result=unitQuote(s,String(minimumQuantityByService[s[1]]));
    assert.equal(result.status,'estimate');
    assert.equal(result.total,s[2]*minimumQuantityByService[s[1]]);
    assert.match(unitQuantityMarkup(s),/estimated_quantity/);
  }
  assert.equal(unitQuantityMarkup(named('Sustitución de grifo')),'');
  assert.equal(unitQuote(named('Sustitución de grifo'),'20'),null);
});

test('V63: presupuesto de parquet de 20 m² no se confunde con 54 € totales',()=>{
  const parquet=named('Instalación de parquet/laminado');
  assert.equal(unitQuote(parquet,'20').total,1080);
  assert.equal(unitQuote(parquet,'15').total,810);
  assert.equal(unitQuote(parquet,'14,5').status,'below-minimum');
  assert.equal(unitQuote(parquet,'').status,'empty');
  assert.match(unitQuoteText(unitQuote(parquet,'20')),/1.080,00 €/);
  assert.match(unitQuoteText(unitQuote(parquet,'20')),/presupuesto aceptado/);
  assert.match(unitQuoteText(unitQuote(parquet,'14,5')),/presupuesto específico/);
  assert.match(unitQuantityDescription(unitQuote(parquet,'20')),/20 m²/);
  assert.doesNotMatch(unitQuantityDescription(unitQuote(parquet,'20')),/1080|€|precio aceptado/i);
});

test('V63: longitudes con decimales españoles y validación de cantidades',()=>{
  const rodapie=named('Colocación de rodapié');
  assert.equal(unitQuote(rodapie,'15,25').total,366);
  assert.equal(unitQuote(rodapie,'15.25').total,366);
  assert.equal(unitQuote(rodapie,'14.99').status,'below-minimum');
  for(const bad of ['-1','0','0,00','10001','1e2','1,234','20xyz','NaN','10/2','1.000,00']){
    assert.equal(unitQuote(rodapie,bad).status,'invalid',bad);
  }
});

test('V63: borrador local antiguo se muestra como tarifa por unidad, nunca total',()=>{
  const previous={id:'old',category:'Parquet',service:'Instalación de parquet/laminado',price:49};
  assert.match(localPriceLabel(previous),/49,00 € \/ m²/);
  assert.doesNotMatch(localPriceLabel(previous),/49,00 € \(IVA incluido, orientativo\)/);
  assert.match(localReceipt(previous),/Pendiente de presupuesto|tarifa orientativa|Tarifa orientativa/i);
});

test('V63: copia local conserva cantidad/rate sin convertirlo en importe total',()=>{
  const request={
    id:'request-v63',category:'Parquet',service:'Instalación de parquet/laminado',
    street:'Prueba',address:'12',postal_code:'08001',city:'Barcelona',
    description:'Instalar parquet',status:'Pendiente (local)',price:0,
    unit_name:'m²',unit_rate:49,unit_quantity:20
  };
  assert.match(localPriceLabel(request),/1.080,00 €/);
  assert.ok(localReceipt(request).includes('980,00 €'));
  const backup=makeLocalCollection([request],'2026-11-03T11:00:00.000Z');
  const restored=restoreLocalCollection(JSON.stringify(backup),[]);
  assert.equal(restored.added,1);
  assert.equal(restored.requests[0].price,0);
  assert.equal(restored.requests[0].unit_name,'m²');
  assert.equal(restored.requests[0].unit_rate,49);
  assert.equal(restored.requests[0].unit_quantity,20);
  assert.equal(localRequestBackup(restored.requests[0]).request.unit_quantity,20);
});

test('V63: rechazar cantidades y unidades manipuladas en copias del dispositivo',()=>{
  const valid={id:'r1',category:'Parquet',service:'Instalación de parquet/laminado',
    price:0,unit_name:'m²',unit_rate:49,unit_quantity:20};
  for(const changed of [{unit_quantity:-1},{unit_quantity:'20'},{unit_quantity:10001},
    {unit_rate:-10},{unit_rate:NaN},{unit_name:'€'}, {unit_name:'m²',unit_rate:undefined}]){
    const backup={format:'reparado-local-collection',version:1,requests:[{...valid,...changed}]};
    assert.throws(()=>restoreLocalCollection(JSON.stringify(backup),[]));
  }
});

test('V63: formulario conectado no envía la estimación como precio fijo',()=>{
  const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  const demo=readFileSync(new URL('../local-preview.js',import.meta.url),'utf8');
  assert.ok(code.includes('unitQuantityMarkup(service)'));
  assert.ok(code.includes('bindUnitQuantity(form,service)'));
  assert.ok(code.includes('unitQuantityDescription(areaQuote)'));
  const requestPayload=code.match(/const payload=\{([\s\S]*?)\n        \};/)?.[1]||'';
  assert.ok(requestPayload.includes('description:'));
  assert.doesNotMatch(requestPayload,/\bprice\s*:/);
  assert.ok(demo.includes('price:s[3]?0:s[2]'));
  assert.ok(demo.includes('unit_quantity:areaQuote?.quantity??null'));
});
