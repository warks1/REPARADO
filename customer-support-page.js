// REPARADO V78: historial paginado de incidencias de la propia cuenta.
// La política RLS de support_reports limita qué filas ve cada cliente.
// La columna user_id es deliberadamente inaccesible al cliente: no leerla
// ni depender de filtros cliente manipulables para controlar propiedad.
export const supportHistoryPageSize=15;

export function supportHistoryPageCount(count){
  if(!Number.isSafeInteger(count)||count<0)return 0;
  return Math.max(1,Math.ceil(count/supportHistoryPageSize));
}
export function supportHistoryCanAdvance(page,count){
  return Number.isSafeInteger(page)&&page>=0&&
    page+1<supportHistoryPageCount(count);
}
export async function fetchSupportHistoryPage(supabase,userId,page=0){
  if(!supabase||typeof userId!=='string'||!userId.trim()||
     !Number.isSafeInteger(page)||page<0||page>100000)
    return {data:null,count:null,error:true};
  try{
    const reply=await supabase.from('support_reports')
      .select('id,subject,status,created_at',{count:'exact'})
      .order('created_at',{ascending:false})
      .order('id',{ascending:false})
      .range(page*supportHistoryPageSize,(page+1)*supportHistoryPageSize-1);
    if(reply?.error||!Array.isArray(reply?.data)||
       !Number.isSafeInteger(reply?.count)||reply.count<0)
      return {data:null,count:null,error:true};
    return {data:reply.data,count:reply.count,error:false};
  }catch{
    return {data:null,count:null,error:true};
  }
}
