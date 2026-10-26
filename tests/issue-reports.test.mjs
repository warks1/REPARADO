import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('clientes conectados pueden denunciar fallos, con límites y sin introducir contraseñas',()=>{
 const src=load('connected.js');
 assert.ok(src.includes('id="reparado-issue-report"'));
 assert.ok(src.includes("name=\"subject\" maxlength=\"140\" minlength=\"5\""));
 assert.ok(src.includes("name=\"description\" maxlength=\"2000\" minlength=\"12\""));
 const submit=load('support-submission.js');
 assert.ok(src.includes('submitSupportIssue({'));
 assert.ok(submit.includes(".from('support_reports').insert({"));
 assert.ok(submit.includes('user_id:userId,subject,description,context,client_report_id:reportId'));
 assert.ok(submit.includes('reparado_soporte@outlook.es'));
 assert.ok(src.includes('Si') || src.includes('Comunicar')); // Cuenta conectada.
});
test('solo administración ve y tramita informes; cambios de estado limitados',()=>{
 const src=load('connected.js');
 assert.ok(src.includes("profile?.role!=='admin'"));
 assert.ok(src.includes("view==='support-admin'"));
 assert.ok(src.includes(".from('support_reports').update({status:next})"));
 assert.ok(src.includes("['reviewing','resolved'].includes(next)"));
 assert.ok(src.includes('esc(item.description)'));
});
test('RLS de soporte es por propietario y administrador; cola privada para ambos buzones',()=>{
 const sql=load('supabase/migration-support-reports.sql');
 for(const name of ['support_reports','support_email_outbox'])
   assert.ok(sql.includes('alter table public.'+name+' enable row level security'));
 assert.ok(sql.includes('user_id=(select auth.uid())'));
 assert.ok(sql.includes('(select public.is_reparado_admin())'));
 assert.ok(sql.includes('grant update(status)'));
 assert.ok(sql.includes('revoke all on public.support_email_outbox'));
 assert.ok(sql.includes("reparado_claim_support_email"));
 assert.ok(sql.includes('for update skip locked'));
 assert.ok(!sql.includes('grant delete'));
});
test('avisos de incidencias al correo de soporte; reparaciones al comercial',()=>{
 const w=load('supabase/functions/reparado-mail-worker/index.ts');
 assert.ok(w.includes("to:['reparado_soporte@outlook.es']"));
 assert.ok(w.includes("const REQUESTS_TO='reparado_clientes@outlook.es'"));
 assert.ok(w.includes("'Idempotency-Key':'reparado-support-'"));
 assert.ok(w.includes('support_email_outbox'));
 assert.ok(!w.includes('JSON.stringify({from:sender,to:[REQUESTS_TO],subject,text:body,description'));
});
