import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../connected.js',import.meta.url),'utf8');

test('solicitud: no admite doble envío ni deja el botón deshabilitado tras fallo de red',()=>{
  const start=source.indexOf("const form=main.querySelector('#new-request')");
  const end=source.indexOf('async function loadRequests()',start);
  assert.ok(start>=0&&end>start);
  const text=source.slice(start,end);
  assert.match(text,/if\(button\.disabled\)return/);
  assert.match(text,/catch\s*\{/);
  assert.match(text,/finally\s*\{/);
  assert.match(text,/if\(button\.isConnected\)button\.disabled=false/);
  assert.match(text,/Comprueba Mis solicitudes antes de reintentar/);
  assert.match(text,/fotografía\(s\) necesitan reintento/);
  assert.match(text,/uploadPhotosWithRecovery/);
  assert.match(text,/photosResult\.failed/);
});
test('notificaciones: no se usan upserts directos ni se mantiene token tras cerrar sesión',()=>{
  assert.ok(source.includes('createPushSessionManager('));
  assert.ok(source.includes('await pushManager.deactivate(oldId)'));
  assert.ok(source.includes("void pushManager.discard()"));
  assert.ok(!source.includes("from('device_tokens').upsert"));
  assert.ok(source.includes("main.querySelector('#password-setup-logout').addEventListener('click',safeSignOut)"));
});
test('migración V24 revoca permisos directos y valida pertenencia de token',()=>{
  const sql=readFileSync(new URL('../supabase/migration-v24.sql',import.meta.url),'utf8');
  assert.match(sql,/revoke select, insert, update, delete/);
  assert.match(sql,/where user_id=current_user_id and token=p_token/);
  assert.match(sql,/on conflict\(token\) do update/);
  assert.match(sql,/grant execute on function public\.reparado_revoke_device\(text\) to authenticated/);
  assert.match(sql,/revoke all on function public\.reparado_revoke_device\(text\) from public,anon,authenticated/);
});
