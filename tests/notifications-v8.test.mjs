import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migration-v8.sql',import.meta.url),'utf8');
test('V8 crea avisos para el operario sin habilitar envíos push',()=>{
 assert.ok(sql.includes("create or replace function public.reparado_notify_operator_assignment_v8()"));
 assert.ok(sql.includes('security definer'));
 assert.ok(sql.includes('new.operator_id'));
 assert.ok(sql.includes('Asignación retirada'));
 assert.ok(sql.includes('Visita cancelada'));
 assert.ok(sql.includes('Visita reprogramada'));
 assert.ok(sql.includes('Visita programada'));
 assert.ok(sql.includes('Nuevo trabajo asignado'));
 assert.ok(sql.includes('Trabajo en curso'));
 assert.ok(sql.includes("new.status::text not in ('accepted','scheduled','in_progress')"));
 assert.ok(sql.includes("to_char(new.scheduled_at at time zone 'Europe/Madrid'"));
 assert.ok(sql.includes('revoke all on function public.reparado_notify_operator_assignment_v8()'));
 assert.ok(!sql.includes('device_tokens'));
});
test('V8 solo escribe avisos en la tabla privada y respeta clientes y operarios',()=>{
 assert.ok(sql.includes('insert into public.notifications(user_id,title,body)'));
 assert.ok(sql.includes("p.role::text='operator'"));
 assert.ok(sql.includes('v_changed_operator'));
 assert.ok(sql.includes("old.status::text in ('accepted','scheduled','in_progress')"));
 assert.ok(!sql.includes('insert into public.device_tokens'));
});
test('mis avisos distingue entre mensajes de cliente y avisos del personal',()=>{
 const ui=readFileSync(new URL('../notifications.js',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(ui.includes('isStaff=false'));
 assert.ok(ui.includes('Avisos de trabajos asignados, cambios de agenda y mensajes.'));
 assert.ok(controller.includes('isStaff:userIsStaff()'));
});
