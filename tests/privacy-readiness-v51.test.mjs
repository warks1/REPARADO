import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const text=name=>readFileSync(new URL('../docs/'+name,import.meta.url),'utf8');
const inventory=text('INVENTARIO-DATOS-V51.md');
const draft=text('POLITICA-PRIVACIDAD-BORRADOR-V51.md');
const stores=text('PUBLICAR-EN-TIENDAS.md');

test('V51: inventario refleja categorías reales con datos personales',()=>{
  for(const word of ['profiles','service_requests','messages','notifications',
    'device_tokens','customer_reviews','invoices','support_reports','Fotografías']){
    assert.match(inventory,new RegExp(word));
  }
  assert.match(inventory,/REPARADO Test/);
  assert.match(inventory,/PENDIENTE/);
  assert.doesNotMatch(inventory,/No recogemos datos personales/);
});
test('V51: borrador no finge tener datos fiscales, plazos o finalidad aprobada',()=>{
  assert.match(draft,/NO PUBLICAR/);
  assert.match(draft,/PENDIENTE: razón social/);
  assert.match(draft,/NIF\/CIF: \*\*\[PENDIENTE\]/);
  assert.match(draft,/base(?:s)? jur[ií]dica(?:s)?/i);
  assert.match(draft,/copias de seguridad/);
  assert.match(draft,/derechos/);
  assert.match(draft,/reparado_soporte@outlook\.es/);
});
test('V51: la ficha comercial debe conservar el bloqueo hasta aprobación legal',()=>{
  assert.match(stores,/INVENTARIO-DATOS-V51\.md/);
  assert.match(stores,/POLITICA-PRIVACIDAD-BORRADOR-V51\.md/);
  assert.match(stores,/no se sirve desde la web pública/i);
  assert.equal(existsSync(new URL('../public/POLITICA-PRIVACIDAD-BORRADOR-V51.md',import.meta.url)),false);
});
