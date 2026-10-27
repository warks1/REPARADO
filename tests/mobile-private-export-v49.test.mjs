import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sharePrivateDataExport} from '../mobile-private-export.js';

const USER='00000000-0000-4000-8000-000000000001';
const OTHER='00000000-0000-4000-8000-000000000002';
const NONCE='f7da3a4b-4944-4c44-8b1f-85d952e93bd8';
const exportData={aplicacion:'REPARADO',tipo:'Copia informativa de los datos propios visibles',
 usuario_id:USER,generado_el:'2026-10-27T09:10:00.000Z',
 datos:{perfil:{id:USER,phone:'600123456'},solicitudes:[{street:'Calle protegida'}]}};
const ui=readFileSync(new URL('../connected.js',import.meta.url),'utf8');

function nativeMock({fail=null,onWrite=null}={}){
  const calls=[];let cleanup=null;
  const api={
    Directory:{Cache:'CACHE'},Encoding:{UTF8:'utf8'},
    Filesystem:{
      writeFile:async options=>{calls.push(['write',options]);onWrite?.();if(fail==='write')throw Error('Disk full')},
      getUri:async options=>{calls.push(['uri',options]);if(fail==='uri')throw Error('No URI');return {uri:'file:///cache/'+options.path}},
      deleteFile:async options=>{calls.push(['delete',options]);return {}}
    },
    Share:{
      canShare:async()=>{calls.push(['canShare']);return {value:fail!=='no-share'}},
      share:async options=>{calls.push(['share',options]);if(fail==='share')throw Error('Error al compartir')}
    }
  };
  return {calls,getNativeApis:async()=>api,scheduleCleanup:(fn,ms)=>{cleanup=fn;calls.push(['cleanup-scheduled',ms]);},
    cleanup:async()=>{cleanup?.();await new Promise(resolve=>setImmediate(resolve))}};
}
const validOptions=(mock,more={})=>({
  userId:USER,isSessionCurrent:id=>id===USER,
  isNative:()=>true,
  randomId:()=>NONCE,
  getNativeApis:mock.getNativeApis,
  scheduleCleanup:mock.scheduleCleanup,...more
});

test('V49: web mantiene el archivo JSON y no carga plugins nativos',async()=>{
  const copies=[];
  const result=await sharePrivateDataExport(exportData,{
    userId:USER,isSessionCurrent:id=>id===USER,
    isNative:()=>false,
    webDownload:d=>copies.push(d),
    getNativeApis:()=>{throw Error('No debe cargar los plugins')}
  });
  assert.deepEqual(result,{mode:'browser'});
  assert.deepEqual(copies,[exportData]);
});

test('V49: solo comparte la copia propia mediante archivo único y caché temporal',async()=>{
  const m=nativeMock();
  const result=await sharePrivateDataExport(exportData,validOptions(m));
  assert.deepEqual(result,{mode:'native'});
  assert.deepEqual(m.calls.map(x=>x[0]),['canShare','write','uri','share','cleanup-scheduled']);
  const write=m.calls.find(x=>x[0]==='write')[1];
  assert.equal(write.directory,'CACHE');
  assert.equal(write.encoding,'utf8');
  assert.match(write.path,new RegExp('^REPARADO-datos-privados-'+NONCE+'\\.json$'));
  assert.deepEqual(JSON.parse(write.data).datos,exportData.datos);
  const opts=m.calls.find(x=>x[0]==='share')[1];
  assert.deepEqual(opts.files,['file:///cache/'+write.path]);
  assert.equal(opts.text,undefined);
  assert.equal(m.calls.find(x=>x[0]==='cleanup-scheduled')[1],90000);
  await m.cleanup();
  assert.equal(m.calls.at(-1)[0],'delete');
});

test('V49: abortar sesión cambiada antes de compartir y borrar el archivo',async()=>{
  let current=true;
  const m=nativeMock({onWrite:()=>{current=false}});
  await assert.rejects(sharePrivateDataExport(exportData,validOptions(m,{
    isSessionCurrent:id=>current&&id===USER
  })),/No se pudo compartir la copia/);
  assert.deepEqual(m.calls.map(x=>x[0]),['canShare','write','delete']);
});

test('V49: no ofrece datos a otras cuentas o con sesión caducada',async()=>{
  for(const settings of [
    {userId:OTHER,isSessionCurrent:()=>true},
    {userId:USER,isSessionCurrent:()=>false},
    {userId:USER,isSessionCurrent:()=>true,randomId:()=>'?'}
  ]){
    const m=nativeMock();
    await assert.rejects(sharePrivateDataExport(exportData,validOptions(m,settings)));
    assert.deepEqual(m.calls,[]);
  }
});

test('V49: borrar el archivo temporal si la app no lo comparte',async()=>{
  for(const fail of ['no-share','write','uri','share']){
    const m=nativeMock({fail});
    await assert.rejects(sharePrivateDataExport(exportData,validOptions(m)));
    const operations=m.calls.map(x=>x[0]);
    assert.equal(operations.includes('share'),fail==='share');
    if(['uri','share'].includes(fail))assert.equal(operations.at(-1),'delete');
    if(fail==='write')assert.equal(operations.includes('delete'),false);
  }
});

test('V49: interfaz controla doble clic, cambios de sesión y consentimiento explícito',()=>{
  assert.match(ui,/await sharePrivateDataExport\(snapshot/);
  assert.match(ui,/isSessionCurrent:stillOwner/);
  assert.match(ui,/if\(!stillOwner\(ownerId\)\)return;/);
  assert.match(ui,/personalDataButton\.disabled=true/);
  assert.match(ui,/Contiene datos privados; no la compartas con desconocidos/);
});
