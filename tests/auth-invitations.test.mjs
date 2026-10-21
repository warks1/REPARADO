import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicRegistrationEnabled} from '../auth-mode.js';

test('REPARADO: el registro web está cerrado salvo activación explícita',()=>{
  for(const value of [undefined,null,'','false',false,true,'TRUE','1','yes','true '])
    assert.equal(publicRegistrationEnabled(value),false);
  assert.equal(publicRegistrationEnabled('true'),true);
});
test('el inicio de sesión sigue disponible en modo por invitación',()=>{
  const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.ok(code.includes('supabase.auth.signInWithPassword'));
  assert.ok(code.includes('const openRegistration=publicRegistrationEnabled('));
  assert.ok(code.includes("Acceso privado: solicita una invitación"));
  assert.ok(code.includes('const registerMarkup=openRegistration?'));
  assert.ok(code.includes('if(!openRegistration)return;'));
  assert.ok(code.includes('supabase.auth.signUp'));
  assert.ok(code.indexOf("supabase.auth.signInWithPassword")<code.indexOf('if(!openRegistration)return;'),
    'El acceso por contraseña debe configurarse siempre, incluso sin permitir altas.');
});
test('las cuentas siguen con perfiles protegidos y no se inventa un cierre de backend',()=>{
  const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  const helper=readFileSync(new URL('../auth-mode.js',import.meta.url),'utf8');
  assert.ok(code.includes("from('profiles').select('id,full_name,phone,role')"));
  assert.ok(helper.includes('Supabase Auth'));
  assert.ok(!helper.includes('service_role'));
});
