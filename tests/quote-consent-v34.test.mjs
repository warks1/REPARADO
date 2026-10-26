import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migration-v34.sql',import.meta.url),'utf8');

test('V34: aceptar exige importe mostrado, no solo el ID',()=>{
 assert.match(src,/supabase\.rpc\('accept_reparado_quote',\{p_request_id:button\.dataset\.acceptQuote,p_expected_price:valid\.total\}\)/);
 assert.match(src,/if\(!valid\)/);
 assert.match(src,/window\.confirm\(/);
 assert.match(sql,/price=p_expected_price/);
 assert.match(sql,/and customer_id=user_id/);
 assert.match(sql,/and status='quoted'/);
});
test('V34: deshabilitar endpoint heredado que permitía aceptar sin cantidad',()=>{
 assert.match(sql,/revoke all on function public\.accept_reparado_quote\(uuid\)/);
 assert.match(sql,/grant execute on function public\.accept_reparado_quote\(uuid,numeric\)/);
 assert.match(sql,/to authenticated/);
 assert.match(sql,/p_expected_price numeric/);
});
test('V34: estado aceptado no permite alterar importe ni fingir aceptación admin',()=>{
 assert.match(sql,/old\.status::text in \('accepted','scheduled','in_progress','completed'\)/);
 assert.match(sql,/new\.price is distinct from old\.price/);
 assert.match(sql,/REPARADO_ACCEPTED_QUOTE_PRICE_LOCKED/);
 assert.match(sql,/REPARADO_ACCEPTANCE_REQUIRES_CUSTOMER/);
 assert.match(src,/No puedes cambiar el importe de un presupuesto ya aceptado/);
 assert.match(src,/Solo el cliente puede aceptar su presupuesto/);
});
test('V34: no cambia reseñas, facturación ni apertura pública por aplicar migración',()=>{
 assert.ok(!sql.includes('grant select on public.service_requests to anon'));
 assert.ok(!sql.includes('alter table public.invoices'));
 assert.ok(!sql.includes('update public.customer_reviews'));
 assert.ok(!sql.includes('insert into public.service_requests'));
});
