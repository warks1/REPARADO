import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storePreflight} from '../scripts/store-preflight.mjs';
import {androidApiLevel,signingGradle} from '../scripts/configure-android-release.mjs';

const valid={
 VITE_SUPABASE_URL:'https://reparado-production-example.supabase.co',
 VITE_SUPABASE_ANON_KEY:'sb_publishable_TEST_PUBLIC_VALUE',
 REPARADO_PRIVACY_URL:'https://reparado.example.es/privacidad',
 REPARADO_SUPPORT_URL:'https://reparado.example.es/contacto',
 REPARADO_DELETE_ACCOUNT_URL:'https://reparado.example.es/eliminar-cuenta',
 REPARADO_PRODUCTION_APPROVED:'true'
};
test('tiendas rechazan la aplicación demo sin backend de producción',()=>{
 assert.ok(storePreflight({}).some(x=>x.includes('PRODUCCIÓN')));
});
test('bloquear REPARADO Test, URLs inseguras y claves de servicio',()=>{
 assert.ok(storePreflight({...valid,VITE_SUPABASE_URL:'https://kpmmlzjvespenogqtujo.supabase.co'}).length);
 assert.ok(storePreflight({...valid,VITE_SUPABASE_ANON_KEY:'sb_secret_NO'}).length);
 assert.ok(storePreflight({...valid,REPARADO_DELETE_ACCOUNT_URL:'http://unsafe.invalid/delete'}).length);
 assert.equal(storePreflight(valid).length,0);
});
test('requiere confirmación de revisión operativa y política de privacidad',()=>{
 assert.ok(storePreflight({...valid,REPARADO_PRODUCTION_APPROVED:'false'}).length);
 assert.ok(storePreflight({...valid,REPARADO_PRIVACY_URL:''}).length);
 assert.ok(storePreflight({...valid,REPARADO_SUPPORT_URL:''}).length);
});
test('Google Play genera configuración de firma AAB y exige API 36',()=>{
 assert.equal(androidApiLevel('targetSdkVersion = 36'),36);
 assert.equal(androidApiLevel('targetSdkVersion=35'),35);
 assert.equal(androidApiLevel('other=36'),null);
 const gradle=signingGradle();
 assert.ok(gradle.includes('signingConfigs.reparadoStore'));
 assert.ok(gradle.includes('REPARADO_ANDROID_KEYSTORE_PASSWORD'));
 assert.ok(gradle.includes('versionCode'));
});
test('iOS y Android solo se distribuyen con firmas y entornos protegidos',()=>{
 const yaml=readFileSync(new URL('../.github/workflows/store-release.yml',import.meta.url),'utf8');
 assert.ok(yaml.includes('workflow_dispatch:'));
 assert.ok(yaml.includes('environment: store-release'));
 assert.ok(yaml.includes('bundleRelease'));
 assert.ok(yaml.includes('jarsigner -verify'));
 assert.ok(yaml.includes('xcodebuild archive'));
 assert.ok(yaml.includes('xcodebuild -exportArchive'));
 assert.ok(yaml.includes('node scripts/store-preflight.mjs'));
 assert.ok(!yaml.includes('assembleDebug'));
});
test('el cliente incluye el mecanismo de solicitud de borrado',()=>{
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 const sql=readFileSync(new URL('../supabase/migration-store-account-deletion.sql',import.meta.url),'utf8');
 assert.ok(code.includes('request-account-deletion'));
 assert.ok(code.includes(".from('account_deletion_requests').insert({user_id:userId})"));
 assert.ok(sql.includes('enable row level security'));
 assert.ok(sql.includes('grant insert(user_id)'));
 assert.ok(sql.includes('user_id=(select auth.uid())'));
 assert.ok(!sql.includes('grant delete'));
});
