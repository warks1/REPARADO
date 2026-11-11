// REPARADO V109 · Detectar descripciones del parte todavía no guardadas.
// No persiste datos sensibles en el navegador; compara el texto visible con
// la última descripción confirmada por Supabase.
export function workNotesDirty(draft,confirmed){
  return String(draft??'').trim()!==String(confirmed??'').trim();
}

export const WORK_NOTES_EXIT_WARNING=
  'Hay cambios sin guardar en la descripción del trabajo. Si sales ahora, se perderán. ¿Quieres salir sin guardar?';

export function confirmWorkNotesExit({draft,confirmed,confirmExit}){
  if(!workNotesDirty(draft,confirmed))return true;
  if(typeof confirmExit!=='function')return false;
  return confirmExit(WORK_NOTES_EXIT_WARNING)===true;
}
