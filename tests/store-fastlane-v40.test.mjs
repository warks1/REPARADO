import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fastlaneFiles,exportStoreMetadata} from '../scripts/export-store-metadata.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const data=JSON.parse(readFileSync(new URL('../store-metadata/es-ES.json',import.meta.url),'utf8'));
const files=fastlaneFiles(data);

test('V40: ocho metadatos nativos listos para las dos tiendas',()=>{
  const names=Object.keys(files);
  assert.equal(names.length,8);
  assert.equal(names.filter(x=>x.includes('/android/')).length,3);
  assert.equal(names.filter(x=>x.includes('/ios/')).length,5);
  assert.equal(files['fastlane/metadata/android/es-ES/full_description.txt'],data.platforms.google_play.full_description+'\n');
  assert.equal(files['fastlane/metadata/ios/es-ES/description.txt'],data.platforms.app_store.description+'\n');
  assert.equal(files['fastlane/metadata/ios/es-ES/keywords.txt'],data.platforms.app_store.keywords+'\n');
});

test('V40: los archivos confirmados coinciden exactamente con el catálogo fuente',()=>{
  assert.deepEqual(exportStoreMetadata(root,{check:true}),[]);
  for(const [relative,content] of Object.entries(files))
    assert.equal(readFileSync(resolve(root,relative),'utf8'),content,relative);
});

test('V40: falla ante textos largos o datos de una tienda incompatibles',()=>{
  const clone=()=>structuredClone(data);
  const wrong=clone();wrong.platforms.google_play.short_description='X'.repeat(81);
  assert.throws(()=>fastlaneFiles(wrong),/límite 80/);
  const longKeyword=clone();longKeyword.platforms.app_store.keywords='á'.repeat(51);
  assert.throws(()=>fastlaneFiles(longKeyword),/límite 100/);
  const html=clone();html.platforms.app_store.subtitle='<script>malicioso</script>';
  assert.throws(()=>fastlaneFiles(html),/HTML no permitido/);
  const mismatch=clone();mismatch.platforms.app_store.description+=' cambio';
  assert.throws(()=>fastlaneFiles(mismatch),/desincronizado/);
  assert.throws(()=>fastlaneFiles({...data,locale:'../../es-ES'}),/no admitido/);
});

test('V40: los metadatos no contienen secretos ni anuncios de publicación completada',()=>{
  for(const value of Object.values(files)){
    assert.doesNotMatch(value,/sb_secret_|service_role|P12_BASE64|KEYSTORE_PASSWORD/);
    assert.doesNotMatch(value,/publicad[ao] ya|disponible en App Store|24\/7|atención inmediata/i);
  }
});
