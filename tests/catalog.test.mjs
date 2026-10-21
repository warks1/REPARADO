import test from 'node:test';
import assert from 'node:assert/strict';
import {categories,catFor,priceFor,renderLanding,renderCategory,bottomNavigation,matchServices} from '../customer-ui.js';

const services=[
 ['Fontanería','Reparación de fuga',115],
 ['Albañilería','Tabique de Pladur',58,'m²'],
 ['Parquet','Instalación de parquet/laminado',34,'m²'],
 ['Reformas integrales','Reforma integral de baño',0]
];
test('las cinco categorías principales son distintas',()=>{
 assert.deepEqual(categories.map(c=>c.id),
  ['Fontanería','Albañilería','Parquet','Reformas integrales','Manitas']);
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
 assert.ok(detail.includes('class="service-photo"'));
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
 assert.ok(hero.includes('hero-plumbing.webp'));
 assert.ok(hero.includes('class="hero-illustration"'));
 assert.ok(!hero.includes('mirror-atlas.webp'));
});

test('la vista de Fontanería presenta cuatro servicios y conserva el catálogo completo',()=>{
 const many=[
 ['Fontanería','Reparación de fuga',115],
 ['Fontanería','Desatasco de lavabo o fregadero',89],
 ['Fontanería','Instalación de termo eléctrico',0],
 ['Fontanería','Sustitución de grifo',105],
 ['Fontanería','Cambio de sifón',79],
 ['Fontanería','Mecanismo de cisterna',119]
 ];
 const html=renderCategory(many,'Fontanería');
 assert.ok(html.includes('data-expand-services'));
 assert.ok(html.includes('Ver todos los servicios (6)'));
 assert.equal((html.match(/class="catalog-service service-extra" hidden/g)||[]).length,2);
 assert.ok(html.includes('Reparación de fugas'));
 assert.ok(html.includes('Desatascos'));
 assert.ok(html.includes('Instalación de termos'));
 assert.ok(html.includes('Instalación de grifería'));
 assert.ok(html.includes('data-service="5"'));
});

test('las cuatro categorías recuperan las imágenes 3D originales con fondo transparente',()=>{
 const html=renderLanding(services);
 for(const slug of ['plumbing','masonry','parquet','renovation']){
   const card=html.match(new RegExp('<button[^>]*theme-'+slug+'[\\s\\S]*?<\\/button>'))?.[0];
   assert.ok(card,'Falta la tarjeta '+slug);
   assert.ok(card.includes('categories/'+slug+'-transparent.png'),slug);
   assert.ok(card.includes('class="category-photo category-restored"'),slug);
   assert.ok(card.includes('class="category-motion"'),slug);
 }
 assert.ok(html.includes('categories/handyman.svg'));
 assert.equal((html.match(/class="category-photo category-restored"/g)||[]).length,4);
});
test('los PNG restaurados existen y mantienen animación independiente de Manitas',async()=>{
 const {existsSync,readFileSync}=await import('node:fs');
 for(const slug of ['plumbing','masonry','parquet','renovation']){
   assert.ok(existsSync(new URL('../public/categories/'+slug+'-transparent.png',import.meta.url)),slug);
 }
 const css=readFileSync(new URL('../vivid-theme.css',import.meta.url),'utf8');
 const base=readFileSync(new URL('../customer-theme.css',import.meta.url),'utf8');
 assert.ok(base.includes('@keyframes illustration-bob'));
 assert.ok(base.includes('translateY(-6px)'));
 assert.ok(css.includes('animation:illustration-bob 3.6s ease-in-out infinite'));
 assert.ok(!css.includes('reparado-category-float'));
 assert.ok(css.includes('img.category-restored'));
 assert.ok(css.includes('transparent 0%,#000 11%'));
});

test('las fotografías destacadas son independientes del atlas',()=>{
 const plumbing=[
 ['Fontanería','Reparación de fuga',115],
 ['Fontanería','Desatasco de lavabo o fregadero',89],
 ['Fontanería','Instalación de termo eléctrico',0],
 ['Fontanería','Sustitución de grifo',105]
 ];
 const html=renderCategory(plumbing,'Fontanería');
 for(const filename of ['leak','drain','heater','faucet']){
   assert.ok(html.includes('services/'+filename+'.webp'));
 }
 assert.equal((html.match(/class="service-photo"/g)||[]).length,4);
});

test('el buscador encuentra cualquier servicio, también los no destacados',async()=>{
 const {matchServices}=await import('../customer-ui.js');
 const items=[['Fontanería','Reparación de fuga',115],['Fontanería','Mecanismo de cisterna',119],['Parquet','Reparación de tablas',110]];
 assert.deepEqual(matchServices(items,'cisterna').map(x=>x.i),[1]);
 assert.deepEqual(matchServices(items,'parquet').map(x=>x.i),[2]);
 assert.equal(matchServices(items,'ninguno').length,0);
 assert.equal(matchServices(items,'').length,3);
});

test('el detalle tiene un grifo 3D y un botón Volver accesible',()=>{
 const html=renderCategory(services,'Fontanería');
 assert.ok(html.includes('hero-plumbing.webp'));
 assert.ok(html.includes('aria-label="Volver"'));
 assert.ok(html.includes('data-back aria-label'));
});

test('el arranque muestra recuperación si falla JavaScript en producción',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
 assert.ok(html.includes('window.__reparadoBoot'));
 assert.ok(html.includes('No hemos podido abrir Reparado'));
 assert.ok(main.includes('window.__reparadoBoot?.ready()'));
});

