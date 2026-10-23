import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPublicConfig} from '../scripts/check-public-config.mjs';
const host='https://reparado-cliente-ejemplo.supabase.co';
const key='sb_publishable_PUBLIC_EXAMPLE_ONLY';
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt=payload=>[b64({alg:'HS256',typ:'JWT'}),b64(payload),'signature'].join('.');

test('V20 acepta demo sin secretos y proyecto alojado con clave publicable',()=>{
  assert.equal(checkPublicConfig('',''),null);
  assert.equal(checkPublicConfig(host,key),null);
});
test('V20 solo permite dominio directo de Supabase, no imitaciones ni servidores ajenos',()=>{
  for(const bad of [
    'https://evil.example','https://reparado-cliente-ejemplo.supabase.co.evil.example',
    'https://supabase.co','https://extra.reparado-cliente-ejemplo.supabase.co',
    'https://localhost','https://127.0.0.1'
  ]) assert.match(checkPublicConfig(bad,key),/Supabase/);
});
test('V20 rechaza URL con usuario, puerto, ruta, parámetros o fragmento',()=>{
  for(const bad of [
    'https://user:pass@reparado-cliente-ejemplo.supabase.co',
    host+':8443',host+'/auth/v1',host+'/?token=fake',host+'/#access_token=fake'
  ]) assert.match(checkPublicConfig(bad,key),/URL base/);
});
test('V20 nunca despliega REPARADO Test ni claves de servidor',()=>{
  assert.match(checkPublicConfig('https://kpmmlzjvespenogqtujo.supabase.co',key),/privado/);
  assert.match(checkPublicConfig(host,'sb_secret_FAKE'),/secreta/);
  assert.match(checkPublicConfig(host,jwt({role:'service_role'})),/servidor/);
  assert.match(checkPublicConfig(host,jwt({role:'supabase_admin'})),/servidor/);
});
test('V20 acepta anon JWT emparejada con proyecto y rechaza roles desconocidos',()=>{
  assert.equal(checkPublicConfig(host,jwt({role:'anon',ref:'reparado-cliente-ejemplo'})),null);
  assert.match(checkPublicConfig(host,jwt({role:'anon',ref:'otro-proyecto'})),/no pertenece/);
  assert.match(checkPublicConfig(host,jwt({role:'authenticated'})),/anónimo/);
  assert.match(checkPublicConfig(host,jwt({})),/anónimo/);
});
