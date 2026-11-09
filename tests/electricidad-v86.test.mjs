import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services,serviceInclusions,electricidadPricingNotice,
  manitasPricingNotice,servicePriceTerms} from '../catalog-data.js';
import {categories,renderCategory,renderLanding,serviceFormHeader,
  featuredServices,priceFor,categoryArt} from '../customer-ui.js';
import {additionalServicePhoto} from '../service-photos.js';

const expectedElectrical=Object.freeze({
  'Sustitución de enchufe estándar':89,
  'Sustitución de interruptor o conmutador':89,
  'Instalación de base de enchufe doble':125,
  'Nuevo punto de enchufe superficial':185,
  'Nuevo punto de luz con canalización vista':195,
  'Sustitución de diferencial estándar':159,
  'Sustitución de magnetotérmico estándar':129,
  'Diagnóstico de avería eléctrica doméstica':125,
  'Instalación de detector de movimiento para luz':155,
  'Instalación de timbre eléctrico sencillo':149
});
const sampleOtherPrices=Object.freeze({
  'Desatasco de lavabo o fregadero':125,
  'Cambio de sifón':115,
  'Reparación de fuga':179,
  'Sustitución de grifo':189,
  'Mecanismo de cisterna':159,
  'Cambio de llave de paso':159,
  'Instalación de termo eléctrico':539,
  'Revisión de instalación de agua':135,
  'Reposición de azulejos':179,
  'Alicatado':75,
  'Solado de gres':82,
  'Rejuntado':43,
  'Tabique de Pladur':72,
  'Trasdosado de Pladur':61,
  'Techo de Pladur':79,
  'Reparación de enlucidos':169,
  'Instalación de parquet/laminado':54,
  'Reparación de tablas':179,
  'Acuchillado/lijado':21,
  'Barnizado':18,
  'Retirada de pavimento':25,
  'Colocación de rodapié':24
});
test('V86: exactamente seis categorías y 47 servicios sin duplicados',()=>{
 assert.deepEqual(categories.map(x=>x.id),
   ['Fontanería','Albañilería','Parquet','Reformas integrales','Manitas','Electricidad']);
 assert.equal(services.length,47);
 assert.equal(new Set(services.map(x=>x[1])).size,47);
 assert.equal(services.filter(x=>x[0]==='Manitas').length,12);
 assert.equal(services.filter(x=>x[0]==='Reformas integrales'&&x[2]===0).length,3);
 assert.equal(services.filter(x=>x[0]==='Electricidad').length,10);
 const home=renderLanding(services);
 assert.ok(home.includes('theme-electricity'));
 assert.ok(home.includes('data-category-open="Electricidad"'));
 assert.ok(home.includes('theme-handyman'));
 assert.deepEqual(featuredServices(services).map(x=>x.s[0]),categories.map(x=>x.id));
});

test('V86: 10 importes de electricidad con IVA, alcance y sin un simple servicio de Manitas duplicado',()=>{
 const group=services.filter(x=>x[0]==='Electricidad');
 assert.deepEqual(Object.fromEntries(group.map(x=>[x[1],x[2]])),expectedElectrical);
 assert.equal(group.length,10);
 for(const s of group){
   assert.ok(serviceInclusions[s[1]]?.length>90,'Alcance eléctrico insuficiente: '+s[1]);
   assert.match(priceFor(s),/€$/);
   assert.ok(s[2]>0);
   assert.ok(!s[3]);
   assert.equal(servicePriceTerms(s),'Material estándar, mano de obra e IVA incluidos');
 }
 assert.match(electricidadPricingNotice,/IVA del 21 %/);
 assert.match(electricidadPricingNotice,/profesional cualificado/);
 assert.match(electricidadPricingNotice,/presupuesto/);
 assert.ok(!group.some(x=>x[1]==='Instalación de lámpara sencilla'));
});

test('V86: 22 tarifas actualizadas de los otros oficios sin afectar precio de reformas ni Manitas',()=>{
 for(const [name,price] of Object.entries(sampleOtherPrices))
  assert.equal(services.find(x=>x[1]===name)?.[2],price,name);
 assert.equal(Object.keys(sampleOtherPrices).length,22);
 assert.equal(services.filter(s=>s[0]==='Reformas integrales').every(s=>s[2]===0),true);
 assert.equal(services.find(x=>x[1]==='Cambio de manilla de puerta')?.[2],69);
 assert.match(manitasPricingNotice,/MATERIAL NO INCLUIDO/);
 assert.equal(servicePriceTerms(services.find(x=>x[1]==='Cambio de manilla de puerta'))
   .includes('material NO incluido'),true);
});

test('V86: cada servicio de electricista tiene fotografía distinta con fuente pública Pexels',()=>{
 const ids=new Set();
 const markup=renderCategory(services,'Electricidad');
 assert.ok(markup.includes('10'));
 assert.ok(markup.includes('catalog-price-policy'));
 assert.ok(markup.includes('materiales estándar'));
 assert.ok(categoryArt('electricity').includes('art-electricity'));
 assert.ok(categoryArt('electricity').includes('svg'));
 assert.ok(!categoryArt('electricity').includes('electricity-transparent.png'));
 for(const s of services.filter(x=>x[0]==='Electricidad')){
   const photo=additionalServicePhoto(s[1]);
   assert.ok(photo,s[1]);
   assert.match(photo.url,/^https:\/\/images\.pexels\.com\/photos\/\d+\/pexels-photo-\d+\.jpeg/);
   assert.match(photo.source,/^https:\/\/www\.pexels\.com\/photo\/\d+\/$/);
   assert.ok(!ids.has(photo.source),'Fotografía duplicada '+s[1]);
   ids.add(photo.source);
   assert.ok(markup.includes(photo.url.replace(/&/g,'&amp;')),s[1]);
   assert.ok(markup.includes('Fotografía ilustrativa de '+s[1]),s[1]);
 }
 assert.equal(ids.size,10);
 assert.ok(markup.includes('onerror="this.remove()"'));
 const credits=readFileSync(new URL('../public/creditos-fotos-servicios.html',import.meta.url),'utf8');
 for(const source of ids)assert.ok(credits.includes(source));
});

test('V86: la ficha de electricidad muestra IVA y fotos; no afirma precios cerrados',()=>{
 const s=services.find(x=>x[1]==='Sustitución de enchufe estándar');
 const form=serviceFormHeader(s);
 assert.ok(form.includes('89,00 €'));
 assert.ok(form.includes('Material estándar, mano de obra e IVA incluidos'));
 assert.ok(form.includes('Sin rozas ni línea nueva'));
 const category=renderCategory(services,'Electricidad');
 assert.match(category,/Electricidad/);
 assert.ok(category.includes('Sin rozas'));
 const manitas=renderCategory(services,'Manitas');
 assert.match(manitas,/MATERIAL NO INCLUIDO/);
});
