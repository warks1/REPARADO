import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateLiveTestEnv,verifyTestClientIsolation} from '../scripts/check-real-customer-isolation.mjs';

const A='00000000-0000-4000-8000-000000000001';
const B='00000000-0000-4000-8000-000000000002';
const data={
  profiles:[{id:A,role:'customer'},{id:B,role:'customer'}],
  service_requests:[{id:'101',customer_id:B}],
  messages:[{id:'102',customer_id:B}],
  notifications:[{id:'103',user_id:B}],
  invoices:[{id:'104',customer_id:B}],
  support_reports:[{id:'105',user_id:B}],
  account_deletion_requests:[{id:'106',user_id:B}]
};

function fake(id,{ignoreRls=false,role=null,replace={}}={}){
  return {
    auth:{getUser:async()=>({data:{user:{id}},error:null})},
    from(table){
      const query={table,conditions:[],count:Infinity};
      const rows=()=>{
        let all=(replace[table]||data[table]||[]).map(x=>({...x}));
        if(!ignoreRls)all=all.filter(row=>{
          if(table==='profiles')return row.id===id;
          const field=['notifications','support_reports','account_deletion_requests'].includes(table)?'user_id':'customer_id';
          return row[field]===id;
        });
        for(const [field,value] of query.conditions)all=all.filter(row=>row[field]===value);
        all=all.slice(0,query.count);
        if(role!==null && table==='profiles')all=all.map(p=>({...p,role}));
        return all;
      };
      const qb={
        select(){return qb},
        eq(field,value){query.conditions.push([field,value]);return qb},
        limit(value){query.count=value;return qb},
        maybeSingle:async()=>({data:rows()[0]||null,error:null}),
        then(resolve,reject){return Promise.resolve({data:rows(),error:null}).then(resolve,reject)}
      };
      return qb;
    }
  };
}

const config={
  REPARADO_TEST_SUPABASE_URL:'https://kpmmlzjvespenogqtujo.supabase.co',
  REPARADO_TEST_PUBLISHABLE_KEY:'sb_publishable_PUBLIC_TEST',
  REPARADO_TEST_CLIENT_A_EMAIL:'primer-cliente@example.net',
  REPARADO_TEST_CLIENT_A_PASSWORD:'secret first',
  REPARADO_TEST_CLIENT_B_EMAIL:'segundo-cliente@example.net',
  REPARADO_TEST_CLIENT_B_PASSWORD:'secret second'
};

test('V50: nunca acepta producción, claves secretas ni cuentas duplicadas',()=>{
  assert.doesNotThrow(()=>validateLiveTestEnv(config));
  for(const diff of [
    {REPARADO_TEST_SUPABASE_URL:'https://otro.supabase.co'},
    {REPARADO_TEST_SUPABASE_URL:'http://kpmmlzjvespenogqtujo.supabase.co'},
    {REPARADO_TEST_SUPABASE_URL:'https://kpmmlzjvespenogqtujo.supabase.co/path'},
    {REPARADO_TEST_PUBLISHABLE_KEY:'sb_secret_PRIVATE'},
    {REPARADO_TEST_CLIENT_B_EMAIL:'primer-cliente@example.net'},
    {REPARADO_TEST_CLIENT_A_PASSWORD:''}
  ])assert.throws(()=>validateLiveTestEnv({...config,...diff}));
});

test('V50: dos cuentas distintas jamás ven filas de la otra; no hay operaciones de escritura',async()=>{
  const result=await verifyTestClientIsolation(fake(A),fake(B));
  assert.equal(result.ok,true);
  assert.ok(result.verifications>=14);
  assert.equal(result.skipped,2); // Solo A tiene cero filas en tablas opcionales
  assert.equal(JSON.stringify(result).includes(A),false);
  assert.equal(JSON.stringify(result).includes(B),false);
});

test('V50: política de perfiles defectuosa detiene la prueba con error de privacidad',async()=>{
  await assert.rejects(verifyTestClientIsolation(fake(A,{ignoreRls:true}),fake(B)),/FALLO DE PRIVACIDAD/);
});

test('V50: sesiones con rol no cliente o mismo usuario nunca se consideran válidas',async()=>{
  await assert.rejects(verifyTestClientIsolation(fake(A),fake(A)),/misma cuenta/);
  await assert.rejects(verifyTestClientIsolation(fake(A,{role:'admin'}),fake(B)),/no pertenece a una cuenta de cliente/);
});

test('V50: el workflow conectado solo se puede ejecutar manualmente con secretos de pruebas',()=>{
  const yml=readFileSync(new URL('../.github/workflows/qa-real-account-rls-v50.yml',import.meta.url),'utf8');
  assert.match(yml,/workflow_dispatch:/);
  assert.match(yml,/github\.event_name == 'workflow_dispatch'/);
  assert.match(yml,/environment: reparado-private-test/);
  assert.match(yml,/secrets\.REPARADO_TEST_CLIENT_A_PASSWORD/);
  assert.match(yml,/secrets\.REPARADO_TEST_CLIENT_B_PASSWORD/);
  assert.doesNotMatch(yml,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
