import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkStoreAuthSignup} from '../scripts/store-auth-signup-check.mjs';

const url='https://reparado-production-example.supabase.co/';
const key='sb_publishable_TEST_PUBLIC';
const fake=(obj,{status=200}={})=>async(endpoint,options)=>{
  assert.equal(endpoint,'https://reparado-production-example.supabase.co/auth/v1/settings');
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'error');
  assert.equal(options.headers.apikey,key);
  return {ok:status>=200&&status<300,status,json:async()=>obj};
};

test('V43: solo se aprueba disable_signup true confirmado por Supabase Auth',async()=>{
  const closed=await checkStoreAuthSignup({url,key,fetchImpl:fake({disable_signup:true,external:{anonymous_users:false}})});
  assert.equal(closed.ok,true);
  for(const settings of [{disable_signup:false},{},{disable_signup:null},{disable_signup:'true'},
                           {disable_signup:true,external:{anonymous_users:true}}]){
    const v=await checkStoreAuthSignup({url,key,fetchImpl:fake(settings)});
    assert.equal(v.ok,false,JSON.stringify(settings));
  }
});

test('V43: falla si no hay red, Auth da error o JSON inválido',async()=>{
  assert.equal((await checkStoreAuthSignup({url,key,fetchImpl:fake({}, {status:401})})).ok,false);
  assert.equal((await checkStoreAuthSignup({url,key,fetchImpl:async()=>{throw new Error('Token secreto de ejemplo')}})).ok,false);
  assert.equal((await checkStoreAuthSignup({url,key,fetchImpl:async()=>({ok:true,json:()=>{throw new Error('JSON malformado')}})})).ok,false);
});

test('V43: rechaza URL no HTTPS, credenciales embebidas, parámetros y claves vacías',async()=>{
  for(const bad of [
    'http://reparado-production-example.supabase.co/',
    'https://user:pass@reparado-production-example.supabase.co/',
    'https://reparado-production-example.supabase.co/?key=secret',
    'https://reparado-production-example.supabase.co/path','::::'
  ])assert.equal((await checkStoreAuthSignup({url:bad,key,fetchImpl:()=>{throw Error('No debe llamar')}})).ok,false);
  assert.equal((await checkStoreAuthSignup({url,key:''})).ok,false);
});

test('V43: el flujo de publicación firmado verifica Auth en Apple y Google antes de compilar',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/store-release.yml',import.meta.url),'utf8');
  assert.equal((workflow.match(/node scripts\/store-auth-signup-check\.mjs/g)||[]).length,2);
  assert.ok(workflow.includes("environment: store-release"));
  assert.match(workflow,/node scripts\/store-preflight\.mjs/);
  const i=workflow.indexOf('node scripts/store-auth-signup-check.mjs');
  assert.ok(i<workflow.indexOf('bundleRelease'));
  assert.ok(i<workflow.indexOf('xcodebuild archive'));
});


test('V57: no enviar clave a servidor ajeno, imitación de Supabase ni REPARADO Test',async()=>{
  const forbidden=[
    'https://evil.example.net/',
    'https://reparado-production-example.supabase.co.evil.example/',
    'https://extra.reparado-production-example.supabase.co/',
    'https://kpmmlzjvespenogqtujo.supabase.co/',
    'https://reparado-production-example.supabase.co:8443/'
  ];
  let calls=0;
  const neverFetch=async()=>{calls++;throw new Error('No se debe consultar esta URL')};
  for(const invalidUrl of forbidden){
    const result=await checkStoreAuthSignup({url:invalidUrl,key,fetchImpl:neverFetch});
    assert.equal(result.ok,false,invalidUrl);
  }
  assert.equal(calls,0,'Una URL rechazable nunca debe iniciar una petición HTTP');
});

test('V57: rechazar claves privadas, rol desconocido y proyecto JWT distinto antes de enviar',async()=>{
  const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const jwt=payload=>[encode({alg:'HS256'}),encode(payload),'signature'].join('.');
  let called=false;
  const neverFetch=async()=>{called=true;throw new Error('No se debe consultar Auth')};
  for(const invalidKey of [
    'sb_secret_PRIVATE',
    jwt({role:'service_role'}),
    jwt({role:'authenticated'}),
    jwt({role:'anon',ref:'un-proyecto-distinto'})
  ]){
    const result=await checkStoreAuthSignup({url,key:invalidKey,fetchImpl:neverFetch});
    assert.equal(result.ok,false);
  }
  assert.equal(called,false);
});

test('V57: valores anónimos ambiguos bloquean firma y ausencia requiere validación manual',async()=>{
  for(const anonymousUsers of [true,null,'false',0]){
    const result=await checkStoreAuthSignup({
      url,key,fetchImpl:fake({disable_signup:true,external:{anonymous_users:anonymousUsers}})
    });
    assert.equal(result.ok,false);
  }
  // Algunas versiones de Auth no exponen el indicador: no se inventa
  // su valor y la aprobación final del panel de Auth sigue siendo obligatoria.
  const old=await checkStoreAuthSignup({url,key,fetchImpl:fake({disable_signup:true,external:{}})});
  assert.equal(old.ok,true);
});
