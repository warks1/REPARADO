// REPARADO V83 · Control de acceso anónimo sobre la API real de producción.
// Solo GET con limit=0: nunca pide filas ni datos de personas, no muta nada.
// Exige GRANT SELECT revocado al rol anon en las seis tablas privadas V11.
// Complementa, pero NO sustituye, la auditoría RLS con sesiones reales.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {checkPublicConfig} from './check-public-config.mjs';

export const storePrivateTables=Object.freeze([
  'profiles','service_requests','messages',
  'notifications','device_tokens','invoices'
]);

export async function checkStorePrivateApi({url,key,fetchImpl=fetch}={}){
  if(typeof url!=='string'||typeof key!=='string'||!url.trim()||!key.trim()||
     checkPublicConfig(url,key))
    return {ok:false,reason:'Configuración pública de producción no válida.'};
  const origin=new URL(url).origin;
  const probe=async(table)=>{
    const target=origin+'/rest/v1/'+table+'?select=id&limit=0';
    const response=await fetchImpl(target,{
      method:'GET',redirect:'error',
      headers:{apikey:key,accept:'application/json'},
      signal:AbortSignal.timeout(10000)
    });
    return response;
  };
  try{
    // La lectura de reseñas APROBADAS se admite por la política pública V13.
    // Una respuesta 200 confirma que la Data API y la clave están operativas
    // antes de interpretar un 401/403 en tablas privadas.
    const publicResponse=await probe('customer_reviews');
    if(publicResponse?.status!==200)
      return {ok:false,reason:'La API pública de reseñas no está disponible; revisar migraciones y clave.'};

    for(const table of storePrivateTables){
      const response=await probe(table);
      // Una tabla ausente, error general, redirección o respuesta 200 con
      // cero filas NO acredita privacidad; requerimos privilegio revocado.
      if(!response||![401,403].includes(response.status))
        return {ok:false,reason:'No se confirmó el bloqueo de lectura anónima en '+table+'.'};
      const error=await response.json();
      if(error?.code!=='42501')
        return {ok:false,reason:'La API no confirmó la revocación SELECT anónima en '+table+'.'};
    }
    return {ok:true,reason:'API accesible; lectura anónima denegada en seis tablas privadas.'};
  }catch{
    return {ok:false,reason:'No se pudo comprobar el acceso anónimo por red o respuesta inválida.'};
  }
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const result=await checkStorePrivateApi({
    url:process.env.VITE_SUPABASE_URL,
    key:process.env.VITE_SUPABASE_ANON_KEY
  });
  if(result.ok)console.log('REPARADO: '+result.reason);
  else{
    // No imprimir URLs, claves, cabeceras, ni cuerpos de respuestas.
    console.error('REPARADO: firma de tienda bloqueada. '+result.reason);
    process.exitCode=1;
  }
}
