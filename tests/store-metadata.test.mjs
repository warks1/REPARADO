import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../catalog-data.js';

const listing=JSON.parse(readFileSync(new URL('../store-metadata/es-ES.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
const guide=readFileSync(new URL('../docs/PUBLICAR-EN-TIENDAS.md',import.meta.url),'utf8');
const sheet=readFileSync(new URL('../docs/FICHA-TIENDAS-es-ES.md',import.meta.url),'utf8');
const apple=listing.platforms.app_store;
const google=listing.platforms.google_play;

test('V39: metadatos listos y dentro de los límites de Apple y Google',()=>{
  assert.equal(listing.locale,'es-ES');
  assert.equal(google.name,'REPARADO');
  assert.equal(apple.name,'REPARADO');
  assert.ok(google.name.length<=30);
  assert.ok(apple.name.length<=30);
  assert.ok(google.short_description.length<=80);
  assert.ok(google.full_description.length>150&&google.full_description.length<=4000);
  assert.ok(apple.subtitle.length<=30);
  assert.ok(apple.promotional_text.length<=170);
  assert.ok(apple.description.length>150&&apple.description.length<=4000);
  assert.ok(Buffer.byteLength(apple.keywords,'utf8')<=100);
  assert.equal(apple.description,google.full_description);
});

test('V39: la ficha refleja las cinco categorías reales del catálogo',()=>{
  const labels=new Set(services.map(row=>row[0]));
  for(const category of ['Fontanería','Albañilería','Parquet','Manitas','Reformas integrales'])
    assert.ok(labels.has(category),'Falta categoría de catálogo '+category);
  for(const word of ['Fontanería','pladur','Parquet','Manitas','Reformas','Cataluña'])
    assert.ok(google.full_description.toLowerCase().includes(word.toLowerCase()),'Falta '+word);
  assert.match(google.full_description,/21 % de IVA incluido/);
  assert.match(google.full_description,/orientativos/);
  assert.match(google.full_description,/no reservas confirmadas/);
});

test('V39: texto informativo sin prometer servicios no disponibles',()=>{
  for(const text of [google.full_description,apple.description,google.short_description,apple.promotional_text]){
    assert.doesNotMatch(text,/24 horas|24\/7|técnicos verificados|pago integrado|garantizado|gratis|n.º 1|mejor app/i);
    assert.doesNotMatch(text,/<[a-z][^>]*>/i);
  }
});

test('V39: documentación lista para cargar manualmente y descripción web coherente',()=>{
  assert.match(guide,/FICHA-TIENDAS-es-ES\.md/);
  assert.match(guide,/store-metadata\/es-ES\.json/);
  assert.match(sheet,/App Store Connect y Play Console/);
  assert.match(sheet,/No se prometen servicios 24 horas/);
  assert.match(sheet,new RegExp(google.short_description.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.ok(manifest.description.includes('manitas'));
  assert.equal(listing.support_email,'reparado_soporte@outlook.es');
});
