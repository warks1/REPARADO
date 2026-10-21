// El registro de nuevas cuentas se oculta de forma predeterminada.
// Solo se muestra tras habilitarlo explícitamente en la compilación.
// IMPORTANTE: proteger el registro de verdad requiere deshabilitarlo
// en Supabase Auth. Un indicador de interfaz no es un control backend.
export function publicRegistrationEnabled(value){
  return value === 'true';
}
