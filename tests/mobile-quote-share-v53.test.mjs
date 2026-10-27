import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shareAcceptedQuote} from '../mobile-quote-share.js';

const userId='00000000-0000-4000-8000-000000000001';
const id='00000000-0000-4000-8000-000000000003';
const nonce='00000000-0000-4000-8000-000000000004';
const record={id,service_name:'Sifón de cocina',accepted_at:'2026-10-26T12:00:00Z',accepted_price:121};
const ui=readFileSync(new URL('../connected.js',import.meta.url),'utf8');

function nativeMock({fails=null,onWrite=null}={}){
 const calls=[];
 let cleanup;
 return {
  calls,
  getNativeApis:async()=>({
    Directory:{Cache:'CACHE'},Encoding:{UTF8:'utf8'},
    Filesystem:{
      writeFile:async opts=>{calls.push(['write',opts]);onWrite?.();if(fails==='write')throw Error('Sin espacio')},
      getUri:async opts=>{calls.push(['uri',opts]);if(fails==='uri')throw Error('URI inválida');return {uri:'file:///cache/'+opts.path}},
      deleteFile:async opts=>{calls.push(['delete',opts])}
    },
    Share:{
      canShare:async()=>{calls.push(['canShare']);return {value:fails!=='unsupported'}},
      share:async opts=>{calls.push(['share',opts]);if(fails==='share')throw Error('Cancelado')}
    }
  }),
  scheduleCleanup:(cb,ms)=>{cleanup=cb;calls.push(['schedule',ms])},
  cleanup:async()=>{cleanup?.();await new Promise(resolve=>setImmediate(resolve))}
 };
}
const settings=(m,extra={})=>({
 userId,isSessionCurrent:x=>x===userId,isNative:()=>true,randomId:()=>nonce,
 getNativeApis:m.getNativeApis,scheduleCleanup:m.scheduleCleanup,...extra
});

test('V53: el navegador conserva el resumen HTML anterior',async()=>{
  const output=[];
  const result=await shareAcceptedQuote(record,{userId,isSessionCurrent:x=>x===userId,
    isNative:()=>false,webDownload:x=>output.push(x),
    getNativeApis:()=>{throw Error('No cargar nativo')}
  });
  assert.deepEqual(result,{mode:'browser'});
  assert.deepEqual(output,[record]);
});

test('V53: menú nativo recibe exclusivamente un fichero temporal sin nombre del cliente',async()=>{
  const m=nativeMock();
  const result=await shareAcceptedQuote(record,settings(m));
  assert.deepEqual(result,{mode:'native'});
  assert.deepEqual(m.calls.map(a=>a[0]),['canShare','write','uri','share','schedule']);
  const write=m.calls.find(x=>x[0]==='write')[1];
  assert.equal(write.directory,'CACHE');
  assert.equal(write.encoding,'utf8');
  assert.equal(write.path,'REPARADO-aceptacion-'+nonce+'.html');
  assert.match(write.data,/Resumen de aceptación de presupuesto/);
  assert.match(write.data,/No es una factura/);
  assert.match(write.data,/Sifón de cocina/);
  const share=m.calls.find(x=>x[0]==='share')[1];
  assert.deepEqual(share.files,['file:///cache/'+write.path]);
  assert.equal(share.text,undefined);
  assert.equal(m.calls.find(x=>x[0]==='schedule')[1],90000);
  await m.cleanup();
  assert.equal(m.calls.at(-1)[0],'delete');
});

test('V53: después de cambiar la cuenta no se abre el menú y se borra el archivo',async()=>{
  let active=true;
  const m=nativeMock({onWrite:()=>{active=false}});
  await assert.rejects(shareAcceptedQuote(record,settings(m,{
    isSessionCurrent:id=>id===userId&&active
  })),/No se pudo preparar/);
  assert.deepEqual(m.calls.map(a=>a[0]),['canShare','write','delete']);
});

test('V53: rehusar fecha o importe no aceptado, cuenta ajena y compartir no disponible',async()=>{
  for(const bad of [{...record,accepted_price:null},{...record,accepted_at:null},{...record,id:'invalido'}]){
    const m=nativeMock();
    await assert.rejects(shareAcceptedQuote(bad,settings(m)));
    assert.deepEqual(m.calls,[]);
  }
  const m=nativeMock({fails:'unsupported'});
  await assert.rejects(shareAcceptedQuote(record,settings(m)));
  assert.deepEqual(m.calls.map(x=>x[0]),['canShare']);
  const other=nativeMock();
  await assert.rejects(shareAcceptedQuote(record,settings(other,{userId:'00000000-0000-4000-8000-000000000002'})));
  assert.deepEqual(other.calls,[]);
});

test('V53: errores del sistema eliminan la copia temporal',async()=>{
  for(const fails of ['write','uri','share']){
    const m=nativeMock({fails});
    await assert.rejects(shareAcceptedQuote(record,settings(m)));
    assert.equal(m.calls.some(x=>x[0]==='delete'),fails!=='write');
  }
});

test('V53: la pantalla invalida solicitudes antiguas y no anuncia factura emitida',()=>{
  assert.match(ui,/const viewEpoch=authEpoch/);
  assert.match(ui,/await shareAcceptedQuote\(record/);
  assert.match(ui,/isSessionCurrent:current/);
  assert.match(ui,/authEpoch===viewEpoch/);
  assert.match(ui,/No es una factura ni una firma electrónica/);
});
