
// Diseño compartido entre la web, Android (Capacitor) y iOS (Capacitor).
// Son componentes reales de interfaz, no capturas ni imágenes de maqueta.
export const categories = [
  {id:'Fontanería',slug:'plumbing',title:'Fontanería',short:'Fugas, atascos, instalaciones...',description:'Soluciones para el agua de tu hogar.'},
  {id:'Albañilería',slug:'masonry',title:'Albañilería y Pladur',short:'Paredes, tabiques, techos...',description:'Reparaciones, paredes, suelos y pladur.'},
  {id:'Parquet',slug:'parquet',title:'Parquet',short:'Instalación, reparación y restauración...',description:'Cuidado e instalación de suelos de madera.'},
  {id:'Reformas integrales',slug:'renovation',title:'Reformas',short:'Reformas parciales o integrales...',description:'Renovaciones parciales e integrales.'}
];

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
export function catFor(id) {
  return categories.find(c=>c.id===id) || categories[0];
}
export function priceFor(item) {
  return item[2] ? Number(item[2]).toFixed(2).replace('.',',')+' €'+(item[3]?' / '+item[3]:'') : 'Por presupuesto';
}
const p = {
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 requests:'<path d="M7 3h8l4 4v14H5V3z"/><path d="M15 3v5h5M8 12h8M8 16h8"/>',
 agenda:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 chat:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3-.4-4.2-1L3 21l1.8-5A8.5 8.5 0 1 1 21 11.5z"/>',
 profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 search:'<circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/>',
 filter:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="white"/><circle cx="15" cy="12" r="2" fill="white"/><circle cx="10" cy="18" r="2" fill="white"/>',
 arrow:'<path d="m9 18 6-6-6-6"/>',
 back:'<path d="m15 18-6-6 6-6"/>',
 pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9z"/><path d="M10 21h4"/>',
 shield:'<path d="M12 2 4 5v7c0 5 3 8 8 10 5-2 8-5 8-10V5z"/><path d="m8 12 3 3 5-6"/>',
 star:'<path d="m12 2 3.1 6.4 7 1-5 4.9 1.2 7-6.3-3.3-6.3 3.3 1.2-7-5-4.9 7-1z"/>',
 wallet:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M16 12h5M3 9h18"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m3 18 6-6 4 4 3-3 5 5"/>'
};
export function ico(name,extra='') {
  return '<svg class="ui-icon '+extra+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(p[name]||p.star)+'</svg>';
}
const art={
 plumbing:'<svg viewBox="0 0 160 138" role="img" aria-label="Grifo azul"><defs><linearGradient id="tap" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#9ad9ff"/><stop offset=".43" stop-color="#167beb"/><stop offset="1" stop-color="#003aab"/></linearGradient><filter id="sh"><feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#2b75cf" flood-opacity=".29"/></filter></defs><g filter="url(#sh)"><path d="M49 49h52a19 19 0 0 1 19 19v19" fill="none" stroke="#063d94" stroke-width="27" stroke-linecap="round"/><path d="M49 49h52a19 19 0 0 1 19 19v19" fill="none" stroke="url(#tap)" stroke-width="21" stroke-linecap="round"/><rect x="20" y="36" width="41" height="27" rx="9" fill="url(#tap)" stroke="#1857bc" stroke-width="3"/><path d="M72 36V20M52 21h40" stroke="#134ead" stroke-width="12" stroke-linecap="round"/><path d="M72 36V20M52 21h40" stroke="#9bddff" stroke-width="6" stroke-linecap="round"/><rect x="107" y="81" width="28" height="13" rx="6" fill="url(#tap)"/></g><g class="drip"><path d="M120 103c-13 20-9 26 0 26s13-8 0-26z" fill="#36bbff"/></g><circle cx="145" cy="35" r="5" fill="#b4edff"/></svg>',
 masonry:'<svg viewBox="0 0 160 138" role="img" aria-label="Ladrillos y paleta"><defs><linearGradient id="br" x2="0" y2="1"><stop stop-color="#ffb259"/><stop offset="1" stop-color="#f06c26"/></linearGradient><linearGradient id="tr"><stop stop-color="#f7f8fb"/><stop offset="1" stop-color="#98a8bf"/></linearGradient></defs><g class="float-slow" stroke="#d96826" stroke-width="2"><rect x="50" y="72" width="53" height="26" rx="3" fill="url(#br)"/><rect x="106" y="72" width="43" height="26" rx="3" fill="url(#br)"/><rect x="75" y="100" width="55" height="26" rx="3" fill="#ffa453"/><rect x="21" y="100" width="51" height="26" rx="3" fill="#f88534"/><rect x="77" y="43" width="52" height="26" rx="3" fill="#ffa65a"/></g><g transform="rotate(-25 55 60)"><path d="M22 22 52 68 76 33z" fill="url(#tr)" stroke="#576879" stroke-width="3"/><path d="M51 57v37" stroke="#975a2e" stroke-width="13" stroke-linecap="round"/><path d="M51 65v30" stroke="#d59b63" stroke-width="6" stroke-linecap="round"/></g></svg>',
 parquet:'<svg viewBox="0 0 160 138" role="img" aria-label="Suelo de parquet"><defs><linearGradient id="wood" x2="1" y2="1"><stop stop-color="#eab978"/><stop offset="1" stop-color="#9a551b"/></linearGradient></defs><g class="float-slow" transform="translate(4 9) rotate(-13 80 70)"><path d="M7 52 118 25l31 54-111 28z" fill="#99531f" opacity=".35" transform="translate(0 8)"/><path d="M7 52 118 25l31 54-111 28z" fill="url(#wood)" stroke="#95531c" stroke-width="3"/><path d="M30 48 61 101M60 40l31 53M91 33l31 52" stroke="#f8dfa9" stroke-width="3"/><path d="M9 66 125 38M20 84l117-29M39 106l110-27" stroke="#92511d" stroke-width="2"/><path d="M19 56 120 31M45 96l89-22" stroke="#ffe2a4" stroke-width="2" opacity=".7"/></g></svg>',
 renovation:'<svg viewBox="0 0 160 138" role="img" aria-label="Casa de reformas"><defs><linearGradient id="roof" x2="1" y2="1"><stop stop-color="#ffcb91"/><stop offset="1" stop-color="#f46e31"/></linearGradient></defs><g class="float-slow"><path d="M23 63 80 19l58 44v61H23z" fill="#fff1d9" stroke="#b47bcb" stroke-width="3"/><path d="M14 65 80 12l66 53-10 12-56-44-56 44z" fill="url(#roof)" stroke="#e57a35" stroke-width="2"/><rect x="41" y="78" width="28" height="25" rx="4" fill="#67c6e8"/><rect x="88" y="78" width="29" height="46" rx="5" fill="#c68cfa"/><path d="M101 32V18h16v29" stroke="#a269c9" stroke-width="9"/><path d="m73 106 11 11 28-29" stroke="#30b989" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g></svg>'
};

