import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serviceAreaIssue,serviceAreaNoticeMarkup} from '../service-area.js';

test('V65: admite las cuatro provincias catalanas y conserva ceros iniciales',()=>{
  for(const [postal,city] of [
    ['08001','Barcelona'],['08210','Barberà del Vallès'],
    ['17001','Girona'],['17230','Palamós'],
    ['25001','Lleida'],['25530','Vielha'],
    ['43001','Tarragona'],['43840','Salou']
  ]) assert.equal(serviceAreaIssue(postal,city),null,postal+' '+city);
  assert.equal(serviceAreaIssue(' 08001 ',' Barcelona '),null);
});

test('V65: solo códigos de cinco dígitos de 08, 17, 25 y 43',()=>{
  for(const postal of ['28001','46001','50001','07001','01001','00000']){
    assert.match(serviceAreaIssue(postal,'Barcelona'),/Cataluña/,postal);
  }
  for(const postal of ['801','0800','08A01','17-001','43001x','+43001','  ','８００１']){
    assert.match(serviceAreaIssue(postal,'Tarragona'),/cinco cifras/,postal);
  }
});

test('V65: detecta capital de provincia incoherente, pero no presume validar todas las localidades',()=>{
  for(const [postal,city] of [
    ['17001','Barcelona'],['08001','Girona'],['25001','Tarragona'],
    ['43001','Lleida'],['08001','Gerona'],['43001','Lérida']
  ])assert.match(serviceAreaIssue(postal,city),/provincias distintas/,postal+city);
  assert.equal(serviceAreaIssue('08001','Sant Pere'),null);
  assert.match(serviceAreaIssue('08001',''),/municipio/);
  assert.match(serviceAreaIssue('08001','A'),/municipio/);
  assert.match(serviceAreaIssue('08001','x'.repeat(91)),/municipio/);
});

test('V65: formularios conectados y locales validan antes de guardar',()=>{
  const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  const local=readFileSync(new URL('../local-preview.js',import.meta.url),'utf8');
  for(const source of [connected,local]){
    assert.match(source,/serviceAreaNoticeMarkup\(\)/);
    assert.match(source,/serviceAreaIssue\(/);
    assert.match(source,/name="postal_code"/);
    assert.match(source,/name="city"/);
  }
  assert.ok(connected.indexOf("serviceAreaIssue(fields.get('postal_code')")<
    connected.indexOf('submitRepairRequest({supabase,payload,submissionId})'));
  assert.ok(local.indexOf("serviceAreaIssue(data.get('postal_code')")<
    local.indexOf('requests.unshift('));
  assert.doesNotMatch(connected,/name="city" value="Barcelona"/);
  const localRequestSource=local.slice(local.indexOf('function request(item)'),local.indexOf('function requestListItem'));
  assert.ok(localRequestSource.includes("esc(p.city||'')"));
  assert.doesNotMatch(localRequestSource,/p\.city\|\|'Barcelona'/);
});

test('V65: restricción PostgreSQL en servidor y preflight histórico',()=>{
  const sql=readFileSync(new URL('../supabase/migration-v65-service-area.sql',import.meta.url),'utf8');
  assert.match(sql,/check\s*\(/i);
  assert.match(sql,/reparado_catalonia_area_v65/);
  assert.match(sql,/postal_code ~ '\^\(08\|17\|25\|43\)/);
  assert.match(sql,/REPARADO_V65_REVIEW_EXISTING_ADDRESSES/);
  assert.match(sql,/REPARADO_V65_REQUIRES_REQUESTS_RLS/);
  assert.match(sql,/convalidated/);
  assert.doesNotMatch(sql,/\b(?:delete from|truncate|drop table|disable row level security)\b/i);
});

test('V65: no se promete comprobar el código postal exacto ni reservar citas',()=>{
  const notice=serviceAreaNoticeMarkup();
  assert.match(notice,/Barcelona \(08\)/);
  assert.match(notice,/Girona \(17\)/);
  assert.match(notice,/Lleida \(25\)/);
  assert.match(notice,/Tarragona \(43\)/);
  assert.match(notice,/disponibilidad/);
});
