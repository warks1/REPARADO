import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REPARADO_SUPPORT_EMAIL,REPARADO_REQUESTS_EMAIL,reportIssueHref,repairInquiryHref,mailto,contactLinksMarkup} from '../contact-emails.js';

test('correo de soporte para fallos, separado del correo de reparaciones',()=>{
 assert.equal(REPARADO_SUPPORT_EMAIL,'reparado_soporte@outlook.es');
 assert.equal(REPARADO_REQUESTS_EMAIL,'reparado_clientes@outlook.es');
 assert.ok(reportIssueHref().startsWith('mailto:reparado_soporte@outlook.es?'));
 assert.ok(repairInquiryHref().startsWith('mailto:reparado_clientes@outlook.es?'));
 assert.ok(decodeURIComponent(reportIssueHref()).includes('Incidencia o fallo'));
 assert.ok(decodeURIComponent(repairInquiryHref()).includes('Consulta o solicitud'));
});

test('enlaces mailto codifican correctamente caracteres especiales, no envían secretos',()=>{
 const link=mailto(REPARADO_SUPPORT_EMAIL,'Error & captura','Primer fallo\nSegundo detalle');
 assert.ok(link.includes('subject=Error%20%26%20captura'));
 assert.ok(link.includes('Primer%20fallo%0ASegundo%20detalle'));
 assert.ok(!reportIssueHref().includes('password='));
 const html=contactLinksMarkup();
 assert.ok(html.includes('Comunicar un fallo de la app'));
 assert.ok(html.includes('Consultas y solicitudes de reparación'));
 assert.ok(!html.includes('onclick='));
});

test('los botones de soporte funcionan en modo local y conectado',()=>{
 const local=readFileSync(new URL('../local-preview.js',import.meta.url),'utf8');
 const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(local.includes('contactLinksMarkup()'));
 assert.ok(connected.includes('contactLinksMarkup()'));
 assert.ok(connected.includes('Atención y ayuda'));
 assert.ok(local.includes("+'<p data-feedback role=")||local.includes("+'</footer></div>'"));
});

test('nuevas solicitudes generan cola privada sin enviar datos a usuarios ajenos',()=>{
 const sql=readFileSync(new URL('../supabase/migration-request-email-outbox.sql',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../supabase/functions/reparado-mail-worker/index.ts',import.meta.url),'utf8');
 assert.ok(sql.includes('after insert on public.service_requests'));
 assert.ok(sql.includes('request_id uuid not null unique'));
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('revoke all on table public.request_email_outbox'));
 assert.ok(sql.includes('for update skip locked'));
 assert.ok(sql.includes('reparado_claim_request_email'));
 assert.ok(worker.includes('reparado_clientes@outlook.es'));
 assert.ok(worker.includes("Deno.env.get('REPARADO_MAIL_WORKER_SECRET')"));
 assert.ok(worker.includes('Idempotency-Key'));
 assert.ok(!worker.includes("Deno.env.get('VITE_"));
 assert.ok(worker.includes("to:['reparado_soporte@outlook.es']")); // Ahora también se ocupa de incidencias.
 assert.ok(worker.includes("const REQUESTS_TO='reparado_clientes@outlook.es'"));
});
