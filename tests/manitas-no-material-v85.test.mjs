import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 services,catalogPricingNotice,manitasPricingNotice,
 serviceInclusions,servicePriceTerms,manitasMaterialQuestionMarkup,
 manitasMaterialRequestNote
} from '../catalog-data.js';
import {renderCategory,serviceFormHeader,priceFor} from '../customer-ui.js';

const expected=Object.freeze({
 'Montaje de mueble en kit (mediano)':99,
 'Colocación de estantería':75,
 'Colgar cuadros o espejos (hasta 3)':69,
 'Instalación de barras de cortina o estores':89,
 'Instalación de soporte de TV en pared':109,
 'Ajuste de puertas y bisagras':79,
 'Cambio de cinta de persiana':79,
 'Renovación de silicona de bañera o ducha':79,
 'Instalación de lámpara sencilla':89,
 'Colocación de accesorios de baño':79,
 'Reparación menor de muebles':89,
 'Cambio de manilla de puerta':69
});

test('V85: exactamente 12 tarifas de Manitas reajustadas, IVA 21 % incluido sin material',()=>{
 const manitas=services.filter(item=>item[0]==='Manitas');
 assert.equal(manitas.length,12);
 assert.deepEqual(Object.fromEntries(manitas.map(x=>[x[1],x[2]])),expected);
 for(const item of manitas){
   assert.match(priceFor(item),/^\d{2,3},00 €$/);
   assert.match(servicePriceTerms(item),/material NO incluido/);
   assert.match(servicePriceTerms(item),/IVA del 21 %/);
   assert.ok(serviceInclusions[item[1]].includes('cliente'),'Material sin aclarar: '+item[1]);
   assert.doesNotMatch(serviceInclusions[item[1]],/incluidos|incluida la pieza/i);
 }
 assert.match(manitasPricingNotice,/MATERIAL NO INCLUIDO/);
 assert.match(manitasPricingNotice,/desplazamiento ordinario/);
 assert.match(manitasPricingNotice,/IVA del 21 %/);
 assert.match(manitasPricingNotice,/presupuesto adicional/);
});

test('V85: Fontanería, Albañilería, Parquet y reformas conservan precios y alcance con material',()=>{
 const sample={
  'Sustitución de grifo':175,
  'Instalación de termo eléctrico':495,
  'Alicatado':69,
  'Tabique de Pladur':65,
  'Instalación de parquet/laminado':49,
  'Colocación de rodapié':22,
  'Reforma integral de baño':0
 };
 for(const [name,price] of Object.entries(sample)){
   const s=services.find(x=>x[1]===name);
   assert.equal(s[2],price);
   assert.notEqual(s[0],'Manitas');
   assert.ok(serviceInclusions[name]);
   assert.ok(!servicePriceTerms(s).includes('material NO incluido'));
 }
 assert.equal(services.length,37);
 assert.match(catalogPricingNotice,/materiales estándar descritos/);
});

test('V85: textos y pantallas no afirman que Manitas incluya materiales',()=>{
 const category=renderCategory(services,'Manitas');
 assert.ok(category.includes('catalog-price-policy'));
 assert.ok(category.includes('MATERIAL NO INCLUIDO'));
 assert.ok(category.includes('lo aporta el cliente')||category.includes('aportados por el cliente'));
 assert.ok(!category.includes(catalogPricingNotice));
 const form=serviceFormHeader(services.find(x=>x[1]==='Instalación de soporte de TV en pared'));
 assert.ok(form.includes('Desde 109,00 €'));
 assert.ok(form.includes('material NO incluido'));
 assert.ok(form.includes('soporte, tornillería, tacos especiales y televisor aportados por el cliente'));
 assert.ok(!form.includes('Material estándar, mano de obra e IVA incluidos'));
 const other=serviceFormHeader(services.find(x=>x[1]==='Sustitución de grifo'));
 assert.ok(other.includes('Material estándar, mano de obra e IVA incluidos'));
 assert.ok(renderCategory(services,'Fontanería').includes(catalogPricingNotice));
});

test('V85: el cliente indica si tiene material o si necesita presupuesto adicional',()=>{
 assert.ok(manitasMaterialQuestionMarkup.includes('name="manitas_material"'));
 assert.ok(manitasMaterialQuestionMarkup.includes('value="client" checked'));
 assert.ok(manitasMaterialQuestionMarkup.includes('value="quote"'));
 const item=services.find(x=>x[1]==='Instalación de lámpara sencilla');
 assert.equal(manitasMaterialRequestNote(item,'client'),
   '\nMaterial (Manitas): el cliente lo aporta. Precio orientativo sin materiales.');
 assert.equal(manitasMaterialRequestNote(item,'quote'),
   '\nMaterial (Manitas): solicitar presupuesto adicional de materiales; no incluido en tarifa.');
 assert.equal(manitasMaterialRequestNote(services[0],'quote'),'');
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(code.includes("service[0]==='Manitas'?manitasMaterialQuestionMarkup:''"));
 assert.ok(code.includes("manitasMaterialRequestNote(service,fields.get('manitas_material'))"));
 assert.ok(code.includes("service[0]==='Manitas'?esc(manitasPricingNotice)"));
 assert.ok(code.includes('firstAttemptPayload=payloadText'));
});

test('V85: el presupuesto del propietario no cambia importes existentes ni obliga a aceptar extras',()=>{
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(code.includes("status,price:quotedPrice,operator_id"));
 assert.ok(code.includes("accept_reparado_quote"));
 assert.ok(!code.includes("price:service[2]"));
});
