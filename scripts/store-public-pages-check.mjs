// REPARADO V48 · Comprobación pública y de solo lectura de enlaces de las tiendas.
// Una URL HTTPS bien formada NO implica que la política legal exista o sea válida.
// El objetivo es fallar antes de firmar cuando enlaces críticos no estén disponibles.
import {isIP} from 'node:net';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {storePreflight} from './store-preflight.mjs';

const MAX_HTML_BYTES=250_000;
const fields=[
  ['REPARADO_PRIVACY_URL','Política de privacidad',/privaci/i],
  ['REPARADO_SUPPORT_URL','Centro de soporte',/(ayuda|ajuda|soporte|atenci[oó]|support)/i],
  ['REPARADO_DELETE_ACCOUNT_URL','Eliminación de cuenta',/(elimin|esborr|delete|suprimir)/i]
];
const fail=(label,reason)=>({ok:false,label,reason});
const pass=label=>({ok:true,label,reason:'Accesible y reconocible'});

export function checkPublicPageUrl(raw){
  if(typeof raw!=='string')return null;
  let url;
  try{url=new URL(raw)}catch{return null}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname||
     url.hash||url.search||isIP(url.hostname)||url.hostname.length>253)
    return null;
  const host=url.hostname.toLowerCase();
  if(!host.includes('.')||/(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host)||
     host.endsWith('.example.com')||host.endsWith('.example.es')||
     /\s/.test(raw)||raw!==url.href)return null;
  return url;
}

export async function checkStorePublicPages(env={},fetchImpl=fetch){
  // Conservar todas las validaciones V47 antes de acceder a la red.
  const prelim=storePreflight(env);
  if(prelim.length)return {ok:false,checks:[fail('Configuración comercial','La configuración previa de la versión comercial no está aprobada.')]};
  const checks=[];
  const parsed=fields.map(([key,label,pattern])=>({url:checkPublicPageUrl(env[key]),label,pattern}));
  if(parsed.some(p=>!p.url))return {ok:false,checks:[fail('Direcciones públicas','Una o más direcciones públicas no cumplen los requisitos HTTPS.')]};
  if(new Set(parsed.map(p=>p.url.href)).size!==fields.length)
    return {ok:false,checks:[fail('Direcciones públicas','Privacidad, soporte y eliminación deben tener páginas diferenciadas.')]};

  for(const {url,label,pattern} of parsed){
    try{
      const result=await fetchImpl(url.href,{
        method:'GET',redirect:'error',
        headers:{accept:'text/html'},
        signal:AbortSignal.timeout(10000)
      });
      if(!result?.ok||result.status<200||result.status>=300){
        checks.push(fail(label,'No se recibió una página HTTP 200–299.'));
        continue;
      }
      const type=String(result.headers?.get?.('content-type')||'').toLowerCase();
      if(!type.includes('text/html')){
        checks.push(fail(label,'La respuesta no es una página HTML.'));
        continue;
      }
      const size=Number(result.headers?.get?.('content-length')||'0');
      if(size>MAX_HTML_BYTES){
        checks.push(fail(label,'La página supera el límite de comprobación.'));
        continue;
      }
      const body=await result.text();
      if(Buffer.byteLength(body,'utf8')>MAX_HTML_BYTES||body.length<120||
         !/<html[\s>]/i.test(body)||!/(reparado)/i.test(body)||!pattern.test(body)||
         /<title>\s*(404|not found|page not found)\b/i.test(body)){
        checks.push(fail(label,'La página no tiene contenido verificable de REPARADO.'));
        continue;
      }
      checks.push(pass(label));
    }catch{
      checks.push(fail(label,'La página no respondió de forma segura o tuvo un problema de conexión.'));
    }
  }
  return {ok:checks.length===3&&checks.every(c=>c.ok),checks};
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const result=await checkStorePublicPages(process.env);
  for(const item of result.checks){
    // No imprimir URL, query strings, claves, respuestas HTML ni datos del usuario.
    (item.ok?console.log:console.error)('REPARADO · '+item.label+': '+item.reason);
  }
  if(!result.ok)process.exitCode=1;
}