test('el botón de recuperación evita la caché antigua de Pages',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('reparado_reload'));
 assert.ok(html.includes('Diagnóstico:'));
 assert.ok(html.includes('Actualizar y volver a intentar'));
});

test('el navegador puede iniciar el cliente sin empaquetador al servir GitHub Pages desde el repositorio',async()=>{
 const {readFileSync}=await import('node:fs');
 const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const browser=readFileSync(new URL('../browser-main.js',import.meta.url),'utf8');
 const {services}=await import('../catalog-data.js');
 assert.ok(services.length>=25);
 assert.ok(main.includes("import { services } from './catalog-data.js'"));
 assert.ok(index.includes("import('./main.js').catch(async error"));
 assert.ok(index.includes("import('./browser-main.js')"));
 assert.ok(browser.includes("mountLocal({app:root,services})"));
 assert.ok(browser.includes("window.__reparadoBoot?.ready()"));
});

test('la ruta alternativa publica los recursos del directorio public',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('../customer-ui.js',import.meta.url),'utf8');
 const loader=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(code.includes("globalThis.__reparadoRawPages ? './public/'"));
 assert.ok(loader.includes("window.__reparadoRawPages = true"));
});

test('Manitas presenta doce trabajos y precios orientativos con IVA',async()=>{
 const {services:catalog}=await import('../catalog-data.js');
 const manitas=catalog.filter(s=>s[0]==='Manitas');
 assert.equal(manitas.length,12);
 assert.ok(manitas.every(s=>Number.isFinite(s[2])&&s[2]>0));
 const html=renderCategory(catalog,'Manitas');
 assert.ok(html.includes('Montaje de mueble en kit (mediano)'));
 assert.ok(html.includes('Instalación de soporte de TV en pared'));
 assert.ok(html.includes('Herramientas de manitas'));
 assert.ok(html.includes('data-expand-services'));
});
test('los destacados cubren varias categorías y no solo Fontanería',async()=>{
 const {services:catalog}=await import('../catalog-data.js');
 const {featuredServices}=await import('../customer-ui.js');
 const selected=featuredServices(catalog);
 assert.deepEqual(selected.map(({s})=>s[0]),categories.map(c=>c.id));
 const html=renderLanding(catalog);
 for(const {i} of selected) assert.ok(html.includes('data-service="'+i+'"'));
 assert.equal((html.match(/class="catalog-service"/g)||[]).length,categories.length);
});
test('la categoría Manitas tiene dibujo propio y diseño adaptable',async()=>{
 const {readFileSync,existsSync}=await import('node:fs');
 const url=new URL('../public/categories/handyman.svg',import.meta.url);
 assert.ok(existsSync(url));
 assert.ok(readFileSync(url,'utf8').includes('<svg'));
 const css=readFileSync(new URL('../vivid-theme.css',import.meta.url),'utf8');
 assert.ok(css.includes('.category-tile.theme-handyman'));
 assert.ok(css.includes('.category-view.theme-handyman'));
});

test('el catálogo admite búsquedas sin tildes y varias palabras no consecutivas',async()=>{
 const {services:full}=await import('../catalog-data.js');
 const names=term=>matchServices(full,term).map(({s})=>s[1]);
 assert.deepEqual(names('ALBANILERIA').length,full.filter(s=>s[0]==='Albañilería').length);
 assert.ok(names('fontaneria FUGA').includes('Reparación de fuga'));
 assert.ok(names('montaje mueble').includes('Montaje de mueble en kit (mediano)'));
 assert.ok(names('lámpara').includes('Instalación de lámpara sencilla'));
 assert.ok(names('lampara').includes('Instalación de lámpara sencilla'));
 assert.ok(names('CINTA   PERSIANA').includes('Cambio de cinta de persiana'));
 assert.equal(names('servicio-no-existente').length,0);
 assert.equal(names('  ').length,full.length);
});
test('el botón Ver todos comparte una acción funcional entre clientes locales y conectados',async()=>{
 const {readFileSync}=await import('node:fs');
 const ui=readFileSync(new URL('../customer-ui.js',import.meta.url),'utf8');
 const local=readFileSync(new URL('../local-preview.js',import.meta.url),'utf8');
 const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(ui.includes("search.dispatchEvent(new Event('input'"));
 assert.ok(local.includes("showAllCategories(main)"));
 assert.ok(connected.includes("showAllCategories(main)"));
});

test('los doce trabajos de Manitas muestran su propia fotografía y créditos',async()=>{
 const {services:catalog}=await import('../catalog-data.js');
 const {serviceRow}=await import('../customer-ui.js');
 const {statSync,existsSync}=await import('node:fs');
 const manitas=catalog.map((s,i)=>({s,i})).filter(x=>x.s[0]==='Manitas');
 const assets=new Set();
 for(const {s,i} of manitas){
   const html=serviceRow(s,i);
   const found=html.match(/services\/(handyman-[a-z-]+[.]webp)/);
   assert.ok(found,'Falta foto propia de '+s[1]);
   assert.ok(html.includes('Fotografía ilustrativa de '+s[1]));
   assets.add(found[1]);
   const url=new URL('../public/services/'+found[1],import.meta.url);
   assert.ok(existsSync(url),'No existe '+found[1]);
   assert.ok(statSync(url).size>1000,'Imagen demasiado pequeña '+found[1]);
 }
 assert.equal(assets.size,12);
 const page=renderCategory(catalog,'Manitas');
 assert.ok(page.includes('creditos-fotos-manitas.html'));
 assert.ok(existsSync(new URL('../public/creditos-fotos-manitas.html',import.meta.url)));
});
