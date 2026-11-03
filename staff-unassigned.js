// REPARADO V70 · Trabajos sin operario: todos, no solo los 150 recientes.
// Consultas exclusivas del panel de administración, sometidas a RLS de Supabase.
// No incluye trabajos finalizados ni cancelados.
import {newRequestsPageBounds} from './staff-inbox.js';

export const unassignedActiveStatuses=Object.freeze([
  'new','quoted','accepted','scheduled','in_progress'
]);

export function filterUnassignedRequestQuery(query){
  // El filtro ocurre en PostgreSQL ANTES de paginar: no basta filtrar 150 filas en JS.
  return query.is('operator_id',null).in('status',unassignedActiveStatuses);
}

export async function fetchUnassignedRequestsCount(supabase){
  try{
    const {count,error}=await filterUnassignedRequestQuery(
      supabase.from('service_requests').select('id',{count:'exact',head:true})
    );
    if(error||!Number.isSafeInteger(count)||count<0)
      return {count:null,error:true};
    return {count,error:false};
  }catch{return {count:null,error:true}}
}

export async function fetchUnassignedRequestsPage(supabase,columns,page){
  try{
    const {start,end}=newRequestsPageBounds(page);
    const {data,count,error}=await filterUnassignedRequestQuery(
      supabase.from('service_requests').select(columns,{count:'exact'})
    ).order('created_at',{ascending:false}).range(start,end);
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
      return {data:null,count:null,error:true};
    return {data,count,error:false};
  }catch{return {data:null,count:null,error:true}}
}
