import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=relative=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const plist=file('native/ios/PrivacyInfo.xcprivacy');
const installer=file('scripts/install-ios-privacy.py');
const linker=file('scripts/link-ios-privacy.rb');
const simulator=file('.github/workflows/ios-simulator.yml');
const candidate=file('.github/workflows/store-candidate-preflight.yml');
const release=file('.github/workflows/store-release.yml');

test('V47: manifiesto Apple declara FileTimestamp con motivo oficial',()=>{
  assert.match(plist,/<string>NSPrivacyAccessedAPICategoryFileTimestamp<\/string>/);
  assert.match(plist,/<string>C617\.1<\/string>/);
  assert.match(plist,/<key>NSPrivacyAccessedAPITypes<\/key>/);
  assert.doesNotMatch(plist,/NSPrivacyCollectedDataTypes|NSPrivacyTracking/);
});

test('V47: la declaración se incorpora al target App y se verifica dentro del bundle',()=>{
  assert.match(installer,/def merge_manifest\(/);
  assert.match(installer,/plistlib\.loads/);
  assert.match(installer,/def verify_bundle\(/);
  assert.match(linker,/Xcodeproj::Project\.open/);
  assert.match(linker,/resources_build_phase\.add_file_reference/);
  assert.match(linker,/project\.save/);
  for(const yaml of [simulator,candidate,release]){
    assert.match(yaml,/python3 scripts\/install-ios-privacy\.py\s*\n/);
    assert.match(yaml,/ruby scripts\/link-ios-privacy\.rb/);
    assert.match(yaml,/install-ios-privacy\.py --verify-bundle/);
    assert.ok(yaml.indexOf('python3 scripts/install-ios-privacy.py')<yaml.indexOf('xcodebuild archive')||
      (yaml===simulator&&yaml.indexOf('python3 scripts/install-ios-privacy.py')<yaml.indexOf('xcodebuild \\')));
  }
  assert.match(candidate,/test -d "\$RUNNER_TEMP\/Reparado-Test\.xcarchive\/Products\/Applications\/App\.app"/);
  assert.match(release,/Reparado\.xcarchive\/Products\/Applications\/App\.app/);
});
test('V47: flujo de compilación continúa cerrado a producción no validada',()=>{
  assert.match(release,/node scripts\/store-preflight\.mjs/);
  assert.match(release,/node scripts\/store-auth-signup-check\.mjs/);
  assert.match(release,/environment: store-release/);
  assert.match(candidate,/FALLO DE SEGURIDAD: permitida versión demo en tienda/);
  assert.match(simulator,/CODE_SIGNING_ALLOWED=NO/);
});
