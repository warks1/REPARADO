import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
const start=source.indexOf('  let signOutPending=false;');
const end=source.indexOf("  app.querySelector('#logout').addEventListener('click',safeSignOut);",start);
assert.ok(start>=0 && end>start,'Falta controlador de cierre de sesión V55');
const logout=source.slice(start,end);

test('V55: cerrar sesión afecta únicamente al móvil que lo solicita',()=>{
  assert.match(logout,/supabase\.auth\.signOut\(\{scope:'local'\}\)/);
  assert.doesNotMatch(logout,/supabase\.auth\.signOut\(\)/);
  assert.ok(logout.indexOf('await pushManager.deactivate(oldId)')<logout.indexOf("supabase.auth.signOut({scope:'local'})"));
});

test('V55: doble pulsación no inicia revocaciones ni salidas simultáneas',()=>{
  assert.match(logout,/let signOutPending=false/);
  assert.match(logout,/if\(signOutPending\)return false/);
  assert.match(logout,/signOutPending=true/);
  assert.match(logout,/finally\s*\{\s*signOutPending=false/);
});

test('V55: error de red en revocación impide cerrar Auth y permite reintentar',()=>{
  assert.match(logout,/if\(oldId && !await pushManager\.deactivate\(oldId\)\)\{[\s\S]*?return false/);
  assert.match(logout,/catch\s*\{[\s\S]*?pushManager\.activate\(oldId\)/);
  assert.match(logout,/No se pudo cerrar la sesión/);
  assert.doesNotMatch(logout,/message\(error\.message/);
});

test('V55: botón en perfil y salida desde la pantalla de contraseña comparten protección',()=>{
  assert.match(source,/app\.querySelector\('#logout'\)\.addEventListener\('click',safeSignOut\)/);
  assert.match(source,/main\.querySelector\('#password-setup-logout'\)\.addEventListener\('click',safeSignOut\)/);
});
