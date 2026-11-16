import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,createVerify} from 'node:crypto';
import {parseGoogleServices,withNotificationPermission} from '../scripts/configure-android-push.mjs';
import {signJwt,b64url,fcmMessage,apnsPayload,classifyFcm,classifyApns,isHexToken,clip} from '../supabase/functions/reparado-push-worker/lib.ts';

const file=r=>readFileSync(new URL('../'+r,import.meta.url),'utf8');
const script=r=>new URL('../'+r,import.meta.url).pathname;
const pem=(key)=>key.export({type:'pkcs8',format:'pem'});

test('V113: Info.plist recibe permisos de cámara y fotos sin pisar valores previos',()=>{
 const path=join(mkdtempSync(join(tmpdir(),'plist-')),'Info.plist');
 writeFileSync(path,'<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleName</key><string>App</string><key>NSCameraUsageDescription</key><string>Texto previo</string></dict></plist>');
 execFileSync('python3',['-I',script('scripts/configure-ios-info.py'),path]);
 const out=readFileSync(path,'utf8');
 assert.match(out,/Texto previo/);
 assert.match(out,/NSPhotoLibraryUsageDescription/);
 assert.match(out,/ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
});

test('V113: los tres flujos iOS ejecutan configure-ios-info tras cap add ios',()=>{
 for(const f of ['ios-simulator','store-candidate-preflight','store-release']){
  const y=file(`.github/workflows/${f}.yml`);
  assert.ok(y.indexOf('scripts/configure-ios-info.py')>y.indexOf('npx cap add ios'),f);
 }
});

test('V113: iOS crea entitlements aps-environment y los enlaza al target App',()=>{
 const path=join(mkdtempSync(join(tmpdir(),'ent-')),'App.entitlements');
 execFileSync('python3',['-I',script('scripts/configure-ios-push.py'),path,'production']);
 assert.match(readFileSync(path,'utf8'),/aps-environment<\/key>\s*<string>production<\/string>/);
 const rb=file('scripts/link-ios-push.rb');
 assert.match(rb,/CODE_SIGN_ENTITLEMENTS/);
 const y=file('.github/workflows/store-release.yml');
 assert.ok(y.indexOf('configure-ios-push.py')>y.indexOf('npx cap add ios'));
 assert.ok(y.indexOf('link-ios-push.rb')>y.indexOf('configure-ios-push.py'));
});

test('V113: Android exige google-services.json de com.ams.reparado en la compilación de tienda',()=>{
 const good=Buffer.from(JSON.stringify({project_info:{project_id:'p'},client:[{client_info:{android_client_info:{package_name:'com.ams.reparado'}}}]})).toString('base64');
 assert.equal(parseGoogleServices(good).project_info.project_id,'p');
 const other=Buffer.from(JSON.stringify({project_info:{project_id:'p'},client:[{client_info:{android_client_info:{package_name:'otra.app'}}}]})).toString('base64');
 assert.throws(()=>parseGoogleServices(other),/com\.ams\.reparado/);
 assert.throws(()=>parseGoogleServices('no-es-json'),/base64/);
 const manifest='<manifest xmlns:android="x" package="a">\n<application/></manifest>';
 const once=withNotificationPermission(manifest);
 assert.match(once,/POST_NOTIFICATIONS/);
 assert.equal(withNotificationPermission(once),once);
 const y=file('.github/workflows/store-release.yml');
 assert.match(y,/configure-android-push\.mjs --require/);
 assert.match(y,/REPARADO_GOOGLE_SERVICES_JSON_BASE64: \$\{\{ secrets\.REPARADO_GOOGLE_SERVICES_JSON_BASE64 \}\}/);
});

test('V113: JWT ES256 (APNs) y RS256 (FCM) se firman y verifican',async()=>{
 const ec=generateKeyPairSync('ec',{namedCurve:'P-256'});
 const jwt=await signJwt('ES256',{kid:'KEY123'},{iss:'TEAM',iat:1},pem(ec.privateKey));
 const [h,p,s]=jwt.split('.');
 assert.equal(JSON.parse(Buffer.from(h,'base64url')).kid,'KEY123');
 assert.equal(Buffer.from(s,'base64url').length,64);
 const v=createVerify('SHA256');v.update(h+'.'+p);
 assert.ok(v.verify({key:ec.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64url')));
 const rsa=generateKeyPairSync('rsa',{modulusLength:2048});
 const jwt2=await signJwt('RS256',{},{iss:'x@y',aud:'a'},pem(rsa.privateKey));
 const [h2,p2,s2]=jwt2.split('.');
 const v2=createVerify('RSA-SHA256');v2.update(h2+'.'+p2);
 assert.ok(v2.verify(rsa.publicKey,Buffer.from(s2,'base64url')));
 assert.equal(b64url('hola?>'),Buffer.from('hola?>').toString('base64url'));
});

test('V113: mensajes y clasificación de respuestas de FCM y APNs',()=>{
 const m=fcmMessage('tok','T','B');
 assert.equal(m.message.token,'tok');assert.equal(m.message.notification.title,'T');
 assert.equal(apnsPayload('T','B').aps.alert.body,'B');
 assert.equal(clip('x'.repeat(300),200).length,200);
 assert.equal(classifyFcm(200,''),'ok');
 assert.equal(classifyFcm(404,'{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}'),'invalid_token');
 assert.equal(classifyFcm(401,''),'config');
 assert.equal(classifyFcm(503,''),'retry');
 assert.equal(classifyApns(200,''),'ok');
 assert.equal(classifyApns(410,'{"reason":"Unregistered"}'),'invalid_token');
 assert.equal(classifyApns(400,'{"reason":"BadDeviceToken"}'),'invalid_token');
 assert.equal(classifyApns(403,'{"reason":"ExpiredProviderToken"}'),'config');
 assert.equal(classifyApns(429,'{"reason":"TooManyRequests"}'),'retry');
 assert.ok(isHexToken('a'.repeat(64)));assert.ok(!isHexToken('fcm:token-con-guion'));
});

test('V113: cola push solo para service_role y worker autenticado con secreto',()=>{
 const sql=file('supabase/migration-v113-push-outbox.sql');
 assert.match(sql,/revoke all on table public\.push_outbox from public,anon,authenticated/);
 assert.match(sql,/for update skip locked/);
 assert.match(sql,/after insert on public\.notifications/);
 assert.match(sql,/set search_path=pg_catalog,public/);
 const w=file('supabase/functions/reparado-push-worker/index.ts');
 assert.match(w,/constantTimeMatch\(request\.headers\.get\('x-reparado-worker-secret'\)/);
 assert.match(w,/secret\.length < 32/);
 assert.doesNotMatch(w,/console\.log/);
});

test('V113: el push ya no está desactivado y Dependabot existe',()=>{
 assert.doesNotMatch(file('connected.js'),/VITE_REPARADO_PUSH_ENABLED/);
 assert.doesNotMatch(file('.env.example'),/PUSH_ENABLED/);
 assert.match(file('.github/dependabot.yml'),/package-ecosystem: npm/);
});
