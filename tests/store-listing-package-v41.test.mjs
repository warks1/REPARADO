import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pack=load('.github/workflows/store-listing-package-v41.yml');
const release=load('.github/workflows/store-release.yml');
const preflight=load('.github/workflows/store-candidate-preflight.yml');

test('V41: descargar un único paquete de fichas con validación y artefacto',()=>{
  assert.match(pack,/workflow_dispatch:/);
  assert.match(pack,/npm run metadata:check/);
  assert.match(pack,/node --test tests\/store-metadata\.test\.mjs tests\/store-fastlane-v40\.test\.mjs/);
  assert.match(pack,/cp -R fastlane\/metadata/);
  assert.match(pack,/zip -q -r/);
  assert.match(pack,/unzip -t/);
  assert.match(pack,/actions\/upload-artifact@v4/);
  assert.match(pack,/REPARADO-Fichas-AppStore-GooglePlay-es-ES\.zip/);
  assert.doesNotMatch(pack,/secrets\.|REPARADO_STORE_SUPABASE|service_role|upload_to_play_store|fastlane deliver/);
});

test('V41: ni iOS ni Android permiten firmar con metadatos desactualizados',()=>{
  assert.equal((release.match(/npm run metadata:check/g)||[]).length,2);
  assert.ok(release.indexOf('npm run metadata:check')<release.indexOf('npm test'));
  assert.match(release,/node scripts\/store-preflight\.mjs/);
  assert.match(release,/environment: store-release/);
  assert.match(release,/xcodebuild archive/);
  assert.match(release,/bundleRelease/);
});

test('V41: el chequeo previo de tiendas también comprueba los textos',()=>{
  assert.match(preflight,/npm run metadata:check/);
  assert.ok(preflight.indexOf('npm run metadata:check')<preflight.indexOf('npm test'));
  assert.match(preflight,/FALLO DE SEGURIDAD: permitida versión demo en tienda/);
});
