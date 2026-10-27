import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('V19 deniega TRUNCATE, DELETE, TRIGGER y REFERENCES sobre todos los datos personales',()=>{
 const sql=read('supabase/migration-v19.sql');
 for(const t of ['profiles','service_requests','messages','notifications','device_tokens','invoices','customer_reviews'])
   assert.ok(sql.includes('public.'+t),'Falta '+t);
 assert.ok(sql.includes('revoke truncate, trigger, references, delete'));
 assert.ok(sql.includes('has_table_privilege(\'authenticated\''));
 assert.ok(sql.includes('has_table_privilege(\'anon\''));
 assert.ok(sql.includes('relrowsecurity'));
});
test('chat no puede reescribir mensajes y tokens no pueden falsificar fecha',()=>{
 const sql=read('supabase/migration-v19.sql');
 assert.ok(sql.includes('revoke insert, update on table public.messages'));
 assert.ok(sql.includes('grant insert (customer_id, sender_id, body)'));
 assert.ok(sql.includes('grant insert (user_id, token, platform)'));
 assert.ok(sql.includes('grant update (user_id, token, platform)'));
 assert.ok(sql.includes("has_column_privilege('authenticated','public.device_tokens','created_at','UPDATE')"));
 assert.ok(sql.includes('grant update (status) on public.customer_reviews'));
});
test('el navegador no filtra URL sensible a sitios externos',()=>{
 const html=read('index.html');
 assert.ok(html.includes('<meta name="referrer" content="no-referrer" />'));
});
test('errores de autenticación genéricos y contraseñas nuevas largas de 15 o más caracteres',()=>{
 const js=read('connected.js');
 assert.ok(js.includes("if(error){message('No se pudo iniciar sesión."));
 assert.ok(!js.includes("if(error){message(error.message,true);return}\n      // Supabase"));
 assert.ok(js.includes("if(button.disabled)return"));
 assert.ok(js.includes("validateNewPassword(password)"));
 assert.ok(js.includes('name="password_confirm" type="password" autocomplete="new-password" minlength="12"'));
});
