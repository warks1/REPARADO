import test from 'node:test';
import assert from 'node:assert/strict';
import {services,serviceInclusions,catalogPricingNotice} from '../catalog-data.js';
import {renderCategory,serviceFormHeader,priceFor} from '../customer-ui.js';

test('V61: las cinco categorías suman 37 servicios con alcance definido',()=>{
 assert.equal(services.length,37);
 assert.equal(new Set(services.map(s=>s[1])).size,37);
 for(const s of services){
  assert.ok(Number.isFinite(s[2])&&s[2]>=0,'Precio inválido '+s[1]);
  assert.ok(serviceInclusions[s[1]]?.length>=40,'Falta alcance '+s[1]);
  assert.equal(s[0]==='Reformas integrales',s[2]===0,'Reformas por presupuesto '+s[1]);
 }
 assert.match(catalogPricingNotice,/IVA del 21 %/);
 assert.equal(services.filter(s=>s[2]===0).length,3);
});
test('V61: unidades m² y metro lineal correctamente diferenciadas',()=>{
 for(const name of ['Alicatado','Solado de gres','Rejuntado','Tabique de Pladur','Instalación de parquet/laminado']){
  const s=services.find(x=>x[1]===name);
  assert.equal(s[3],'m²');
  assert.match(priceFor(s),/\/ m²$/);
 }
 const rodapie=services.find(s=>s[1]==='Colocación de rodapié');
 assert.equal(rodapie[3],'m');
 assert.match(priceFor(rodapie),/\/ m$/);
});
test('V61: importes finales estándar y piezas aportadas claramente identificadas',()=>{
 const one=n=>services.find(s=>s[1]===n);
 assert.equal(priceFor(one('Sustitución de grifo')),'175,00 €');
 assert.equal(priceFor(one('Instalación de termo eléctrico')),'495,00 €');
 assert.equal(priceFor(one('Instalación de parquet/laminado')),'49,00 € / m²');
 assert.equal(priceFor(one('Instalación de soporte de TV en pared')),'109,00 €');
 assert.match(serviceInclusions['Montaje de mueble en kit (mediano)'],/lo aporta el cliente/);
 assert.match(serviceInclusions['Instalación de termo eléctrico'],/80 l/);
});
test('V61: categoría y formulario muestran condiciones, materiales e IVA',()=>{
 const html=renderCategory(services,'Fontanería');
 assert.ok(html.includes('catalog-price-policy'));
 assert.ok(html.includes('materiales estándar'));
 assert.ok(html.includes('Grifo monomando estándar'));
 const form=serviceFormHeader(services.find(s=>s[1]==='Instalación de termo eléctrico'));
 assert.ok(form.includes('service-includes'));
 assert.ok(form.includes('80 l'));
 assert.ok(form.includes('IVA incluidos'));
 const reforma=serviceFormHeader(services.find(s=>s[1]==='Reforma integral de baño'));
 assert.ok(reforma.includes('Por presupuesto'));
});

test('V71: detalle de solicitud indica tarifa desde sin presentar presupuesto cerrado',()=>{
 const form=name=>serviceFormHeader(services.find(s=>s[1]===name));
 assert.ok(form('Sustitución de grifo').includes('<em>Desde 175,00 € · Material estándar'));
 assert.ok(form('Instalación de parquet/laminado').includes('<em>Desde 49,00 € / m² · Material estándar'));
 assert.ok(form('Reforma integral de baño').includes('<em>Por presupuesto · Sujeto a presupuesto'));
 assert.ok(!form('Reforma integral de baño').includes('Desde Por presupuesto'));
});
