// El registro de nuevas cuentas se oculta de forma predeterminada.
// Solo se muestra tras habilitarlo explícitamente en la compilación.
// IMPORTANTE: proteger el registro de verdad requiere deshabilitarlo
// en Supabase Auth. Un indicador de interfaz no es un control backend.
export function publicRegistrationEnabled(value){
  return value === 'true';
}

// En los enlaces Auth se recibe ?type=invite/recovery o
// #access_token=...&type=invite/recovery según el flujo de Supabase.
// Solo guardamos la INTENCIÓN, nunca los tokens ni contraseñas.
export function authLinkIntentFromUrl(search='',hash=''){
  for(const value of [search,hash]){
    const params=new URLSearchParams(String(value||'').replace(/^[?#]/,''));
    const type=params.get('type');
    if(type==='invite'||type==='recovery')return type;
  }
  return null;
}
