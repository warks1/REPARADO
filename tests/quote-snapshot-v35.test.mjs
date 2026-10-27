import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migration-v35.sql',import.meta.url),'utf8');
const app=readFileSync(new URL('../connected.js',import.meta.url),'utf8');

test('V35: aceptar conserva fecha y precio exacto en servidor',()=>{
  assert.match(sql,/add column if not exists accepted_at timestamptz/);
  assert.match(sql,/add column if not exists accepted_price numeric\(10,2\)/);
  assert.match(sql,/old\.status::text='quoted' and new\.status::text='accepted'/);
  assert.match(sql,/new\.accepted_at:=clock_timestamp\(\)/);
  assert.match(sql,/new\.accepted_price:=new\.price/);
  assert.match(sql,/REPARADO_V35_ACCEPTANCE_RECORD_IMMUTABLE/);
});
test('V35: la app muestra la constancia al dueño, sin datos inventados',()=>{
  assert.match(app,/price,accepted_at,accepted_price,street/);
  assert.match(app,/r\.accepted_at&&r\.accepted_price!=null/);
  assert.match(app,/class="quote-consent-proof"/);
  assert.match(app,/esc\(safeTime\(r\.accepted_at\)\)/);
});
test('V35: sin permisos de edición directa del consentimiento',()=>{
  assert.match(sql,/revoke update \(accepted_at,accepted_price\)/);
  assert.match(sql,/has_column_privilege\('authenticated','public\.service_requests','accepted_at','UPDATE'\)/);
  assert.match(sql,/drop trigger if exists reparado_record_quote_snapshot_v35/);
  assert.match(sql,/not tgisinternal/);
  assert.doesNotMatch(sql,/grant update \(accepted_at/);
});
