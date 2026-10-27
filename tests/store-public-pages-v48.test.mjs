import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkPublicPageUrl,checkStorePublicPages} from '../scripts/store-public-pages-check.mjs';

const vars={
  VITE_SUPABASE_URL:'https://reparado-empresa.supabase.co',
  VITE_SUPABASE_ANON_KEY:'sb_publishable_PUBLIC_TEST_ONLY',
  REPARADO_PRODUCTION_APPROVED:'true',
  REPARADO_PRIVACY_URL:'https://www.reparado-servicios.cat/privacidad',
  REPARADO_SUPPORT_URL:'https://www.reparado-servicios.cat/soporte',
  REPARADO_DELETE_ACCOUNT_URL:'https://www.reparado-servicios.cat/eliminar-cuenta'
};
const contents={
  privacidad:'<html lang="es"><title>REPARADO · Política de privacidad</title><body><h1>Privacidad REPARADO</h1><p>Información detallada sobre el tratamiento de datos personales en REPARADO y la política de privacidad. '.repeat(4)+'</p></body></html>',
  soporte:'<html lang="es"><title>REPARADO · Centro de ayuda</title><body><h1>Soporte y ayuda REPARADO</h1><p>Canal para problemas, consultas y asistencia de la app. '.repeat(5)+'</p></body></html>',
  'eliminar-cuenta':'<html lang="es"><title>REPARADO · Eliminar cuenta</title><body><h1>Eliminación de cuenta REPARADO</h1><p>Solicita eliminar tu cuenta y datos asociados desde el centro de soporte. '.repeat(5)+'</p></body></html>'
};
const mock=(overrides={})=>async(url,options)=>{
  const key=new URL(url).pathname.slice(1);
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'error');
  const override=overrides[key]||{};
  if(override.throw)throw new Error('red offline');
  const html=override.body??contents[key];
  return {
    ok:override.ok??true,status:override.status??200,
    headers:{get:(k)=> k==='content-type'?(override.type??'text/html; charset=utf-8'):
      k==='content-length'?(override.length??String(Buffer.byteLength(html,'utf8'))):null},
    text:async()=>html
  };
};

test('V48: comprueba las tres páginas reales sin enviar datos ni registrar secretos',async()=>{
  const out=await checkStorePublicPages(vars,mock());
  assert.equal(out.ok,true);
  assert.deepEqual(out.checks.map(x=>x.label),['Política de privacidad','Centro de soporte','Eliminación de cuenta']);
  assert.ok(out.checks.every(c=>c.ok));
  assert.ok(!JSON.stringify(out).includes(vars.VITE_SUPABASE_ANON_KEY));
  assert.ok(!JSON.stringify(out).includes('www.reparado-servicios.cat'));
});

test('V48: páginas caídas, PDF, 404 o placeholder bloquean distribución comercial',async()=>{
  const failures=[
    {privacidad:{ok:false,status:404}},
    {soporte:{type:'application/pdf'}},
    {'eliminar-cuenta':{throw:true}},
    {privacidad:{body:'<html><title>404 Not Found</title></html>'}},
    {soporte:{body:'<html><title>Sin contenidos</title><p>REPARADO página en construcción</p></html>'}},
    {privacidad:{length:'500000'}},
    {privacidad:{body:'<html><title>Política de privacidad</title><p>Otros servicios sin relación con esta app'.repeat(15)+'</html>'}}
  ];
  for(const failure of failures){
    const result=await checkStorePublicPages(vars,mock(failure));
    assert.equal(result.ok,false,JSON.stringify(failure));
  }
});

test('V48: nunca solicita direcciones duplicadas, inseguras ni marcadores de ejemplo',async()=>{
  for(const path of [
    'http://reparado-servicios.cat/privacidad',
    'https://localhost/privacidad',
    'https://127.0.0.1/privacidad',
    'https://[::1]/privacidad',
    'https://reparado.example.es/privacidad',
    'https://reparado-servicios.cat:444/privacidad',
    'https://usuario:pass@reparado-servicios.cat/privacidad',
    'https://reparado-servicios.cat/privacidad?token=privado',
    'https://reparado-servicios.cat/privacidad#personal'
  ])assert.equal(checkPublicPageUrl(path),null,path);
  let called=false;
  const wrong=await checkStorePublicPages({...vars,REPARADO_DELETE_ACCOUNT_URL:vars.REPARADO_SUPPORT_URL},async()=>{called=true;throw Error('no fetch')});
  assert.equal(wrong.ok,false);assert.equal(called,false);
  assert.equal((await checkStorePublicPages({})).ok,false);
});

test('V48: los dos flujos de firma consultan las páginas antes de generar artefactos',()=>{
  const yaml=readFileSync(new URL('../.github/workflows/store-release.yml',import.meta.url),'utf8');
  assert.equal((yaml.match(/node scripts\/store-public-pages-check\.mjs/g)||[]).length,2);
  assert.ok(yaml.indexOf('node scripts/store-public-pages-check.mjs')<yaml.indexOf('bundleRelease'));
  assert.ok(yaml.indexOf('node scripts/store-public-pages-check.mjs')<yaml.indexOf('xcodebuild archive'));
  assert.match(yaml,/environment: store-release/);
  assert.match(yaml,/node scripts\/store-auth-signup-check\.mjs/);
});
