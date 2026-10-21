import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authLinkIntentFromUrl,publicRegistrationEnabled} from '../auth-mode.js';

test('Supabase invite/recovery enlaces URL: detectar sólo intención sin usar tokens',()=>{
  assert.equal(authLinkIntentFromUrl('?type=invite&token_hash=secret',''),'invite');
  assert.equal(authLinkIntentFromUrl('','#access_token=ficticio&type=recovery'),'recovery');
  assert.equal(authLinkIntentFromUrl('?code=ficticio','#type=invite'),'invite');
  assert.equal(authLinkIntentFromUrl('?type=magiclink',''),null);
  assert.equal(authLinkIntentFromUrl('?type=signup','#type=unknown'),null);
  assert.equal(authLinkIntentFromUrl('',''),null);
  assert.equal(authLinkIntentFromUrl('?type=recovery','#type=invite'),'recovery');
});
test('Auth cerrado por defecto incluso en enlace de invitación',()=>{
  assert.equal(publicRegistrationEnabled(undefined),false);
  assert.equal(publicRegistrationEnabled('false'),false);
  assert.equal(publicRegistrationEnabled('true'),true);
});
test('La aplicación transmite el tipo de enlace antes de crear sesión Supabase',()=>{
  const s=readFileSync(new URL('../supabase.js',import.meta.url),'utf8');
  const m=readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.ok(s.indexOf('authLinkIntentFromUrl(')<s.indexOf('createClient(url, key'));
  assert.ok(m.includes('mountConnected({app,services,supabase,authLinkIntent})'));
});
test('Invitados establecen contraseña real Auth y recuperación usa origen sin token',()=>{
  const s=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.ok(s.includes("supabase.auth.resetPasswordForEmail(email,{redirectTo})"));
  assert.ok(s.includes("window.location.origin+window.location.pathname"));
  assert.ok(s.includes("supabase.auth.updateUser({password})"));
  assert.ok(s.includes("if(password.length<12)"));
  assert.ok(s.includes("event==='PASSWORD_RECOVERY'"));
  assert.ok(s.includes("passwordSetupPending=authLinkIntent==='invite'||authLinkIntent==='recovery'"));
  assert.ok(s.includes("if(passwordSetupPending){showPasswordSetup();return}"));
  assert.ok(s.includes('role="status"'));
  assert.ok(s.includes("supabase.auth.signInWithPassword"));
  assert.ok(!s.includes('supabase.auth.admin.'));
});
