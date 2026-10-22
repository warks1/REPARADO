// Protección de despliegue público: el proyecto privado de pruebas nunca va a Pages.
// No imprime tokens ni URLs internas salvo errores genéricos.
export function checkPublicConfig(urlRaw='',keyRaw=''){
 const url=String(urlRaw||'').trim(),key=String(keyRaw||'').trim();
 if(Boolean(url)!==Boolean(key))return 'La conexión está incompleta: configura URL y clave publicable a la vez.';
 if(!url)return null; // GitHub Pages demostrativa, sin datos compartidos.
 let host;
 try {const parsed=new URL(url); if(parsed.protocol!=='https:')return 'La URL de Supabase debe usar HTTPS.';host=parsed.hostname.toLowerCase();}
 catch{return 'La URL de Supabase no es válida.';}
 if(host==='kpmmlzjvespenogqtujo.supabase.co')return 'REPARADO Test está reservado para un entorno privado; no publicarlo en GitHub Pages.';
 if(key.startsWith('sb_secret_'))return 'No puede utilizarse una clave secreta de Supabase en una app pública.';
 const segments=key.split('.');
 if(segments.length===3){
   try{
     const claims=JSON.parse(Buffer.from(segments[1],'base64url').toString('utf8'));
     if(claims.role==='service_role'||claims.role==='supabase_admin')return 'Una clave de servidor no puede publicarse en Vite.';
   }catch{return 'El token JWT no es válido; utiliza una clave publicable de Supabase.';}
 }
 if(!key.startsWith('sb_publishable_')&&segments.length!==3)return 'Formato de clave inválido; utiliza la clave publicable de Supabase.';
 return null;
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
 const error=checkPublicConfig(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_ANON_KEY);
 if(error){console.error('Bloqueada publicación de REPARADO:',error);process.exit(1);}
 console.log('Configuración de publicación comprobada: '+(process.env.VITE_SUPABASE_URL?'modo conectado':'modo demostración local'));
}
