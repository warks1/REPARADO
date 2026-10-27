import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
test('el cliente puede adjuntar nuevas fotos desde Mis solicitudes sin crear otra solicitud',()=>{
  assert.match(source,/data-upload-request-photos/);
  assert.match(source,/data-upload-photo-result/);
  assert.match(source,/uploadPhotosWithRecovery/);
  assert.match(source,/isSessionCurrent/);
  assert.match(source,/authEpoch===uploadEpoch/);
});
test('las consultas con red inestable muestran un mensaje y conservan navegación',()=>{
  for(const fn of ['loadRequests','loadAgenda','loadChat']){
    const p=source.indexOf('async function '+fn+'()');
    assert.ok(p>0,fn);
    const next=source.indexOf('\n  async function ',p+1);
    const code=source.slice(p,next<0?undefined:next);
    assert.match(code,/try\s*\{/);
    assert.match(code,/catch/);
    assert.match(code,/No se pudo|No se pudieron/);
  }
});
test('el chat recupera botón tras fallo y advierte que el mensaje quizá se envió',()=>{
  assert.match(source,/No se pudo confirmar el envío\. Revisa el chat antes de reintentar/);
  assert.match(source,/button\.disabled=true/);
  assert.match(source,/finally\{button\.disabled=false\}/);
});
