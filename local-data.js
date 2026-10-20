// Datos de prueba exclusivamente locales. Ninguna acción de este módulo
// representa envío al equipo ni reserva una visita.
export const requestStorageKey='reparado-local-requests';
export const profileStorageKey='reparado-local-profile';
export const messageDraftStorageKey='reparado-local-chat-draft';

export function safeReadJSON(storage,key,fallback){
  try {
    const raw=storage.getItem(key);
    if(raw===null) return fallback;
    const data=JSON.parse(raw);
    return data===null?fallback:data;
  } catch { return fallback; }
}
export function localRequests(storage){
  const rows=safeReadJSON(storage,requestStorageKey,[]);
  return Array.isArray(rows)?rows.filter(r=>r&&typeof r==='object'&&!Array.isArray(r)):[];
}
export function localProfile(storage){
  const value=safeReadJSON(storage,profileStorageKey,{});
  return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}
export function localWrite(storage,key,value){
  try { storage.setItem(key,JSON.stringify(value));return true; }
  catch { return false; }
}
export function validLocalDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;
  const d=new Date(value+'T12:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function localAgenda(items){
  return items.filter(r=>validLocalDate(r.date))
    .sort((a,b)=>a.date.localeCompare(b.date)||(a.period||'').localeCompare(b.period||''));
}
export function localSummary(items){
  return {total:items.length,withDate:localAgenda(items).length,withoutDate:items.filter(r=>!validLocalDate(r.date)).length};
}
export function localDateLabel(date){
  if(!validLocalDate(date))return 'Sin fecha preferida';
  const [year,month,day]=date.split('-');
  return day+'/'+month+'/'+year;
}
