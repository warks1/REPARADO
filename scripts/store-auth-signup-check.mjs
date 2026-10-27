// Verificación read-only de Supabase Auth ANTES de firmar para las tiendas.
// REPARADO se distribuye inicialmente solo mediante invitaciones: no aceptar
// registro abierto aunque la UI oculte el botón. No crea cuentas ni envía emails.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export async function checkStoreAuthSignup({url,key,fetchImpl=fetch}={}){
  if(typeof url!=='string'||typeof key!=='string'||!key.trim())
    return {ok:false,reason:'Falta la configuración pública de Auth.'};
  let origin;
  try{
    const parsed=new URL(url);
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||
       parsed.search||parsed.hash)
      return {ok:false,reason:'La URL de Auth no es una URL HTTPS de proyecto válida.'};
    origin=parsed.origin;
  }catch{return {ok:false,reason:'La URL de Auth no es válida.'}}

  try{
    const response=await fetchImpl(origin+'/auth/v1/settings',{
      method:'GET',redirect:'error',
      headers:{apikey:key,accept:'application/json'},
      signal:AbortSignal.timeout(10000)
    });
    if(!response?.ok)
      return {ok:false,reason:'No se ha podido consultar la configuración del servidor Auth.'};
    const settings=await response.json();
    // El booleano TRUE debe constar expresamente en el servidor; nunca
    // asumir que esconder el formulario bloquea las altas.
    if(settings?.disable_signup!==true)
      return {ok:false,reason:'El servidor Auth permite nuevas altas o no confirma que estén cerradas.'};
    if(settings?.external?.anonymous_users===true)
      return {ok:false,reason:'El servidor Auth permite cuentas anónimas.'};
    return {ok:true,reason:'Supabase Auth confirma que no admite altas públicas.'};
  }catch{
    return {ok:false,reason:'No se ha podido verificar Auth por red o formato de respuesta.'};
  }
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const result=await checkStoreAuthSignup({
    url:process.env.VITE_SUPABASE_URL,
    key:process.env.VITE_SUPABASE_ANON_KEY
  });
  if(result.ok)console.log('REPARADO: '+result.reason);
  else{
    // No imprimir URLs, tokens, respuestas remotas, ni datos de usuarios.
    console.error('REPARADO: publicación bloqueada. '+result.reason);
    process.exitCode=1;
  }
}
