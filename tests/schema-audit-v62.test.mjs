import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/auditoria-readonly-v62-invoice-drafts.sql',import.meta.url),'utf8');

test('V62: la auditoría de producción es estrictamente de solo lectura',()=>{
  // No confundir palabras de etiquetas y literales SQL con instrucciones.
  const code=sql.replace(/--[^\n]*/g,'').replace(/'(?:''|[^'])*'/g,"''");
  assert.match(code,/^\s*with\s+checks\s+as\s*\(/i);
  assert.doesNotMatch(code,/\b(?:insert|update|delete|truncate|alter|create|drop|grant|revoke|copy|call|execute)\b/i);
  assert.match(code,/select\s+control\s*,\s*case\s+when\s+ok\s+then/i);
  assert.doesNotMatch(code,/\*/); // No consultar registros completos mediante SELECT *.
});

test('V62: catorce controles de permisos, RLS e integridad V60',()=>{
  const total=1+(sql.match(/union all select/gi)||[]).length;
  assert.equal(total,14);
  for(const term of ['invoice_drafts','reparado_save_invoice_draft',
    'is_reparado_admin','has_table_privilege','has_function_privilege',
    'relrowsecurity','service_requests','invoices','SECURITY DEFINER']){
    assert.ok(sql.toLowerCase().includes(term.toLowerCase()),'Falta cobertura '+term);
  }
});

test('V62: el informe diferencia Test, producción y emisión fiscal',()=>{
  const doc=readFileSync(new URL('../docs/ESTADO-REAL-V62-2026-11-03.md',import.meta.url),'utf8');
  assert.match(doc,/REPARADO Test/);
  assert.match(doc,/Supabase de producción/);
  assert.match(doc,/borradores no son facturas emitidas/i);
  assert.match(doc,/14\/14/);
  assert.match(doc,/GitHub Pages publicado NO equivale/);
});
