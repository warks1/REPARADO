// Bloqueo de versiones de tienda no operativas. No registra secretos en logs.
// En GitHub Pages el modo de demostración sigue permitido; EN TIENDAS, NO.
import { checkPublicConfig } from './check-public-config.mjs';

function secureUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password &&
      !/(^|\.)example\.(com|org|net)$|\.invalid$|localhost$/.test(url.hostname);
  } catch { return false; }
}

export function storePreflight(env={}) {
  const errors=[];
  const url=String(env.VITE_SUPABASE_URL||'');
  const key=String(env.VITE_SUPABASE_ANON_KEY||'');
  if(!url||!key)errors.push('Se requiere un Supabase de PRODUCCIÓN: las apps de tiendas no pueden ser una demo local.');
  const configError=checkPublicConfig(url,key);
  if(configError)errors.push(configError);
  if(!secureUrl(env.REPARADO_PRIVACY_URL))
    errors.push('Falta la política de privacidad pública con HTTPS.');
  if(!secureUrl(env.REPARADO_SUPPORT_URL))
    errors.push('Falta la URL pública de asistencia con HTTPS.');
  if(!secureUrl(env.REPARADO_DELETE_ACCOUNT_URL))
    errors.push('Falta una URL pública HTTPS que permita solicitar la eliminación de la cuenta.');
  if(env.REPARADO_PRODUCTION_APPROVED!=='true')
    errors.push('El responsable debe confirmar expresamente que el entorno de producción, la privacidad y el borrado de cuentas están operativos.');
  return errors;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const issues=storePreflight(process.env);
 if(issues.length){
   for(const issue of issues)console.error('Versión de tienda BLOQUEADA: '+issue);
   process.exit(1);
 }
 console.log('Preflight de tienda: configuración mínima aportada y autorizada; pendiente verificación de servicios y firma.');
}
