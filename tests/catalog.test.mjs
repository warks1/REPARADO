import test from 'node:test';
import assert from 'node:assert/strict';
import {categories,catFor,priceFor,renderLanding,renderCategory,bottomNavigation} from '../customer-ui.js';

const services=[
 ['Fontanería','Reparación de fuga',115],
 ['Albañilería','Tabique de Pladur',58,'m²'],
 ['Parquet','Instalación de parquet/laminado',34,'m²'],
 ['Reformas integrales','Reforma integral de baño',0]
];
test('las cuatro categorías principales son distintas',()=>{
 assert.deepEqual(categories.map(c=>c.id),
  ['Fontanería','Albañilería','Parquet','Reformas integrales']);
});
test('la portada contiene categorías y accesos de navegación',()=>{
 const screen=renderLanding(services);
 for(const c of categories)assert.ok(screen.includes('data-category-open="'+c.id+'"'));
 for(const view of ['home','requests','agenda','chat','profile'])
  assert.ok(bottomNavigation().includes('data-view="'+view+'"'));
});
test('el detalle filtra servicios y presenta los precios sin inventarlos',()=>{
 const html=renderCategory(services,'Fontanería');
 assert.ok(html.includes('Reparación de fuga'));
 assert.ok(!html.includes('Tabique de Pladur'));
 assert.equal(priceFor(services[0]),'115,00 €');
 assert.equal(priceFor(services[1]),'58,00 € / m²');
 assert.equal(priceFor(services[3]),'Por presupuesto');
 assert.equal(catFor('Parquet').slug,'parquet');
});

test('el boceto integrado mantiene los controles interactivos',()=>{
 const home=renderLanding(services);
 assert.ok(home.includes('class="reference-promo"'));
 assert.ok(home.includes('mirror-atlas.webp'));
 assert.ok(home.includes('data-category-open="Fontanería"'));
 const detail=renderCategory(services,'Fontanería');
 assert.ok(detail.includes('class="reference-sprite"'));
 assert.ok(detail.includes('data-service="0"'));
});
