import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const python=readFileSync(new URL('./full-role-flow-v69.py',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/auditoria-sesiones-v69.sql',import.meta.url),'utf8');
const doc=readFileSync(new URL('../docs/VALIDACION-ROLES-V69.md',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/qa-full-role-flow-v69.yml',import.meta.url),'utf8');

test('V69: prueba de roles se niega a tocar bases remotas y revierte todo',()=>{
  assert.match(python,/settings\.get\('host'\) not in \('127\.0\.0\.1','localhost'\)/);
  assert.match(python,/settings\.get\('dbname'\)!='reparado_test'/);
  assert.match(python,/finally:\s+[\s\S]*?db\.rollback\(\)/);
  assert.match(python,/select count\(\*\) from public\.service_requests where id=%s/);
  assert.doesNotMatch(python,/\bdb\.commit\(\)/g,function(){}); // Se valida el scope más abajo.
  assert.match(python,/Los cambios de datos/);
});

test('V69: test cubre cliente, segundo cliente, admin y operario',()=>{
  for(const part of ['CUSTOMER','OTHER','OPERATOR','ADMIN','REPARADO_V66_PREFERRED_DATE_PAST',
    'client_submission_id','quoted','accepted','scheduled','in_progress','completed',
    'accepted_price','accepted_at','ROLLBACK']){
    assert.ok(python.includes(part),part);
  }
  assert.ok(python.includes('with as_identity(db,CUSTOMER)'));
  assert.ok(python.includes('with as_identity(db,OTHER)'));
  assert.ok(python.includes('with as_identity(db,OPERATOR)'));
  assert.ok(python.includes('with as_identity(db,ADMIN)'));
});

test('V69: auditoría de cuentas solo lectura, sin datos personales',()=>{
  const plain=sql.replace(/--[^\n]*/g,'').replace(/'(?:''|[^'])*'/g,"''");
  assert.match(plain,/^\s*with\s+expected\(/i);
  assert.doesNotMatch(plain,/\b(?:insert|update|delete|drop|create|alter|grant|revoke|truncate|call|execute)\b/i);
  for(const term of ['auth.users','email_confirmed_at','last_sign_in_at','invited_at','count(*)','resultado_accesos']){
    assert.ok(sql.includes(term),term);
  }
  assert.doesNotMatch(sql,/select\s+u\.email\b/i);
});

test('V69: entorno CI aislado y documento distingue pruebas simuladas de accesos reales',()=>{
  assert.match(workflow,/postgres:16/);
  assert.match(workflow,/tests\/supabase-roles-rls\.py/);
  assert.match(workflow,/tests\/full-role-flow-v69\.py/);
  assert.match(workflow,/127\.0\.0\.1:5432\/reparado_test/);
  assert.match(doc,/JWT simulados/);
  assert.match(doc,/2 \| 2 \| 1/);
  assert.match(doc,/ROL(L)?BACK/i);
  assert.match(doc,/NO.*(?:producción|produccion)|No se conecta a Supabase real/i);
});
