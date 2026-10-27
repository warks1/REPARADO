// Validación orientativa en la interfaz para contraseñas NUEVAS.
// NO verifica filtraciones reales ni sustituye la política de Supabase Auth.
// Acepta frases con espacios y Unicode: no impone mezclar símbolos/dígitos.
export const MIN_NEW_PASSWORD_LENGTH=15;
export const MAX_NEW_PASSWORD_LENGTH=128;

// Pequeña lista defensiva de ejemplos previsibles, NO una base de filtraciones.
const predictable=new Set([
  'passwordpassword',
  'password123456789',
  'contraseñacontraseña',
  'reparado20262026',
  'reparadoreparado',
  '123456789012345',
  'qwertyuiopasdfgh',
  'abcdefghijklmnop',
  'adminadminadmin'
]);

export function validateNewPassword(password) {
  if(typeof password!=='string')return 'Introduce una contraseña nueva.';
  // Los pares sustitutos Unicode cuentan como un carácter, no como dos.
  const length=Array.from(password).length;
  if(length<MIN_NEW_PASSWORD_LENGTH)
    return 'Usa al menos 15 caracteres. Puedes escribir una frase larga con espacios.';
  if(length>MAX_NEW_PASSWORD_LENGTH)
    return 'La contraseña es demasiado larga (máximo 128 caracteres).';
  const normalized=password.normalize('NFKC').toLocaleLowerCase('es-ES');
  if(predictable.has(normalized) || /^(.)\1+$/su.test(normalized))
    return 'La contraseña es demasiado previsible. Elige una frase distinta y difícil de adivinar.';
  return null;
}
