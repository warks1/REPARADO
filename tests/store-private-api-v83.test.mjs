import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkStorePrivateApi,storePrivateTables} from '../scripts/store-private-api-check.mjs';

const url='https://reparado-production-example.supabase.co/';
const key='sb_publishable_TEST_PUBLIC_KEY';
const privateResponse={status:401,json:async()=>({code:'42501',message:'permission denied'})};
const publicResponse={status:200,json:async()=>[]};

function fixture({publicStatus=200,override={},throwOn=null}={}){
  const calls=[];
  const fetchImpl=async(target,options)=>{
    const parsed=new URL(target),table=parsed.pathname.split('/').at(-1);
    calls.push({target,options,table});
    if(throwOn===table)throw Error('No propagar detalles del servidor');
    return override[table]??(table==='customer_reviews'?
      {status:publicStatus,json:async()=>[]} : privateResponse);
  };
  return {fetchImpl,calls};
}

test('V83: seis tablas privadas sin SELECT anónimo, reseñas públicas disponibles',async()=>{
  assert.deepEqual(storePrivateTables,[
    'profiles','service_requests','messages','notifications','device_tokens','invoices'
  ]);
  const {fetchImpl,calls}=fixture();
  const result=await checkStorePrivateApi({url,key,fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(calls.length,7);
  assert.equal(calls[0].table,'customer_reviews');
  assert.deepEqual(calls.slice(1).map(c=>c.table),storePrivateTables);
  for(const {target,options} of calls){
    assert.equal(new URL(target).origin,'https://reparado-production-example.supabase.co');
    assert.equal(new URL(target).search,'?select=id&limit=0');
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');
    assert.equal(options.headers.apikey,key);
    assert.equal(options.headers.accept,'application/json');
    assert.ok(!Object.prototype.hasOwnProperty.call(options.headers,'Authorization'));
    assert.ok(options.signal instanceof AbortSignal);
  }
});

test('V83: una tabla legible anónimamente bloquea firma aunque no haya filas',async()=>{
  for(const table of storePrivateTables){
    const {fetchImpl,calls}=fixture({
      override:{[table]:{status:200,json:async()=>[]}}
    });
    const result=await checkStorePrivateApi({url,key,fetchImpl});
    assert.equal(result.ok,false,table);
    assert.match(result.reason,/bloqueo de lectura anónima/);
    assert.ok(calls.some(c=>c.table===table));
  }
});

test('V83: rechazo aparente por clave incorrecta, tabla inexistente o error no acredita RLS',async()=>{
  for(const response of [
    {status:404,json:async()=>({code:'PGRST205'})},
    {status:401,json:async()=>({code:'PGRST301'})},
    {status:403,json:async()=>({code:'28P01'})},
    {status:500,json:async()=>({code:'XX000'})}
  ]){
    const result=await checkStorePrivateApi({
      url,key,fetchImpl:fixture({override:{invoices:response}}).fetchImpl
    });
    assert.equal(result.ok,false,JSON.stringify(response.status));
  }
  assert.equal((await checkStorePrivateApi({
    url,key,fetchImpl:fixture({publicStatus:404}).fetchImpl
  })).ok,false);
});

test('V83: fallos de red o JSON malformado bloquean sin filtrar claves o URL',async()=>{
  for(const options of [
    {throwOn:'customer_reviews'},{throwOn:'service_requests'},
    {override:{profiles:{status:403,json:async()=>{throw Error('SECRET_SERVER_REPLY')}}}}
  ]){
    const result=await checkStorePrivateApi({url,key,fetchImpl:fixture(options).fetchImpl});
    assert.equal(result.ok,false);
    assert.ok(!result.reason.includes(key));
    assert.ok(!result.reason.includes(url));
    assert.ok(!result.reason.includes('SECRET_SERVER_REPLY'));
  }
});

test('V83: ninguna petición con REPARADO Test, clave privada o servidor ajeno',async()=>{
  let calls=0;
  const noNetwork=async()=>{calls++;throw Error('No debe acceder a red')};
  const invalid=[
    {url:'https://kpmmlzjvespenogqtujo.supabase.co/',key},
    {url:'https://evil.example.com/',key},
    {url:'https://reparado-production-example.supabase.co.evil.invalid/',key},
    {url,key:'sb_secret_PRIVATE'},
    {url:'http://reparado-production-example.supabase.co/',key},
    {url:'https://reparado-production-example.supabase.co/path',key},
    {url,key:''},{url:'',key}
  ];
  for(const item of invalid){
    const result=await checkStorePrivateApi({...item,fetchImpl:noNetwork});
    assert.equal(result.ok,false,JSON.stringify(item.url));
  }
  assert.equal(calls,0);
});

test('V83: Apple y Google bloquean la firma si falla esta verificación',()=>{
  const release=readFileSync(new URL('../.github/workflows/store-release.yml',import.meta.url),'utf8');
  const cmd='node scripts/store-private-api-check.mjs';
  assert.equal(release.split(cmd).length-1,2);
  for(const section of release.split('jobs:')[1].split('      - name: Instalar')){
    // Cada paso que compila tiene primero la verificación privada.
    if(section.includes('node scripts/store-preflight.mjs'))
      assert.ok(section.includes(cmd));
  }
  assert.ok(release.indexOf(cmd)<release.indexOf('bundleRelease'));
  assert.ok(release.indexOf(cmd)<release.indexOf('xcodebuild archive'));
});
