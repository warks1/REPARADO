import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
function handler(start,end){
  const first=code.indexOf(start);
  assert.notEqual(first,-1,'No se encuentra '+start);
  const last=code.indexOf(end,first);
  assert.ok(last>first,'No se encuentra el cierre de '+start);
  return code.slice(first,last);
}
test('V21: recuperación devuelve el control tras fallo de red y no duplica envíos',()=>{
  const s=handler("main.querySelector('#reset-form').addEventListener('submit'",'if(!openRegistration)return;');
  assert.match(s,/if\(submit\.disabled\)return/);
  assert.match(s,/try\s*\{/);
  assert.match(s,/catch\s*\{/);
  assert.match(s,/finally\s*\{submit\.disabled=false\}/);
  assert.match(s,/supabase\.auth\.resetPasswordForEmail\(email,\{redirectTo\}\)/);
  assert.match(s,/Si la cuenta existe/);
  assert.doesNotMatch(s,/message\(error\.message/);
});
test('V21: registro opcional no revela errores del proveedor y recupera el botón',()=>{
  const s=handler("main.querySelector('#register-form').addEventListener('submit'",'function showPasswordSetup()');
  assert.match(s,/if\(submit\.disabled\)return/);
  assert.match(s,/finally\s*\{submit\.disabled=false\}/);
  assert.match(s,/catch\s*\{/);
  assert.match(s,/supabase\.auth\.signUp/);
  assert.doesNotMatch(s,/message\(error\?error\.message/);
});
test('V21: invitación o recuperación gestiona excepciones sin dejar botón bloqueado',()=>{
  const s=handler("main.querySelector('#password-setup-form').addEventListener('submit'",'async function boot()');
  assert.match(s,/if\(submit\.disabled\)return/);
  assert.match(s,/finally\s*\{submit\.disabled=false\}/);
  assert.match(s,/catch\s*\{/);
  assert.match(s,/supabase\.auth\.updateUser\(\{password\}\)/);
  assert.match(s,/passwordSetupPending=false/);
  assert.doesNotMatch(s,/message\([^\n]*error\.message/);
});
