import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../catalog-data.js';
import {renderLanding,serviceRow} from '../customer-ui.js';
import {missingServicePhotoNames,additionalServicePhoto} from '../service-photos.js';
import {validateReview,renderReviewsSection,combineReviews,verifiedReviewSummary,reviewFeedMarkup} from '../reviews.js';

test('cada uno de los 37 servicios incorpora fotografía, incluida toda categoría',()=>{
  assert.equal(services.length,37);
  assert.equal(missingServicePhotoNames.length,21);
  assert.equal(new Set(missingServicePhotoNames).size,21);
  for(const [i,s] of services.entries()){
    const html=serviceRow(s,i);
    assert.ok(html.includes('class="service-photo"'),'No tiene foto: '+s[1]);
    assert.ok(html.includes('Fotografía ilustrativa de '+s[1]));
    assert.ok(html.includes('service-photo-fallback'),'Falta respaldo offline: '+s[1]);
  }
});
test('las 21 nuevas fotografías tienen origen y crédito identificados',()=>{
 const credits=readFileSync(new URL('../public/creditos-fotos-servicios.html',import.meta.url),'utf8');
 for(const service of missingServicePhotoNames){
  const photo=additionalServicePhoto(service);
  assert.ok(photo?.url.startsWith('https://images.pexels.com/photos/'));
  assert.ok(photo?.source.startsWith('https://www.pexels.com/photo/'));
  assert.ok(credits.includes(photo.source));
 }
});
test('la sección de reseñas está vacía cuando no hay opiniones reales aprobadas',()=>{
 const html=renderReviewsSection();
 assert.ok(html.includes('Todavía no hay valoraciones reales publicadas.'));
 assert.ok(html.includes('id="reparado-review-form"'));
 assert.ok(html.includes('data-review-feed'));
 assert.ok(!html.includes('data-review-filter'));
 assert.ok(!html.includes('review-demo'));
 assert.ok(!html.includes('Ejemplo ficticio'));
 assert.ok(!html.includes('demo-1'));
 assert.ok(renderLanding(services).includes('reparado-reviews'));
})

test('el formulario permite de 1 a 5 estrellas y restringe longitud del comentario',()=>{
 assert.equal(validateReview({rating:1,comment:'Un servicio bien hecho'}),true);
 assert.equal(validateReview({rating:5,comment:'Muy buen trabajo realizado'}),true);
 assert.equal(validateReview({rating:0,comment:'Muy buen trabajo realizado'}),false);
 assert.equal(validateReview({rating:6,comment:'Muy buen trabajo realizado'}),false);
 assert.equal(validateReview({rating:5,comment:'corto'}),false);
 assert.equal(validateReview({rating:5,comment:'A'.repeat(1001)}),false);
});
test('en modo conectado solo se valoran trabajos finalizados; modo local no finge publicación',()=>{
 const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 const local=readFileSync(new URL('../local-preview.js',import.meta.url),'utf8');
 const reviews=readFileSync(new URL('../reviews.js',import.meta.url),'utf8');
 const sql=readFileSync(new URL('../supabase/migration-v13.sql',import.meta.url),'utf8');
 assert.ok(connected.includes('mountReviews(main,{supabase,session,selectedRequestId:selectedReviewRequestId})'));
 assert.ok(local.includes('mountReviews(main)'));
 assert.ok(reviews.includes(".eq('status','completed')"));
 assert.ok(reviews.includes(".eq('status','approved')"));
 assert.ok(reviews.includes("feedback.textContent='Valoración recibida."));
 assert.ok(reviews.includes('La valoración no se ha enviado a REPARADO.'));
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes("status='pending'"));
 assert.ok(sql.includes("sr.status='completed'"));
 assert.ok(sql.includes('revoke all on public.customer_reviews'));
 assert.ok(!sql.includes('insert into public.customer_reviews'));
});

