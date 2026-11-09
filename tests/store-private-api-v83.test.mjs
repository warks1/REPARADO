import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkStorePrivateApi,storePrivateTables,
  storePrivateColumns} from '../scripts/store-private-api-check.mjs';

const url='https://reparado-production-example.supabase.co/';
const key='sb_publishable_TEST_PUBLIC_KEY';
const forbidden={status:401,json:async()=>({code:'42501',message:'permission denied'})};

function fixture({publicStatus=200,exposed=null,override={},throwOn=null}={}){
  const calls=[];
  const fetchImpl=async(target,options)=>{
    const parsed=new URL(target),table=parsed.pathname.split('/').at(-1);
    const column=parsed.searchParams.get('select');
    const field=table+'.'+column;
    calls.push({target,options,table,column,field});
    if(throwOn===field)throw Error('No imprimir respuesta privada del servidor');
    if(table==='customer_reviews')return {status:publicStatus,json:async()=>[]};
    if(override[field])return override[field];
    if(exposed===field)return {status:200,json:async()=>[]};
    return forbidden;
  };
  return {fetchImpl,calls};
}

test('V83: todas las columnas conocidas denegadas al anónimo; las reseñas públicas disponibles',async()=>{
  assert.deepEqual(storePrivateTables,[
    'profiles','service_requests','messages','notifications','device_tokens','invoices'
  ]);
  assert.equal(Object.values(storePrivateColumns).flat().length,51);
  const {fetchImpl,calls}=fixture();
  const result=await checkStorePrivateApi({url,key,fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(calls.length,52);
  assert.equal(calls[0].field,'customer_reviews.id');
  const expected=storePrivateTables.flatMap(table=>
    storePrivateColumns[table].map(column=>table+'.'+column));
  assert.deepEqual(calls.slice(1).map(c=>c.field),expected);
  for(const {target,options,column} of calls){
    assert.equal(new URL(target).origin,'https://reparado-production-example.supabase.co');
    assert.equal(new URL(target).searchParams.get('select'),column);
    assert.equal(new URL(target).searchParams.get('limit'),'0');
    assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');
    assert.equal(options.headers.apikey,key);
    assert.equal(options.headers.accept,'application/json');
    assert.equal(Object.hasOwn(options.headers,'Authorization'),false);
    assert.ok(options.signal instanceof AbortSignal);
  }
});

test('V83: un GRANT SELECT aislado en cualquier columna privada también bloquea tienda',async()=>{
  for(const table of storePrivateTables){
    for(const column of storePrivateColumns[table]){
      const field=table+'.'+column;
      const {fetchImpl,calls}=fixture({exposed:field});
      const result=await checkStorePrivateApi({url,key,fetchImpl});
      assert.equal(result.ok,false,field);
      assert.ok(calls.some(c=>c.field===field));
      assert.ok(result.reason.includes(field));
    }
  }
});

test('V83: 401 de clave inválida, tabla no encontrada y error 500 no acreditan privacidad',async()=>{
  for(const response of [
    {status:404,json:async()=>({code:'PGRST205'})},
    {status:401,json:async()=>({code:'PGRST301'})},
    {status:403,json:async()=>({code:'28P01'})},
    {status:500,json:async()=>({code:'XX000'})}
  ]){
    const result=await checkStorePrivateApi({
      url,key,
      fetchImpl:fixture({override:{'invoices.created_at':response}}).fetchImpl
    });
    assert.equal(result.ok,false,JSON.stringify(response.status));
  }
  assert.equal((await checkStorePrivateApi({
    url,key,fetchImpl:fixture({publicStatus:404}).fetchImpl
  })).ok,false);
});

test('V83: fallos de red o JSON malformado bloquean sin revelar claves ni URL',async()=>{
  for(const opts of [
    {throwOn:'customer_reviews.id'},{throwOn:'service_requests.phone'},
    {override:{'profiles.role':{status:403,
      json:async()=>{throw Error('PRIVATE_RESPONSE_TOKEN')}}}}
  ]){
    const result=await checkStorePrivateApi({url,key,fetchImpl:fixture(opts).fetchImpl});
    assert.equal(result.ok,false);
    assert.ok(!result.reason.includes(key));
    assert.ok(!result.reason.includes(url));
    assert.ok(!result.reason.includes('PRIVATE_RESPONSE_TOKEN'));
  }
});

test('V83: nunca consultar servidor ajeno, Test ni clave privada',async()=>{
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

test('V83: Android y Apple comprueban la API privada antes de firmar',()=>{
  const release=readFileSync(new URL('../.github/workflows/store-release.yml',import.meta.url),'utf8');
  const cmd='node scripts/store-private-api-check.mjs';
  assert.equal(release.split(cmd).length-1,2);
  assert.ok(release.indexOf(cmd)<release.indexOf('bundleRelease'));
  assert.ok(release.indexOf(cmd)<release.indexOf('xcodebuild archive'));
  for(const job of ['google-play:','app-store:'])
    assert.ok(release.includes(job));
});
