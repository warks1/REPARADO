import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkRealBackendConnection} from '../admin-connection-diagnostics.js';

const id='00000000-0000-4000-8000-000000000004';
const other='00000000-0000-4000-8000-000000000001';
const source=readFileSync(new URL('../connected.js',import.meta.url),'utf8');

function fake({role='admin',authUser=id,offline=[],profileMissing=false}={}){
  const calls=[];
  return {
    calls,
    auth:{getUser:async()=>({data:{user:{id:authUser}},error:null})},
    from(table){
      calls.push({table});
      const builder={
        select(fields,opts){calls.push({table,fields,opts});return builder},
        eq(col,val){calls.push({table,col,val});return builder},
        maybeSingle:async()=>({data:profileMissing?null:{id,role},error:null}),
        then(resolve,reject){return Promise.resolve({
          data:null,count:0,error:offline.includes(table)?new Error('Sin conexión'):null
        }).then(resolve,reject)}
      };
      return builder;
    }
  };
}

test('V38: autentica sesión en servidor y comprueba exclusivamente las lecturas privadas',async()=>{
  const s=fake();
  const result=await checkRealBackendConnection({supabase:s,userId:id});
  assert.equal(result.ok,true);
  assert.equal(result.checks.length,4);
  assert.ok(result.checks.every(c=>c.ok));
  const reads=s.calls.filter(x=>x.opts);
  assert.deepEqual(reads.map(x=>x.table),['service_requests','notifications']);
  assert.ok(reads.every(x=>x.opts.head===true));
  assert.ok(s.calls.filter(x=>x.col).every(x=>x.val===id));
  assert.ok(!JSON.stringify(result).includes(id)); // sin IDs ni datos personales
});

test('V38: no hace consultas de datos privados para otra sesión o sin rol admin',async()=>{
  const mismatch=fake({authUser:other});
  const rejected=await checkRealBackendConnection({supabase:mismatch,userId:id});
  assert.equal(rejected.ok,false);
  assert.equal(mismatch.calls.length,0);
  const customer=fake({role:'customer'});
  const noAccess=await checkRealBackendConnection({supabase:customer,userId:id});
  assert.equal(noAccess.ok,false);
  assert.deepEqual(customer.calls.filter(x=>x.opts),[]);
  assert.equal((await checkRealBackendConnection({supabase:customer,userId:'invalid'})).ok,false);
});

test('V38: errores de red no anuncian conexión correcta y conservan avisos parciales',async()=>{
  const s=fake({offline:['notifications']});
  const result=await checkRealBackendConnection({supabase:s,userId:id});
  assert.equal(result.ok,false);
  assert.deepEqual(result.checks.map(x=>x.ok),[true,true,true,false]);
  const down={...fake(),auth:{getUser:async()=>{throw new Error('offline')}}};
  assert.equal((await checkRealBackendConnection({supabase:down,userId:id})).ok,false);
});

test('V38: botón visible solo al admin y respuestas asíncronas invalidan datos de sesión antigua',()=>{
  assert.match(source,/profile\?\.role==='admin'\?'<section class="reparado-help" id="system-diagnostics"/);
  assert.match(source,/id="check-system-connection"/);
  assert.match(source,/checkRealBackendConnection\(\{supabase,userId:originId\}\)/);
  assert.match(source,/!panel\.isConnected\|\|currentView!=='profile'\|\|!isCurrentUser\(originId\)/);
  assert.match(source,/connectionButton\.disabled=true/);
});
