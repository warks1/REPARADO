import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const general=readFileSync(new URL('../supabase/auditoria-readonly-v9.sql',import.meta.url),'utf8');
const accounts=readFileSync(new URL('../supabase/auditoria-cuentas-test-v12.sql',import.meta.url),'utf8');

test('V56: la auditoría de triggers comprueba la clase de función, no una lista de RPC obsoleta',()=>{
  assert.match(general,/p\.prorettype='pg_catalog\.trigger'::regtype/);
  assert.match(general,/has_function_privilege\('authenticated',p\.oid,'EXECUTE'\)/);
  assert.doesNotMatch(general,/p\.proname not in \('accept_reparado_quote'/);
});

test('V56: la aceptación de presupuestos valida importe esperado y rechaza RPC heredada',()=>{
  for(const audit of [general,accounts]){
    assert.match(audit,/not has_function_privilege\('authenticated','public\.accept_reparado_quote\(uuid\)','EXECUTE'\)/);
    assert.match(audit,/has_function_privilege\('authenticated','public\.accept_reparado_quote\(uuid,numeric\)','EXECUTE'\)/);
    assert.match(audit,/not has_function_privilege\('anon','public\.accept_reparado_quote\(uuid,numeric\)','EXECUTE'\)/);
  }
});

test('V56: se mantienen controles de privacidad y base de datos de solo lectura',()=>{
  assert.match(general,/has_table_privilege\('anon',tab,'SELECT'\)/);
  assert.match(general,/relrowsecurity/);
  assert.match(accounts,/storage\.buckets/);
  for(const sql of [general,accounts]){
    assert.match(sql,/^with /m);
    assert.match(sql,/select control,case when correcto then 'OK'/i.test(sql) ? /order by orden/ : /order by orden/);
    assert.doesNotMatch(sql,/^\s*(create|alter|drop|insert|update|delete|truncate|grant|revoke)\s/m);
  }
});
