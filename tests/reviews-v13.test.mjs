import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../catalog-data.js';
import {renderLanding,serviceRow} from '../customer-ui.js';
import {missingServicePhotoNames,additionalServicePhoto} from '../service-photos.js';
import {demoReviews,validateReview,renderReviewsSection,combineReviews,verifiedReviewSummary,reviewFeedMarkup} from '../reviews.js';

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
test('32 opiniones ilustrativas ficticias, cinco estrellas y textos distintos, nunca testimonios reales',()=>{
 assert.equal(demoReviews.length,32);
 assert.ok(demoReviews.every(r=>r.rating===5 && r.fictional===true && r.comment.length>12));
 assert.equal(new Set(demoReviews.map(r=>r.comment)).size,32);
 const html=renderReviewsSection();
 assert.equal((html.match(/class="review-card review-demo"/g)||[]).length,32);
 assert.ok(html.includes('las 32 opiniones siguientes son ficticias'));
 assert.ok(html.includes('No son testimonios reales'));
 assert.ok(html.includes('id="reparado-review-form"'));
 assert.ok(html.includes('data-review-filter="all"'));
 assert.ok(html.includes('data-review-filter="real"'));
 assert.ok(html.includes('data-review-filter="examples"'));
 assert.ok(html.includes('data-review-feed'));
 assert.ok(renderLanding(services).includes('reparado-reviews'));
});
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
 assert.ok(connected.includes('mountReviews(main,{supabase,session})'));
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

test('lista unificada: primero opiniones reales aprobadas y después 32 ejemplos diferenciados',()=>{
 const input=[
  {id:'pend',status:'pending',rating:5,comment:'Nunca debe aparecer esta valoración',created_at:'2026-10-22T12:00:00Z'},
  {id:'old',status:'approved',rating:2,comment:'Servicio correcto, pero mejorable',created_at:'2026-10-20T12:00:00Z'},
  {id:'new',status:'approved',rating:4,comment:'Buen resultado y puntualidad',created_at:'2026-10-22T12:00:00Z'},
  {id:'old',status:'approved',rating:2,comment:'Duplicado que no debe verse',created_at:'2026-10-20T12:00:00Z'}
 ];
 const rows=combineReviews(input);
 assert.equal(rows.length,34);
 assert.equal(rows[0].id,'new');
 assert.equal(rows[1].id,'old');
 assert.equal(rows[2].id,'demo-1');
 assert.equal(rows.filter(r=>r.fictional).length,32);
 assert.equal(rows.some(r=>r.id==='pend'),false);
 assert.equal(rows.some(r=>r.comment.startsWith('Duplicado')),false);
 assert.deepEqual(verifiedReviewSummary(input),{count:2,average:3});
 const all=reviewFeedMarkup(input);
 assert.equal(all.count,34);
 assert.ok(all.html.indexOf('Buen resultado y puntualidad')<all.html.indexOf('El grifo dejó de gotear'));
 assert.ok(all.html.includes('Valoración real · servicio completado'));
 assert.ok(all.html.includes('Ejemplo ficticio'));
 assert.ok(!all.html.includes('Nunca debe aparecer'));
 assert.equal(reviewFeedMarkup(input,'real').count,2);
 assert.equal(reviewFeedMarkup(input,'examples').count,32);
 assert.ok(reviewFeedMarkup(input,'real').html.includes('review-real'));
 assert.ok(!reviewFeedMarkup(input,'real').html.includes('review-demo'));
 assert.ok(!reviewFeedMarkup(input,'examples').html.includes('review-real'));
});
test('las 32 opiniones ficticias no elevan la nota pública y el filtro real vacío informa',()=>{
 assert.deepEqual(verifiedReviewSummary([]),{count:0,average:null});
 assert.equal(reviewFeedMarkup([],'all').count,32);
 assert.equal(reviewFeedMarkup([],'real').count,0);
 assert.ok(reviewFeedMarkup([],'real').html.includes('Todavía no hay valoraciones reales aprobadas'));
 const input=[{id:'x',status:'approved',rating:1,comment:'El trabajo se puede mejorar',created_at:'2026-10-22T12:00:00Z'}];
 assert.deepEqual(verifiedReviewSummary(input),{count:1,average:1});
});
test('se escapan comentarios de clientes y se descartan puntuaciones fraudulentas',()=>{
 const input=[
  {id:'safe',status:'approved',rating:5,comment:'Resultado <script>alert(1)</script> excelente',created_at:'2026-10-22T12:00:00Z'},
  {id:'bad',status:'approved',rating:99,comment:'Intento de valoración malformada',created_at:'2026-10-22T12:00:00Z'}
 ];
 const shown=reviewFeedMarkup(input,'real',true);
 assert.equal(shown.count,1);
 assert.ok(shown.html.includes('&lt;script&gt;'));
 assert.ok(!shown.html.includes('<script>'));
 assert.equal(verifiedReviewSummary(input).average,5);
});
