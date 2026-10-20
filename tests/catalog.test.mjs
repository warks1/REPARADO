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

test('el atlas de categorías conserva el nombre accesible sin duplicar recortes',()=>{
 const screen=renderLanding(services);
 for(const slug of ['plumbing','masonry','parquet','renovation'])assert.ok(screen.includes('art-'+slug));
 assert.ok(screen.includes('Ilustración de Fontanería'));
});

test('los cuatro colores brillantes del boceto están disponibles en la app',async()=>{
 const {readFileSync}=await import('node:fs');
 const {fileURLToPath}=await import('node:url');
 const {dirname,join}=await import('node:path');
 const root=join(dirname(fileURLToPath(import.meta.url)),'..');
 const theme=readFileSync(join(root,'vivid-theme.css'),'utf8');
 const entry=readFileSync(join(root,'main.js'),'utf8');
 for(const x of ['theme-plumbing','theme-masonry','theme-parquet','theme-renovation']){
   assert.ok(theme.includes('.category-tile.'+x));
 }
 for(const c of ['#27c6ff','#ffb168','#4bebaa','#b18afc']){
   assert.ok(theme.includes(c),'Se esperaba un color brillante: '+c);
 }
 assert.ok(entry.includes("import './vivid-theme.css'"));
 assert.ok(theme.includes('prefers-reduced-motion'));
});

test('el icono de filtro del buscador permite abrir categorías',()=>{
 const home=renderLanding(services);
 assert.ok(home.includes('data-toggle-filters'));
 assert.ok(home.includes('aria-expanded="false"'));
 assert.ok(home.includes('id="category-quick-filters" hidden'));
 for(const c of categories)assert.ok(home.includes('data-category-open="'+c.id+'"'));
});

test('la autenticación conserva el servicio y la sección elegida',async()=>{
 const {readFileSync}=await import('node:fs');
 const {fileURLToPath}=await import('node:url');
 const {dirname,join}=await import('node:path');
 const root=join(dirname(fileURLToPath(import.meta.url)),'..');
 const code=readFileSync(join(root,'connected.js'),'utf8');
 assert.ok(code.includes('pendingService=service'));
 assert.ok(code.includes('pendingView=view'));
 assert.ok(code.includes('if(selected)requestForm(selected)'));
 assert.ok(code.includes("destination==='agenda'"));
 assert.ok(code.includes("destination==='chat'"));
});

test('el grifo de la cabecera es vectorial y no muestra otras partes del atlas',()=>{
 const detail=renderCategory(services,'Fontanería');
 const hero=detail.match(/<section class="category-hero">([\s\S]*?)<\/section>/)?.[1];
 assert.ok(hero);
 assert.ok(hero.includes('role="img" aria-label="Grifo azul"'));
 assert.ok(!hero.includes('mirror-atlas.webp'));
});