test('solo aparecen reseñas aprobadas, sin falsificaciones, ordenadas y sin duplicados',()=>{
 const rows=[
  {id:'pending',status:'pending',rating:5,comment:'No debe salir una valoración pendiente',created_at:'2026-10-22T14:00:00Z'},
  {id:'old',status:'approved',rating:2,comment:'Servicio correcto, pero mejorable',created_at:'2026-10-20T12:00:00Z'},
  {id:'new',status:'approved',rating:4,comment:'Buen resultado y puntualidad',created_at:'2026-10-22T12:00:00Z'},
  {id:'old',status:'approved',rating:2,comment:'No debe repetirse el comentario',created_at:'2026-10-20T12:00:00Z'},
  {id:'rejected',status:'rejected',rating:1,comment:'No debe aparecer un rechazo',created_at:'2026-10-19T12:00:00Z'}
 ];
 const approved=combineReviews(rows);
 assert.equal(approved.length,2);
 assert.deepEqual(approved.map(r=>r.id),['new','old']);
 assert.ok(approved.every(r=>!r.fictional));
 assert.deepEqual(verifiedReviewSummary(rows),{count:2,average:3});
 const feed=reviewFeedMarkup(rows);
 assert.equal(feed.count,2);
 assert.ok(feed.html.indexOf('Buen resultado y puntualidad')<feed.html.indexOf('Servicio correcto'));
 assert.ok(feed.html.includes('review-real'));
 assert.ok(feed.html.includes('Valoración real'));
 assert.ok(!feed.html.includes('review-demo'));
 assert.ok(!feed.html.includes('No debe salir'));
 assert.ok(!feed.html.includes('No debe repetirse'));
 assert.ok(!feed.html.includes('No debe aparecer un rechazo'));
});
test('no hay estrellas, puntuación ni reseñas inventadas en una lista vacía',()=>{
 assert.deepEqual(verifiedReviewSummary([]),{count:0,average:null});
 const empty=reviewFeedMarkup([]);
 assert.equal(empty.count,0);
 assert.ok(empty.html.includes('Todavía no hay valoraciones reales publicadas.'));
 assert.ok(!empty.html.includes('review-card'));
 assert.ok(!empty.html.includes('★'));
 const input=[{id:'x',status:'approved',rating:1,comment:'El trabajo se puede mejorar',created_at:'2026-10-22T12:00:00Z'}];
 assert.deepEqual(verifiedReviewSummary(input),{count:1,average:1});
});
test('escapar HTML y rechazar puntuaciones malformadas',()=>{
 const input=[
  {id:'safe',status:'approved',rating:5,comment:'Resultado <script>alert(1)</script> excelente',created_at:'2026-10-22T12:00:00Z'},
  {id:'bad',status:'approved',rating:99,comment:'Intento de valoración malformada',created_at:'2026-10-22T12:00:00Z'}
 ];
 const shown=reviewFeedMarkup(input,true);
 assert.equal(shown.count,1);
 assert.ok(shown.html.includes('&lt;script&gt;'));
 assert.ok(!shown.html.includes('<script>'));
 assert.equal(verifiedReviewSummary(input).average,5);
})

test('V17: solo las solicitudes completadas tienen botón de valoración y se preselecciona',()=>{
 const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 const reviews=readFileSync(new URL('../reviews.js',import.meta.url),'utf8');
 assert.ok(connected.includes('r.status==="completed"?`<div class="flex-actions"><button'));
 assert.ok(connected.includes('data-rate-request="${esc(r.id)}"'));
 assert.ok(connected.includes("row.id===requestId && row.status==='completed'"));
 assert.ok(connected.includes('renderHome(requestId)'));
 assert.ok(connected.includes('selectedRequestId:selectedReviewRequestId'));
 assert.ok(reviews.includes(".select('id,service_name').eq('customer_id',session.user.id).eq('status','completed')"));
 assert.ok(reviews.includes('const requested=data.find(row=>row.id===selectedRequestId)'));
 assert.ok(reviews.includes('form.elements.request_id.value=requested.id'));
 assert.ok(reviews.includes('escapeText(row.service_name'));
});
