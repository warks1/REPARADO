/**
 * Cambios autorizados para un operario. No concede permisos:
 * las políticas RLS y el trigger de Supabase deben validarlos de nuevo.
 */
export function operatorMaySetStatus(previous, next) {
  if (typeof previous !== 'string' || typeof next !== 'string') return false;
  if (previous === next) return true;
  return (previous === 'scheduled' && next === 'in_progress')
    || (previous === 'in_progress' && next === 'completed');
}
