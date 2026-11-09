import {fetchOwnerUnreadConversationCount} from './owner-unread-count.js';
import {fetchOwnerOperationalCounts,ownerPriorityMarkup} from './owner-priorities.js';
// REPARADO V98 · Panel del propietario. El cliente nunca monta este módulo.
// Protección real: permisos y RLS en Supabase; role admin es la cuenta titular.
// Los recuentos se solicitan al servidor, no se infieren de una lista limitada.
export const ownerSections=Object.freeze([
  {view:'admin',filter:'new',icon:'📥',title:'Solicitudes nuevas',detail:'Aceptar, revisar y tramitar encargos'},
  {view:'admin',filter:'pending',icon:'🧾',title:'Presupuestos',detail:'Preparar importes y consultar aceptaciones'},
  {view:'owner-calendar',icon:'📅',title:'Calendario y operarios',detail:'Asignar, cambiar y reprogramar visitas'},
  {view:'owner-messages',icon:'💬',title:'Mensajes de clientes',detail:'Responder conversaciones dentro de REPARADO'},
  {view:'owner-customers',icon:'👥',title:'Directorio de clientes',detail:'Consultar contactos y abrir conversaciones'},
  {view:'owner-operators',icon:'👷',title:'Equipo de operarios',detail:'Consultar personal y gestionar su agenda'},
  {view:'admin',filter:'unassigned',icon:'🛠️',title:'Trabajos sin asignar',detail:'Distribuir el trabajo entre operarios'},
  {view:'admin',filter:'all',icon:'📋',title:'Todos los servicios',detail:'Consultar historial y estado de trabajos'},
  {view:'owner-export',icon:'📊',title:'Exportar historial CSV',detail:'Guardar trabajos en Excel sin datos de contacto ni facturas fiscales'},
  {view:'admin',filter:'finished',icon:'💶',title:'Facturación y trabajos terminados',detail:'Borradores privados, sin emisión fiscal automática'},
  {view:'support-admin',icon:'🛟',title:'Incidencias',detail:'Resolver problemas reportados por clientes'},
  {view:'review-moderation',icon:'⭐',title:'Reseñas',detail:'Aprobar o rechazar opiniones auténticas'},
  {view:'owner-mail',icon:'✉️',title:'Correo externo',detail:'Abrir Outlook; buzones aún no integrados'}
]);

export const ownerMetrics=Object.freeze([
  {id:'new',title:'Nuevas',table:'service_requests',status:'new'},
  {id:'quoted',title:'Presupuestadas',table:'service_requests',status:'quoted'},
  {id:'accepted',title:'Aceptadas',table:'service_requests',status:'accepted'},
  {id:'scheduled',title:'Programadas',table:'service_requests',status:'scheduled'},
  {id:'in_progress',title:'En curso',table:'service_requests',status:'in_progress'},
  {id:'completed',title:'Terminadas',table:'service_requests',status:'completed'},
  {id:'support',title:'Incidencias abiertas',table:'support_reports',status:'open'},
  {id:'reviews',title:'Reseñas pendientes',table:'customer_reviews',status:'pending'},
  {id:'customers',title:'Clientes',table:'profiles',role:'customer'},
  {id:'operators',title:'Operarios',table:'profiles',role:'operator'}
]);

export async function fetchOwnerMetrics(supabase){
  const counts={};
  if(!supabase)return {counts:null,error:true};
  try{
    const results=await Promise.all(ownerMetrics.map(async metric=>{
      const {count,error}=await supabase.from(metric.table)
        .select('id',{count:'exact',head:true}).eq(metric.role?'role':'status',metric.role||metric.status);
      if(error||!Number.isSafeInteger(count)||count<0)throw Error('Sin recuento');
      return [metric.id,count];
    }));
    for(const [id,count] of results)counts[id]=count;
    return {counts,error:false};
  }catch{return {counts:null,error:true}}
}

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);

