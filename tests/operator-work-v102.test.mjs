import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migration-v102-work-photo-quota.sql',import.meta.url),'utf8');
const view=readFileSync(new URL('../operator-work-view.js',import.meta.url),'utf8');
const service=readFileSync(new URL('../operator-work-service.js',import.meta.url),'utf8');

test('V102: ocho fotos se limitan en el servidor con bloqueo de concurrencia',()=>{
  assert.match(sql,/v_count<8/);
  assert.match(sql,/for update of w/i);
  assert.match(sql,/where o\.bucket_id='work-photos'/);
  assert.match(sql,/and o\.name like v_operator::text/);
  assert.match(sql,/work_photo_slot_available_v102\(name\)/);
  assert.match(sql,/drop policy if exists "reparado work photos upload"/);
  assert.match(sql,/create policy "reparado work photos upload"/);
  assert.match(sql,/for insert to authenticated/);
  assert.match(sql,/v_operator := auth\.uid\(\)/);
  assert.match(sql,/w\.operator_id=v_operator/);
  assert.match(sql,/r\.operator_id=v_operator/);
  assert.match(sql,/r\.status='in_progress'/);
});

test('V102: el helper con permisos elevados no está expuesto como RPC pública',()=>{
  assert.match(sql,/create schema if not exists reparado_private/);
  assert.match(sql,/revoke all on schema reparado_private from public, anon/);
  assert.match(sql,/language plpgsql volatile security definer/);
  assert.match(sql,/set search_path = pg_catalog, public, storage, pg_temp/);
  assert.match(sql,/revoke all on function reparado_private\.work_photo_slot_available_v102\(text\)/);
  assert.match(sql,/grant execute on function reparado_private\.work_photo_slot_available_v102\(text\)/);
  assert.doesNotMatch(sql,/create or replace function public\.work_photo_slot_available/i);
  assert.match(sql,/where o\.bucket_id='work-photos'/);
  assert.match(sql,/not public\)/);
});

test('V102: conserva formatos de imagen seguros, permisos y los cierres de V100',()=>{
  assert.match(sql,/storage\.filename\(name\) ~ '\^foto-/);
  assert.match(sql,/cardinality\(storage\.foldername\(name\)\)=2/);
  assert.match(sql,/and \(select public\.is_reparado_staff\(\)\)/);
  assert.match(sql,/w\.operator_id=\(select auth\.uid\(\)\)/);
  assert.match(sql,/and r\.status='in_progress'/);
  assert.match(service,/export const MAX_WORK_PHOTOS=8/);
  assert.match(service,/export async function completeOperatorWork/);
  assert.match(service,/export async function uploadOperatorWorkPhotos/);
});

test('V102: la cámara móvil y la galería comparten las comprobaciones de subida',()=>{
  assert.match(view,/data-work-camera/);
  assert.match(view,/capture="environment"/);
  assert.match(view,/data-work-files/);
  assert.match(view,/const uploadPictures=files=>transact/);
  assert.match(view,/uploadOperatorWorkPhotos\(/);
  assert.match(view,/event\.target\.files\?\.length/);
  assert.match(view,/data-work-photo-count/);
  assert.match(view,/data-work-finish/);
});

test('V102: la prueba de SQL termina en rollback y valida cliente y novena foto',()=>{
  const path=new URL('./work-photo-quota-v102.sql',import.meta.url);
  const check=readFileSync(path,'utf8');
  assert.match(check,/^begin;/i);
  assert.match(check,/\brollback;\s*$/i);
  assert.match(check,/REPARADO_V102_CUSTOMER_STARTED_WORK/);
  assert.match(check,/REPARADO_V102_NINTH_PHOTO_WAS_ALLOWED/);
  assert.match(check,/1\.\.8/);
});
