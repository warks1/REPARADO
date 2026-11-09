// REPARADO V83 · Control de acceso anónimo sobre la API real de producción.
// Solo GET con limit=0: nunca pide filas ni datos de personas, no muta nada.
// Exige SELECT anónimo denegado por cada columna privada conocida.
// Complementa, pero NO sustituye, la auditoría RLS con sesiones reales.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {checkPublicConfig} from './check-public-config.mjs';

// Columnas verificadas frente al esquema V4–V83 de REPARADO Test.
// Si una migración añade campos, actualizar este inventario; el control no
// certifica la privacidad de columnas nuevas desconocidas.
export const storePrivateColumns=Object.freeze({
  profiles:Object.freeze(['id','full_name','phone','role','created_at']),
  service_requests:Object.freeze([
    'id','customer_id','service_name','category','price','street','address_number',
    'postal_code','city','phone','preferred_date','scheduled_at','description',
    'status','operator_id','operator_name','created_at','client_submission_id',
    'accepted_at','accepted_price'
  ]),
  messages:Object.freeze(['id','customer_id','sender_id','body','created_at']),
  notifications:Object.freeze(['id','user_id','title','body','read','created_at']),
  device_tokens:Object.freeze(['id','user_id','token','platform','created_at']),
  invoices:Object.freeze([
    'id','request_id','customer_id','number','subtotal','vat',
    'total','status','pdf_path','created_at'
  ])
});
export const storePrivateTables=Object.freeze(Object.keys(storePrivateColumns));

export async function checkStorePrivateApi({url,key,fetchImpl=fetch}={}){
  if(typeof url!=='string'||typeof key!=='string'||!url.trim()||!key.trim()||
     checkPublicConfig(url,key))
    return {ok:false,reason:'Configuración pública de producción no válida.'};
  const origin=new URL(url).origin;
  const probe=async(table,column='id')=>{
    const target=origin+'/rest/v1/'+table+'?select='+column+'&limit=0';
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
      for(const column of storePrivateColumns[table]){
        const response=await probe(table,column);
        // Con GRANT SELECT(column) es posible exponer solo campos sueltos.
        // SELECT id denegado NO garantiza que phone, body o token lo estén.
        // Un 200 vacío, 404 o rechazo por clave inválida no son suficientes.
        if(!response||![401,403].includes(response.status))
          return {ok:false,reason:'No se confirmó la lectura privada de '+table+'.'+column+'.'};
        const error=await response.json();
        if(error?.code!=='42501')
          return {ok:false,reason:'Falta confirmar SELECT anónimo denegado en '+table+'.'+column+'.'};
      }
    }
    return {ok:true,reason:'API accesible y SELECT anónimo denegado en 51 columnas privadas conocidas.'};
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
