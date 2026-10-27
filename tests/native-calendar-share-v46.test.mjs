import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shareVisitCalendar} from '../mobile-calendar-share.js';

const id='10000000-0000-4000-8000-000000000003';
const visit={id,status:'scheduled',scheduled_at:'2026-11-01T16:00:00+01:00',service_name:'Revisión de grifo'};
const source=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
function mockNative({canShare=true,fail=null}={}){
  const calls=[];let cleanup;
  const directory={Cache:'CACHE'},encoding={UTF8:'utf8'};
  const Filesystem={
    async writeFile(args){calls.push(['write',args]);if(fail==='write')throw Error('No se puede escribir')},
    async getUri(args){calls.push(['uri',args]);if(fail==='uri')throw Error('No se puede obtener URI');return {uri:'file:///cache/'+args.path}},
    async deleteFile(args){calls.push(['delete',args]);return {}}
  };
  const Share={
    async canShare(){calls.push(['canShare']);return {value:canShare}},
    async share(opts){calls.push(['share',opts]);if(fail==='share')throw Error('Share failed');return {activityType:''}}
  };
  const getNativeApis=async()=>({Filesystem,Directory:directory,Encoding:encoding,Share});
  const scheduleCleanup=(cb,ms)=>{calls.push(['scheduledCleanup',ms]);cleanup=cb;return 1};
  return {calls,getNativeApis,scheduleCleanup,cleanup:()=>cleanup?.()};
}
test('V46: el navegador sigue descargando .ics sin solicitar plugins',async()=>{
  const sent=[];const result=await shareVisitCalendar(visit,{
    isNative:()=>false,
    webDownload:v=>sent.push(v),
    getNativeApis:()=>{throw Error('No debe cargar módulos nativos')}
  });
  assert.deepEqual(result,{mode:'browser'});
  assert.equal(sent.length,1);assert.equal(sent[0].id,id);
});
test('V46: iOS/Android comparte fichero .ics local en Cache y no revela datos personales',async()=>{
  const fake=mockNative();let web=false;
  const result=await shareVisitCalendar({...visit,phone:'600000000',street:'CALLE PRIVADA'},{
    isNative:()=>true,
    getNativeApis:fake.getNativeApis,
    scheduleCleanup:fake.scheduleCleanup,
    webDownload:()=>{web=true}
  });
  assert.deepEqual(result,{mode:'native'});
  assert.equal(web,false);
  assert.deepEqual(fake.calls.map(v=>v[0]),['canShare','write','uri','share','scheduledCleanup']);
  const write=fake.calls.find(c=>c[0]==='write')[1];
  assert.equal(write.directory,'CACHE');
  assert.equal(write.encoding,'utf8');
  assert.match(write.path,/^REPARADO-visita-[0-9a-f-]+\.ics$/);
  assert.match(write.data,/BEGIN:VCALENDAR/);
  assert.doesNotMatch(write.data,/600000000|CALLE PRIVADA/);
  const options=fake.calls.find(c=>c[0]==='share')[1];
  assert.deepEqual(options.files,['file:///cache/'+write.path]);
  assert.equal(options.text,undefined);
  assert.equal(fake.calls.find(c=>c[0]==='scheduledCleanup')[1],120000);
  await fake.cleanup();
  assert.equal(fake.calls.at(-1)[0],'delete');
});
test('V46: rechaza compartir si falta plugin, permiso o no hay archivo',async()=>{
  const notSupported=mockNative({canShare:false});
  await assert.rejects(shareVisitCalendar(visit,{isNative:()=>true,...notSupported}),/no se puede compartir/i);
  assert.deepEqual(notSupported.calls.map(x=>x[0]),['canShare']);
  const damaged=mockNative({fail:'uri'});
  await assert.rejects(shareVisitCalendar(visit,{isNative:()=>true,...damaged}),/URI/);
  assert.deepEqual(damaged.calls.map(x=>x[0]),['canShare','write','uri','delete']);
  const failed=mockNative({fail:'share'});
  await assert.rejects(shareVisitCalendar(visit,{isNative:()=>true,...failed}),/Share failed/);
  assert.deepEqual(failed.calls.map(x=>x[0]),['canShare','write','uri','share','delete']);
});
test('V46: visita inválida no abre ni siquiera plugins nativos',async()=>{
  let touched=false;
  await assert.rejects(shareVisitCalendar({...visit,status:'cancelled'},{
    isNative:()=>true,getNativeApis:()=>{touched=true;return {}}
  }),/no está programada/i);
  assert.equal(touched,false);
});
test('V46: la UI evita doble clic, sesiones antiguas y no anuncia importación confirmada',()=>{
  assert.match(source,/import \{shareVisitCalendar\} from '\.\/mobile-calendar-share\.js'/);
  assert.match(source,/button\.disabled=true;\s*try\{\s*const result=await shareVisitCalendar\(visit\)/);
  assert.match(source,/authEpoch!==epoch/);
  assert.match(source,/Elige tu calendario y confirma/);
  assert.doesNotMatch(source,/Cita guardada en tu calendario/);
});
