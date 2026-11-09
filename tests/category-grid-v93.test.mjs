import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {categoryArt,categories,renderLanding} from '../customer-ui.js';

const six=['plumbing','masonry','parquet','renovation','handyman','electricity'];

test('V93: seis categorías comparten exactamente el mismo dibujo encapsulado',()=>{
 const home=renderLanding([]);
 assert.equal(categories.length,6);
 assert.deepEqual(categories.map(c=>c.slug),six);
 assert.equal((home.match(/class="category-tile theme-/g)||[]).length,6);
 assert.equal((home.match(/class="category-motion"/g)||[]).length,6);
 assert.equal((home.match(/class="category-photo category-restored"/g)||[]).length,6);
 for(const c of categories){
  const art=categoryArt(c.slug);
  const extension=['handyman','electricity'].includes(c.slug)?'svg':'png';
  assert.ok(art.includes('categories/'+c.slug+'-transparent.'+extension),c.slug);
  assert.ok(art.includes('class="category-motion"'),c.slug);
  assert.ok(art.includes('class="category-photo category-restored"'),c.slug);
  assert.ok(art.includes('loading="lazy"'),c.slug);
  assert.ok(art.includes('alt="Ilustración de '+c.title+'"'),c.slug);
 }
});

test('V93: arte nuevo sin rectángulo opaco y PNG aprobados intactos',()=>{
 for(const slug of ['plumbing','masonry','parquet','renovation'])
  assert.ok(existsSync(new URL('../public/categories/'+slug+'-transparent.png',import.meta.url)),slug);
 for(const slug of ['handyman','electricity']){
  const path=new URL('../public/categories/'+slug+'-transparent.svg',import.meta.url);
  assert.ok(existsSync(path),slug);
  const xml=readFileSync(path,'utf8');
  assert.match(xml,/viewBox="0 0 430 260"/);
  assert.ok(xml.includes('<title'),slug+' debe incluir nombre accesible');
  assert.doesNotMatch(xml,/<rect\s+width="430"\s+height="260"/);
  assert.match(xml,/<linearGradient/);
 }
});

test('V93: ninguna categoría es ya una tarjeta horizontal a pantalla completa',()=>{
 const css=readFileSync(new URL('../vivid-theme.css',import.meta.url),'utf8');
 const ownRules=[...css.matchAll(/\.category-tile\.theme-(handyman|electricity)\s*\{([^}]*)\}/g)];
 assert.equal(ownRules.length,2,'Cada nueva categoría debe tener solo una paleta específica');
 assert.ok(ownRules.every(r=>!r[2].includes('grid-column:1/-1')));
 assert.ok(css.includes('grid-column:auto'));
 assert.ok(css.includes('aspect-ratio:220/165'));
 assert.ok(css.includes('.theme-handyman,.theme-electricity'));
 assert.ok(css.includes('prefers-reduced-motion'));
 // Ninguna excepción a tamaño, imagen o flecha debe recolocar el arte en un lateral.
 assert.doesNotMatch(css,/\.category-tile\.theme-(handyman|electricity)\s+\.category-art\s*\{\s*position:absolute/);
});

test('V93: los colores anteriores y sus accesos a servicios siguen presentes',()=>{
 const css=readFileSync(new URL('../vivid-theme.css',import.meta.url),'utf8');
 const home=renderLanding([]);
 for(const color of ['#27c6ff','#ffb168','#4bebaa','#b18afc'])
  assert.ok(css.includes(color),'No alterar paleta original '+color);
 for(const category of categories)
  assert.ok(home.includes('data-category-open="'+category.id+'"'));
});