export function ownerDashboardMarkup(counts=null,operational=null,unreadCount=null){
  const metric=ownerMetrics.map(item=>
    '<div class="owner-metric"><small>'+escape(item.title)+'</small>'+
    '<strong>'+escape(counts?.[item.id]??'—')+'</strong></div>').join('');
  const cards=ownerSections.map(item=>
    '<button type="button" class="owner-module" data-owner-target="'+escape(item.view)+'"'+
    (item.filter?' data-owner-filter="'+escape(item.filter)+'"':'')+'>'+
    '<span class="owner-module-icon" aria-hidden="true">'+item.icon+'</span>'+
    '<span class="owner-module-copy"><strong>'+escape(item.title)+'</strong>'+
    '<small>'+escape(item.detail)+'</small>'+
    (item.view==='owner-messages'&&Number.isSafeInteger(unreadCount)&&unreadCount>0?
      '<span class="owner-inbox-pending" aria-label="'+escape(unreadCount)+' conversaciones sin leer">'+
      escape(unreadCount)+' sin leer</span>':'')+'</span>'+
    '<span class="owner-module-arrow" aria-hidden="true">›</span></button>').join('');
  return '<section class="card owner-workspace" id="reparado-owner-dashboard">'+
    '<div class="owner-heading"><div><p class="owner-eyebrow">GESTIÓN PRIVADA</p>'+
    '<h1>Panel del propietario</h1><p>REPARADO · Control de tu empresa</p></div>'+
    '<button type="button" data-owner-refresh>Actualizar</button></div>'+
    '<p class="owner-info" role="status" aria-live="polite" data-owner-status>'+
    (counts?'Cifras actuales del servidor.':'Consultando el estado de REPARADO…')+'</p>'+
    '<div class="owner-metrics">'+metric+'</div>'+
    '<div data-owner-priorities>'+ownerPriorityMarkup(counts,operational)+'</div>'+
    '<h2>Centro de gestión</h2><div class="owner-modules">'+cards+'</div>'+
    '<p class="owner-security">Acceso exclusivo del rol administrador. Los clientes y operarios no ven este panel. Los cambios están sujetos a las políticas de seguridad de Supabase.</p>'+
    '</section>';
}

export async function mountOwnerDashboard({main,supabase,isActive,onNavigate}){
  if(!isActive())return;
  main.innerHTML=ownerDashboardMarkup();
  const root=main.querySelector('#reparado-owner-dashboard');
  const status=root.querySelector('[data-owner-status]');
  let refreshId=0;
  const refresh=async()=>{
    if(!isActive()||!root.isConnected)return;
    const id=++refreshId;
    status.textContent='Consultando solicitudes e incidencias…';
    const [result,priority,unread]=await Promise.all([
      fetchOwnerMetrics(supabase),
      fetchOwnerOperationalCounts(supabase),
      fetchOwnerUnreadConversationCount(supabase)
    ]);
    if(!root.isConnected||!isActive()||id!==refreshId)return;
    const fresh=document.createElement('div');
    fresh.innerHTML=ownerDashboardMarkup(
      result.error?null:result.counts,
      priority.error?null:priority.counts,
      unread.error?null:unread.count
    );
    root.querySelector('.owner-metrics').replaceWith(fresh.querySelector('.owner-metrics'));
    root.querySelector('[data-owner-priorities]').replaceWith(
      fresh.querySelector('[data-owner-priorities]')
    );
    root.querySelector('.owner-modules').replaceWith(fresh.querySelector('.owner-modules'));
    status.textContent=result.error?
      'No se han podido comprobar los recuentos. No se mostrarán cifras estimadas.':
      priority.error?
        'Datos actualizados desde el servidor; algunas prioridades no se pudieron comprobar. No incluyen emails de Outlook.':
      unread.error?
        'Datos actualizados desde el servidor; no se pudo comprobar el número de conversaciones sin leer. Los emails de Outlook no se incluyen.':
        'Datos actualizados desde el servidor; no incluyen emails de Outlook.';
  };
  root.addEventListener('click',event=>{
    const btn=event.target.closest('[data-owner-target]');
    if(btn&&isActive())onNavigate(btn.dataset.ownerTarget,btn.dataset.ownerFilter||null);
  });
  root.querySelector('[data-owner-refresh]').addEventListener('click',refresh);
  await refresh();
}
