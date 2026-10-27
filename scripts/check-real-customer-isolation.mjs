// REPARADO V50 · Verificación real de privacidad entre DOS cuentas de prueba.
// Solo SELECT/GET: no inserta registros, no invita usuarios ni lee claves secretas.
// Su ejecución es MANUAL, con dos cuentas cliente de REPARADO Test.
import {createClient} from '@supabase/supabase-js';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const EXPECTED_HOST='kpmmlzjvespenogqtujo.supabase.co';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLES=Object.freeze([
  {table:'service_requests',owner:'customer_id'},
  {table:'messages',owner:'customer_id'},
  {table:'notifications',owner:'user_id'},
  {table:'invoices',owner:'customer_id'}
]);
const OWN_ONLY=Object.freeze(['support_reports','account_deletion_requests']);

export function validateLiveTestEnv(env={}){
  let host;
  try{
    const u=new URL(env.REPARADO_TEST_SUPABASE_URL);
    if(u.protocol!=='https:'||u.username||u.password||u.port||
       u.pathname!=='/'||u.search||u.hash)throw Error('URL no segura');
    host=u.hostname;
  }catch{throw new Error('La URL de REPARADO Test no es válida.')}
  if(host!==EXPECTED_HOST)throw new Error('Esta verificación solo funciona en REPARADO Test, nunca producción.');
  const key=String(env.REPARADO_TEST_PUBLISHABLE_KEY||'');
  if(!key||key.startsWith('sb_secret_')||key.length>3000)
    throw new Error('Se requiere únicamente una clave publicable.');
  const pairs=[
    [String(env.REPARADO_TEST_CLIENT_A_EMAIL||''),String(env.REPARADO_TEST_CLIENT_A_PASSWORD||'')],
    [String(env.REPARADO_TEST_CLIENT_B_EMAIL||''),String(env.REPARADO_TEST_CLIENT_B_PASSWORD||'')]
  ];
  for(const [email,password] of pairs){
    if(!email.includes('@')||!password)throw new Error('Faltan las credenciales de dos clientes de prueba.');
  }
  if(pairs[0][0].toLowerCase()===pairs[1][0].toLowerCase())
    throw new Error('Se requieren dos cuentas de cliente distintas.');
  return {url:env.REPARADO_TEST_SUPABASE_URL,key,pairs};
}

const expectRows=async(query,label)=>{
  let result;
  try{result=await query}catch{throw new Error('Consulta privada fallida: '+label)}
  if(result?.error||!Array.isArray(result?.data))
    throw new Error('Consulta privada fallida: '+label);
  return result.data;
};

const userId=async client=>{
  let info;
  try{info=await client.auth.getUser()}catch{throw new Error('Autenticación del servidor no disponible.')}
  const id=info?.data?.user?.id;
  if(info?.error||!UUID.test(String(id||'')))throw new Error('No se verificó la identidad de cliente.');
  return id;
};

export async function verifyTestClientIsolation(clientA,clientB){
  const a=await userId(clientA), b=await userId(clientB);
  if(a===b)throw new Error('Las dos sesiones pertenecen a la misma cuenta.');
  let verifications=0,skipped=0;

  const getProfile=async(client,id)=>{
    let result;
    try{result=await client.from('profiles').select('id,role').eq('id',id).maybeSingle()}
    catch{throw new Error('No se pudo verificar el perfil propio.')}
    if(result?.error||result?.data?.id!==id||result.data.role!=='customer')
      throw new Error('La sesión no pertenece a una cuenta de cliente.');
    verifications++;
  };
  await getProfile(clientA,a);
  await getProfile(clientB,b);

  for(const [client,owner,other] of [[clientA,a,b],[clientB,b,a]]){
    // La existencia del perfil ajeno está garantizada por la autenticación de
    // la otra cuenta. Esta prueba de RLS no necesita sembrar datos de clientes.
    const forbiddenProfile=await expectRows(
      client.from('profiles').select('id').eq('id',other).limit(1),
      'perfil de otro cliente');
    if(forbiddenProfile.length)throw new Error('FALLO DE PRIVACIDAD: perfil ajeno visible.');
    verifications++;

    for(const {table,owner:field} of TABLES){
      const foreign=await expectRows(client.from(table).select('id').eq(field,other).limit(1),
        'datos ajenos en '+table);
      if(foreign.length)throw new Error('FALLO DE PRIVACIDAD en '+table);
      verifications++;
    }

    // Estas tablas ocultan user_id: consultar una fila visible del otro
    // cliente y probar explícitamente que esta sesión no puede leer su ID.
    for(const table of OWN_ONLY){
      const source=owner===a?clientB:clientA;
      const examples=await expectRows(source.from(table).select('id').limit(1),
        'filtro por RLS en '+table);
      if(!examples.length){skipped++;continue}
      const foreign=await expectRows(client.from(table).select('id')
        .eq('id',examples[0].id).limit(1),'fila ajena en '+table);
      if(foreign.length)throw new Error('FALLO DE PRIVACIDAD en '+table);
      verifications++;
    }
  }
  return {ok:true,verifications,skipped,scope:'REPARADO Test: consultas de solo lectura'};
}

async function authenticate(client,credentials){
  const {error,data}=await client.auth.signInWithPassword({
    email:credentials[0],password:credentials[1]
  });
  if(error||!data?.session)throw new Error('Inicio de sesión de prueba no disponible.');
}

export async function runLiveCheck(env=process.env,{factory=createClient}={}){
  const opts=validateLiveTestEnv(env);
  const clients=opts.pairs.map(()=>factory(opts.url,opts.key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  }));
  await authenticate(clients[0],opts.pairs[0]);
  await authenticate(clients[1],opts.pairs[1]);
  return verifyTestClientIsolation(clients[0],clients[1]);
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{
    const result=await runLiveCheck();
    // Solo contadores, nunca IDs, emails, contraseñas o contenido de tablas.
    console.log('REPARADO Test: '+result.verifications+' verificaciones aprobadas; '+
      result.skipped+' verificaciones sin datos suficientes.');
  }catch(error){
    // Mensaje genérico: la excepción puede contener datos proporcionados por SDKs.
    console.error('REPARADO Test: verificación privada fallida. Revisar cuentas, RLS y red.');
    process.exitCode=1;
  }
}
