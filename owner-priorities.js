// REPARADO V96 · Prioridades operativas del propietario.
// Solo las rutas admin montan esta sección. RLS y grants aplican en servidor.
// Consultas HEAD: no se descargan datos personales ni se inventan estados.

export const ownerPriorityTasks=Object.freeze([
  {id:'acceptedUnassigned',title:'Aceptados sin operario',detail:'Presupuestos aceptados que necesitan programación',icon:'🛠️',
    view:'owner-calendar'},
  {id:'pastVisits',title:'Visitas anteriores sin cerrar',detail:'Con fecha pasada y estado programado o en curso',icon:'🕒',
    view:'admin',filter:'agenda'},
  {id:'support',title:'Incidencias abiertas',detail:'Mensajes de soporte pendientes de resolver',icon:'🛟',
    view:'support-admin'},
  {id:'reviews',title:'Reseñas por moderar',detail:'Opiniones auténticas pendientes de revisión',icon:'⭐',
    view:'review-moderation'}
]);

export function ownerPriorityCountsFromMetrics(metrics,operational){
  return {
    acceptedUnassigned:operational?.acceptedUnassigned??null,
    pastVisits:operational?.pastVisits??null,
    support:metrics?.support??null,
    reviews:metrics?.reviews??null
  };
}

export async function fetchOwnerOperationalCounts(supabase,now=new Date()){
  if(!supabase||!(now instanceof Date)||!Number.isFinite(now.getTime()))
    return {counts:null,error:true};
  try{
    const [unassigned,past]=await Promise.all([
      supabase.from('service_requests')
        .select('id',{count:'exact',head:true})
        .eq('status','accepted').is('operator_id',null),
      supabase.from('service_requests')
        .select('id',{count:'exact',head:true})
        .in('status',['scheduled','in_progress'])
        .lt('scheduled_at',now.toISOString())
    ]);
    if(unassigned?.error||past?.error||
       !Number.isSafeInteger(unassigned?.count)||unassigned.count<0||
       !Number.isSafeInteger(past?.count)||past.count<0)
      return {counts:null,error:true};
    return {counts:{
      acceptedUnassigned:unassigned.count,
      pastVisits:past.count
    },error:false};
  }catch{return {counts:null,error:true}}
}

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);

export function ownerPriorityMarkup(metrics=null,operational=null){
  const counts=ownerPriorityCountsFromMetrics(metrics,operational);
  return '<section class="owner-priorities" aria-labelledby="owner-priorities-heading">'+
    '<h2 id="owner-priorities-heading">Prioridades de gestión</h2>'+
    '<p class="owner-priority-help">Cifras del servidor; pulsa para revisar cada área. Una visita con horario anterior no indica por sí sola un retraso.</p>'+
    '<div class="owner-priority-grid">'+ownerPriorityTasks.map(item=>
      '<button type="button" class="owner-priority-card" data-owner-target="'+esc(item.view)+'"'+
      (item.filter?' data-owner-filter="'+esc(item.filter)+'"':'')+'>'+
      '<span class="owner-priority-icon" aria-hidden="true">'+item.icon+'</span>'+
      '<span class="owner-priority-content"><strong>'+esc(item.title)+'</strong>'+
      '<small>'+esc(item.detail)+'</small></span>'+
      '<span class="owner-priority-count" aria-label="Número de '+esc(item.title)+
      '">'+esc(counts[item.id]??'—')+'</span></button>'
    ).join('')+'</div></section>';
}
