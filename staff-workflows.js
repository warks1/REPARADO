// Funciones puras para el panel interno de Reparado.
// Estas comprobaciones ayudan a la interfaz, pero no sustituyen las reglas RLS.
export const jobStatuses=['new','quoted','accepted','scheduled','in_progress','completed','cancelled'];
export const jobStatusLabels={
  new:'Nueva',quoted:'Presupuesto',accepted:'Aceptada',scheduled:'Programada',
  in_progress:'En curso',completed:'Terminada',cancelled:'Cancelada'
};
export const jobFilters=[
  {id:'all',label:'Todos'},
  {id:'pending',label:'Pendientes'},
  {id:'unassigned',label:'Sin operario'},
  {id:'agenda',label:'Agenda'},
  {id:'active',label:'En curso'},
  {id:'finished',label:'Finalizados'}
];
export function filterJobs(jobs,filter='all'){
  const source=Array.isArray(jobs)?jobs:[];
  const filtered=source.filter(j=>{
    if(filter==='pending')return ['new','quoted','accepted'].includes(j.status);
    if(filter==='unassigned')return !j.operator_id&&!['completed','cancelled'].includes(j.status);
    if(filter==='agenda')return ['scheduled','in_progress'].includes(j.status);
    if(filter==='active')return j.status==='in_progress';
    if(filter==='finished')return ['completed','cancelled'].includes(j.status);
    return true;
  });
  if(filter==='agenda')return filtered.slice().sort((a,b)=>
    (Date.parse(a.scheduled_at||'')||Infinity)-(Date.parse(b.scheduled_at||'')||Infinity));
  return filtered;
}
export function jobCounters(jobs){
  const source=Array.isArray(jobs)?jobs:[];
  return {
    all:source.length,
    pending:filterJobs(source,'pending').length,
    unassigned:filterJobs(source,'unassigned').length,
    agenda:filterJobs(source,'agenda').length,
    active:filterJobs(source,'active').length,
    finished:filterJobs(source,'finished').length
  };
}
// El precio de venta es siempre el TOTAL con IVA incluido.
// Usamos céntimos para evitar los errores típicos de coma flotante.
export function vatIncluded(total,percent=21){
  if(total===null||total===undefined||total==='')return null;
  const n=Number(total);
  if(!Number.isFinite(n)||n<0||n>999999||!Number.isFinite(percent)||percent<0)return null;
  const cents=Math.round(n*100);
  const baseCents=Math.round(cents*100/(100+percent));
  return {total:cents/100,base:baseCents/100,vat:(cents-baseCents)/100,percent};
}
export function sameOperatorSlot(jobs,{requestId,operatorId,scheduledAt}){
  if(!operatorId||!scheduledAt)return [];
  const target=Date.parse(scheduledAt);
  if(!Number.isFinite(target))return [];
  // Solo compara la misma hora exacta; no pretende determinar
  // la duración del desplazamiento ni eliminar conflictos en servidor.
  return (Array.isArray(jobs)?jobs:[]).filter(j=>
    j.id!==requestId&&j.operator_id===operatorId&&
    ['scheduled','in_progress'].includes(j.status)&&
    Number.isFinite(Date.parse(j.scheduled_at||''))&&
    Math.abs(Date.parse(j.scheduled_at)-target)<60000
  );
}
export function validateAdminJobUpdate({status,operatorId,scheduledAt,price}){
  if(!jobStatuses.includes(status))return 'Estado no válido.';
  if(price!==null&&vatIncluded(price)===null)return 'Introduce un precio válido, IVA incluido.';
  if(status==='quoted'&&price===null)return 'Indica un importe antes de enviar el presupuesto.';
  if(status==='scheduled'&&(!operatorId||!scheduledAt))return 'Para programar, selecciona operario y fecha.';
  if(scheduledAt&&!Number.isFinite(Date.parse(scheduledAt)))return 'Fecha y hora no válidas.';
  return null;
}
