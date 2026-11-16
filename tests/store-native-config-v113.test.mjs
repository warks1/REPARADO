import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPushSessionManager} from '../push-session.js';

const file=r=>readFileSync(new URL('../'+r,import.meta.url),'utf8');

test('V113: Info.plist recibe permisos de cámara y fotos sin pisar valores previos',()=>{
 const dir=mkdtempSync(join(tmpdir(),'plist-'));
 const path=join(dir,'Info.plist');
 writeFileSync(path,'<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleName</key><string>App</string><key>NSCameraUsageDescription</key><string>Texto previo</string></dict></plist>');
 execFileSync('python3',['-I',new URL('../scripts/configure-ios-info.py',import.meta.url).pathname,path]);
 const out=readFileSync(path,'utf8');
 assert.match(out,/Texto previo/);
 assert.match(out,/NSPhotoLibraryUsageDescription/);
 assert.match(out,/ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
 assert.match(out,/CFBundleName/);
});

test('V113: los tres flujos iOS ejecutan configure-ios-info tras cap add ios',()=>{
 for(const f of ['ios-simulator','store-candidate-preflight','store-release']){
  const y=file(`.github/workflows/${f}.yml`);
  assert.ok(y.indexOf('scripts/configure-ios-info.py')>y.indexOf('npx cap add ios'),f);
 }
});

test('V113: el push nativo no se registra si está desactivado',async()=>{
 let registered=0;
 const manager=createPushSessionManager({
  supabase:{rpc:async()=>({data:true})},
  Capacitor:{isNativePlatform:()=>true,getPlatform:()=>'android'},
  PushNotifications:{requestPermissions:async()=>({receive:'granted'}),addListener:async()=>({remove:async()=>{}}),register:async()=>{registered++;}},
  enabled:false
 });
 assert.equal(await manager.activate('u1'),false);
 assert.equal(registered,0);
});

test('V113: connected.js solo activa push con VITE_REPARADO_PUSH_ENABLED=true y Dependabot existe',()=>{
 assert.match(file('connected.js'),/enabled:import\.meta\.env\?\.VITE_REPARADO_PUSH_ENABLED==='true'/);
 assert.match(file('.env.example'),/VITE_REPARADO_PUSH_ENABLED=false/);
 assert.match(file('.github/dependabot.yml'),/package-ecosystem: npm/);
});
