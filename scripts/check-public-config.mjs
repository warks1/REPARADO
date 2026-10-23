// Protección de despliegue público: solo se conecta a proyectos Supabase alojados
// por Supabase y nunca al proyecto REPARADO Test ni a claves privadas.
// No registrar URLs completas ni valores de claves en los mensajes de error.
export function checkPublicConfig(urlRaw='',keyRaw='') {
  const url=String(urlRaw||'').trim();
  const key=String(keyRaw||'').trim();
  if(Boolean(url)!==Boolean(key))
    return 'La conexión está incompleta: configura URL y clave publicable a la vez.';
  if(!url)return null; // Pages sin backend: demostración local.
  let parsed;
  try{parsed=new URL(url)}catch{return 'La URL de Supabase no es válida.'}
  if(parsed.protocol!=='https:')return 'La URL de Supabase debe usar HTTPS.';
  const host=parsed.hostname.toLowerCase();
  if(host==='kpmmlzjvespenogqtujo.supabase.co')
    return 'REPARADO Test está reservado para un entorno privado; no publicarlo en GitHub Pages.';
  // Solo aceptar un subdominio directo de Supabase: evita que una URL maliciosa
  // reciba inicios de sesión y datos personales desde el cliente desplegado.
  if(!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.supabase\.co$/.test(host))
    return 'Solo se admiten proyectos alojados en Supabase para la web pública.';
  if(parsed.username||parsed.password||parsed.port||parsed.pathname!=='/'||parsed.search||parsed.hash)
    return 'La conexión debe ser la URL base de Supabase, sin credenciales, puertos, rutas ni parámetros.';
  if(key.startsWith('sb_secret_'))
    return 'No puede utilizarse una clave secreta de Supabase en una app pública.';
  if(key.startsWith('sb_publishable_'))return null;
  const segments=key.split('.');
  if(segments.length!==3)
    return 'Formato de clave inválido; utiliza la clave publicable de Supabase.';
  try{
    const claims=JSON.parse(Buffer.from(segments[1],'base64url').toString('utf8'));
    if(claims.role==='service_role'||claims.role==='supabase_admin')
      return 'Una clave de servidor no puede publicarse en Vite.';
    if(claims.role!=='anon')
      return 'Solo se admite una clave pública de rol anónimo.';
    if(claims.ref && claims.ref!==host.slice(0,-'.supabase.co'.length))
      return 'La clave anónima no pertenece al proyecto indicado.';
  }catch{return 'El token JWT no es válido; utiliza una clave publicable de Supabase.'}
  return null;
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  const error=checkPublicConfig(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY);
  if(error){console.error('Bloqueada publicación de REPARADO:',error);process.exit(1)}
  console.log('Configuración de publicación comprobada: '+(process.env.VITE_SUPABASE_URL?'modo conectado':'modo demostración local'));
}