const atlasUrl=(import.meta.env?.BASE_URL || './')+'mirror-atlas.webp';
const atlasRects={
  promo:[0,0,320,111],
  // Solo arte: se recortan los rótulos impresos, el texto queda en HTML.
  plumbing:[0,126,155,62],
  masonry:[164,126,155,62],
  parquet:[0,215,155,57],
  renovation:[164,215,155,57],
  tap:[6,281,128,120],
  leak:[150,280,75,66],
  drain:[235,280,75,66],
  heater:[150,349,75,66],
  faucet:[235,349,75,66]
};
function atlasSprite(name,description=''){
  const rect=atlasRects[name];
  if(!rect)return '';
  const [x,y,w,h]=rect;
  const illustration=['plumbing','masonry','parquet','renovation'].includes(name);
  return '<svg class="reference-sprite" viewBox="'+[x,y,w,h].join(' ')+'" preserveAspectRatio="'+(illustration?'xMidYMid meet':'xMidYMid slice')+'" role="img" aria-label="'+esc(description)+'">'+
    '<image href="'+esc(atlasUrl)+'" x="0" y="0" width="320" height="420"/></svg>';
}

export function categoryArt(slug) {
  return '<div class="category-art art-'+esc(slug)+'">'+atlasSprite(slug,'Ilustración de '+catFor(categories.find(c=>c.slug===slug)?.id).title)+'</div>';
}
export function logo() {
  return '<span class="brand-house" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M7 23 24 8l17 15v16H28V27h-9v12H7z" fill="#ff662a"/><path d="m7 23 17-15 17 15" fill="none" stroke="#ff662a" stroke-width="6" stroke-linecap="round"/></svg></span><span class="brand-word">Reparado</span>';
}
export function appHeader({location='Barcelona',name='',signedIn=false}={}) {
  return '<header class="customer-header"><div class="header-main"><div class="brand">'+logo()+'</div><div class="header-actions"><span class="location-chip">'+ico('pin')+esc(location)+'</span><button class="round-profile" type="button" data-view="profile" aria-label="Mi perfil">'+(signedIn && name?esc(name.trim().slice(0,1).toUpperCase()):ico('profile'))+'</button></div></div></header>';
}
export function bottomNavigation() {
  return '<nav class="customer-nav" aria-label="Navegación principal">'+
   [['home','Inicio'],['requests','Solicitudes'],['agenda','Agenda'],['chat','Chat'],['profile','Perfil']].map(e=>
   '<button type="button" data-view="'+e[0]+'" aria-label="'+e[1]+'" class="'+(e[0]==='home'?'active':'')+'">'+ico(e[0])+'<span>'+e[1]+'</span></button>').join('')+
  '</nav>';
}
export function setActiveNav(app,active) {
  app.querySelectorAll('.customer-nav [data-view]').forEach(b=>{
    const selected=b.dataset.view===active;
    b.classList.toggle('active',selected);
    if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
}
const overview=[
  ['Fontanería','Agua y sanitarios','Fugas, atascos, grifos y cisternas'],
  ['Albañilería','Paredes y pladur','Alicatados, tabiques, techos y suelos'],
  ['Parquet','Suelos de madera','Montaje, reparación, lijado y barnizado'],
  ['Reformas integrales','Proyectos y reformas','Baños, cocinas y reformas completas']
];
export function renderLanding(services,{notice=''}={}) {
  return '<div class="customer-page">'+
    '<section class="intro"><h1>Tu hogar<br>en buenas manos</h1><p>Profesionales para cualquier<br>reparación o reforma.</p></section>'+
    '<div class="search-pill">'+ico('search')+'<input type="search" id="category-search" aria-label="Buscar reparaciones" placeholder="¿Qué necesitas reparar?" autocomplete="off"><button type="button" class="search-filter-button" data-toggle-filters aria-controls="category-quick-filters" aria-expanded="false" aria-label="Filtrar por categorías">'+ico('filter')+'</button></div>'+
    '<div class="category-quick-filters" id="category-quick-filters" hidden aria-label="Elegir categoría">'+categories.map(c=>'<button type="button" class="category-filter-chip" data-category-open="'+esc(c.id)+'">'+esc(c.title)+'</button>').join('')+'</div>'+
    '<section class="promo-banner"><div class="reference-promo" aria-hidden="true">'+atlasSprite('promo')+'</div><div class="promo-copy"><h2>Pequeñas<br>reparaciones,<br>grandes cambios</h2><p>Hogares más cómodos,<br>seguros y con vida.</p></div><button type="button" class="promo-cta" data-category-open="Reformas integrales" aria-label="Explorar reformas">'+ico('arrow')+'</button></section>'+
    '<div class="section-heading"><h2>Categorías de servicios</h2><button class="text-action" data-show-all type="button">Ver todos '+ico('arrow')+'</button></div>'+
    '<section class="category-grid">'+categories.map(c=>
      '<button type="button" class="category-tile theme-'+c.slug+'" data-category-open="'+esc(c.id)+'">'+
      categoryArt(c.slug)+'<strong>'+esc(c.title)+'</strong><span>'+esc(c.short)+'</span><span class="tile-arrow">'+ico('arrow')+'</span></button>'
    ).join('')+'</section>'+
    '<div class="section-heading service-heading"><h2>Servicios destacados</h2></div>'+
    '<div class="popular-list">'+[0,2,3,7].map(i=>serviceRow(services[i],i)).join('')+'</div>'+
    (notice?'<p class="subtle-notice">'+esc(notice)+'</p>':'')+
    '<div class="no-results" hidden>No hemos encontrado ese servicio. Puedes consultar todas las categorías.</div>'+
   '</div>';
}
const serviceDescriptions={
 'Reparación de fuga':'Localización y reparación de fugas de agua.',
 'Desatasco de lavabo o fregadero':'Limpieza de tuberías, fregaderos y desagües.',
 'Instalación de termo eléctrico':'Instalación y sustitución de termos eléctricos.',
 'Sustitución de grifo':'Montaje o sustitución de grifería.',
 'Cambio de sifón':'Revisión y sustitución de sifones.',
 'Mecanismo de cisterna':'Reparación de mecanismos y cisternas.'
};
const featuredServiceIndices={
 'Fontanería':[2,0,6,3],
 'Albañilería':[12,9,10,11],
 'Parquet':[16,21,17,18],
 'Reformas integrales':[22,23,24]
};
const catExamples={
 plumbing:['Fontanería','Fugas, grifería y sanitarios'],
 masonry:['Albañilería y Pladur','Paredes y techos'],
 parquet:['Parquet','Instalación y mantenimiento'],
 renovation:['Reformas','Baños, cocinas y viviendas']
};
export function serviceRow(s,i) {
  if(!s)return '';
  const cat=catFor(s[0]);
  const symbol=(/grifo/i.test(s[1])?'🚰':/fuga/i.test(s[1])?'💧':/desatasco|sifón/i.test(s[1])?'🛁':/cisterna/i.test(s[1])?'🚽':/pladur/i.test(s[1])?'🧱':/alicatado/i.test(s[1])?'▦':/parquet|tabla|barniz/i.test(s[1])?'🪵':cat.slug==='renovation'?'🏡':'🛠️');
  const photo=cat.slug==='plumbing'?(/fuga/i.test(s[1])?'leak':/desatasco/i.test(s[1])?'drain':/termo/i.test(s[1])?'heater':/grifo/i.test(s[1])?'faucet':null):null;
  return '<button type="button" class="catalog-service" data-service="'+i+'"><span class="service-thumb thumb-'+cat.slug+'">'+(photo?atlasSprite(photo,'Foto de '+s[1]):symbol)+'</span>'+
   '<span class="service-details"><strong>'+esc(s[1])+'</strong><small>'+esc(serviceDescriptions[s[1]]||cat.description)+'</small><em>'+(s[2]?'Desde '+esc(priceFor(s)):'Por presupuesto')+'</em></span><span class="service-chevron">'+ico('arrow')+'</span></button>';
}
export function renderCategory(services,id) {
  const c=catFor(id);
  const relevant=services.map((s,i)=>({s,i})).filter(x=>x.s[0]===c.id);
  return '<div class="customer-page category-view theme-'+c.slug+'">'+
     '<button class="screen-back" type="button" data-back>'+ico('back')+' Volver</button>'+
     '<section class="category-hero"><div class="category-hero-copy"><h1>'+esc(c.title)+'</h1><p>'+esc(c.description)+'</p></div>'+categoryArt(c.slug)+'</section>'+
     '<div class="trust-badges"><span>'+ico('shield')+' Solicitud segura</span><span>'+ico('star')+' Atención personalizada</span><span>'+ico('wallet')+' Precios orientativos</span></div>'+
     '<div class="section-heading"><h2>Servicios más solicitados</h2></div>'+
     '<div class="category-services">'+relevant.sort((a,b)=>{const ranks=featuredServiceIndices[c.id]||[];const aa=ranks.indexOf(a.i),bb=ranks.indexOf(b.i);return (aa<0?99:aa)-(bb<0?99:bb)}).map(x=>serviceRow(x.s,x.i)).join('')+'</div>'+
     '<div class="custom-request"><div><h3>¿No encuentras lo que necesitas?</h3><p>Cuéntanos tu caso y te ayudamos.</p></div>'+
     '<button type="button" class="primary-cta" data-custom-request="'+esc(c.id)+'">Solicitar servicio '+ico('arrow')+'</button></div>'+
     '</div>';
}
export function serviceFormHeader(s) {
  const c=catFor(s[0]);
  return '<div class="form-service-summary"><span class="summary-art">'+categoryArt(c.slug)+'</span><span><small>'+esc(c.title)+'</small><strong>'+esc(s[1])+'</strong><em>'+esc(priceFor(s))+' · '+(s[2]?'IVA incluido':'Sujeto a presupuesto')+'</em></span></div>';
}
export function formPeriodPicker() {
  return '<fieldset class="time-picker"><legend>Horario preferido</legend><label><input type="radio" name="preferred_period" value="Mañana (9:00–13:00)" checked><span>Mañana<small>9:00 – 13:00</small></span></label>'+
    '<label><input type="radio" name="preferred_period" value="Tarde (13:00–17:00)"><span>Tarde<small>13:00 – 17:00</small></span></label>'+
    '<label><input type="radio" name="preferred_period" value="Indiferente"><span>Indiferente</span></label></fieldset>';
}
