import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindWorkPhotoRetry} from '../work-photo-recovery.js';

const path='a0000000-0000-4000-8000-000000000001/' +
  'b0000000-0000-4000-8000-000000000002/foto-'+('ab'.repeat(32))+'.jpg';

function preview({sign=async()=>({data:{signedUrl:'https://private.example/signed-new'},error:null})}={}){
  let errorHandler,signCalls=0,failures=0,active=true;
  const image={isConnected:true,src:'https://private.example/signed-old',
    addEventListener(type,fn){assert.equal(type,'error');errorHandler=fn}};
  const link={isConnected:true,href:image.src,
    remove(){this.isConnected=false;image.isConnected=false}};
  const gallery={};
  const store={async createSignedUrl(...args){
    signCalls++;
    assert.deepEqual(args,[path,120]);
    return sign();
  }};
  bindWorkPhotoRetry({image,link,gallery,store,path,isActive:()=>active,
    onUnavailable:to=>{
      assert.equal(to,gallery);
      failures++;
    }});
  return {image,link,gallery,failed:()=>failures,calls:()=>signCalls,
    trigger:async()=>{await errorHandler()},
    deactivate:()=>{active=false}};
}

test('V108: un enlace caducado se firma de nuevo una vez y renueva imagen y enlace',async()=>{
  const p=preview();
  await p.trigger();
  assert.equal(p.calls(),1);
  assert.equal(p.image.src,'https://private.example/signed-new');
  assert.equal(p.link.href,'https://private.example/signed-new');
  assert.equal(p.failed(),0);
  // Si tampoco carga la URL renovada, no se entra en bucle.
  await p.trigger();
  await p.trigger();
  assert.equal(p.calls(),1);
  assert.equal(p.failed(),1);
  assert.equal(p.link.isConnected,false);
});

test('V108: no presenta un enlace vencido como foto disponible si falla la firma',async()=>{
  const p=preview({sign:async()=>({error:{message:'sin permiso'},data:null})});
  await p.trigger();
  assert.equal(p.calls(),1);
  assert.equal(p.failed(),1);
  assert.equal(p.link.isConnected,false);
});

test('V108: tolera excepciones de red sin reintentos infinitos',async()=>{
  const p=preview({sign:async()=>{throw Error('offline')}});
  await p.trigger();
  assert.equal(p.failed(),1);
  await p.trigger();
  assert.equal(p.calls(),1);
});

test('V108: una sesión cerrada no solicita URLs privadas',async()=>{
  const p=preview();
  p.deactivate();
  await p.trigger();
  assert.equal(p.calls(),0);
  assert.equal(p.failed(),0);
});

test('V108: no modifica un DOM desconectado después de esperar la firma',async()=>{
  let respond;
  const pending=new Promise(resolve=>{respond=resolve});
  const p=preview({sign:()=>pending});
  const first=p.trigger();
  p.image.isConnected=false;
  p.link.isConnected=false;
  respond({data:{signedUrl:'https://private.example/signed-new'},error:null});
  await first;
  assert.equal(p.link.href,'https://private.example/signed-old');
  assert.equal(p.failed(),0);
});

test('V108: el módulo se integra antes de asignar la URL y conserva Storage privado',()=>{
  const src=readFileSync(new URL('../operator-work-view.js',import.meta.url),'utf8');
  assert.match(src,/import \{bindWorkPhotoRetry\} from '\.\/work-photo-recovery\.js'/);
  const bindAt=src.indexOf('bindWorkPhotoRetry({');
  assert.ok(bindAt>0);
  assert.ok(src.indexOf('img.src=data.signedUrl;',bindAt)>bindAt);
  assert.match(src,/createSignedUrl\(path,120\)/);
  assert.doesNotMatch(src,/getPublicUrl\(/);
  assert.doesNotMatch(src,/createPublicUrl\(/);
});
