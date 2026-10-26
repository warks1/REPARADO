// Presentación de incidencias privadas. No contiene datos de ningún cliente
// ni permite consultar la base de datos directamente sin la sesión autenticada.
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const labels={
  open:'Recibida',
  reviewing:'En revisión',
  resolved:'Resuelta'
};
export function supportStatusLabel(status){
  return labels[String(status)]||'Estado no disponible';
}
export function supportHistoryMarkup(rows=[]){
  if(!Array.isArray(rows)||!rows.length)
    return '<p class="support-empty">Todavía no has comunicado ninguna incidencia desde la aplicación.</p>';
  return rows.slice(0,15).map(item=>{
    const status=String(item?.status||'');
    const safeStatus=Object.hasOwn(labels,status)?status:'unknown';
    const date=Date.parse(item?.created_at||'');
    const created=Number.isFinite(date)?new Date(date).toLocaleDateString('es-ES'):'Fecha no disponible';
    return '<article class="support-history-card" data-support-history>'+
      '<div class="support-history-head"><strong>'+escapeText(item?.subject)+'</strong>'+
      '<span class="support-state support-state-'+safeStatus+'">'+supportStatusLabel(status)+'</span></div>'+
      '<small>Registrada: '+escapeText(created)+'</small>'+
      '</article>';
  }).join('');
}
