import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validModerationDecision,moderationRowsMarkup} from '../review-moderation.js';

test('las decisiones válidas son aprobar o rechazar, no otros estados',()=>{
  assert.equal(validModerationDecision('approved'),true);
  assert.equal(validModerationDecision('rejected'),true);
  assert.equal(validModerationDecision('pending'),false);
  assert.equal(validModerationDecision('deleted'),false);
  assert.equal(validModerationDecision(null),false);
});
test('el panel solo muestra reseñas pendientes y nunca ejemplos ficticios',()=>{
  const rows=[
    {id:'r1',rating:3,comment:'Mejorable pero correcto',status:'pending',created_at:'2026-10-22T13:00:00Z'},
    {id:'r2',rating:5,comment:'No pendiente ni editable',status:'approved'},
    {id:'r3',rating:5,comment:'Malformada',status:'pending',created_at:'2026-10-22T13:00:00Z'}
  ];
  const text=moderationRowsMarkup(rows);
  assert.ok(text.includes('data-review-id="r1"'));
  assert.ok(!text.includes('No pendiente ni editable'));
  assert.ok(text.includes('Aprobar y publicar'));
  assert.ok(text.includes('Rechazar'));
  assert.ok(!text.includes('Ejemplo ficticio'));
  assert.ok(moderationRowsMarkup([]).includes('No hay reseñas pendientes'));
});
test('los comentarios y los IDs se escapan para impedir HTML inyectado',()=>{
  const html=moderationRowsMarkup([{
    id:'<img src=x onerror=alert(1)>',rating:5,status:'pending',
    comment:'Servicio <script>alert(1)</script>',created_at:'2026-10-22T13:00:00Z'
  }]);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
});
test('solo el rol admin puede abrir moderación desde el cliente conectado',()=>{
  const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.ok(code.includes("if(!session || profile?.role!=='admin')"));
  assert.ok(code.includes('mountReviewModeration({'));
  assert.ok(code.includes("profile?.role==='admin'"));
  assert.ok(code.includes('data-view="review-moderation"'));
  const module=readFileSync(new URL('../review-moderation.js',import.meta.url),'utf8');
  assert.ok(module.includes(".eq('status','pending')"));
  assert.ok(module.includes(".update({status})"));
  assert.ok(module.includes(".select('id,status')"));
  assert.ok(module.includes('if(!data||data.length!==1)'));
});
test('RLS V15 autoriza moderación solo administradores y status, no otros campos',()=>{
  const sql=readFileSync(new URL('../supabase/migration-v15.sql',import.meta.url),'utf8');
  assert.ok(sql.includes('grant update (status)'));
  assert.ok(sql.includes('to authenticated'));
  assert.ok(sql.includes('using ((select public.is_reparado_admin())'));
  assert.ok(sql.includes("and status='pending'"));
  assert.ok(sql.includes("status in ('approved','rejected')"));
  assert.ok(!sql.includes('grant update (comment'));
  assert.ok(!sql.includes('service_role'));
});
