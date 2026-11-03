// REPARADO V73 · Historial privado de solicitudes paginado en Supabase.
// La API REST limita las filas por respuesta; nunca asumir que 1000 son todas.
export const customerRequestsPageSize=50;

export function customerRequestsPageCount(count){
  if(!Number.isSafeInteger(count)||count<0)return 0;
  return Math.max(1,Math.ceil(count/customerRequestsPageSize));
}
export function customerRequestsCanAdvance(page,count){
  return Number.isSafeInteger(page)&&page>=0&&
    customerRequestsPageCount(count)>page+1;
}
export async function fetchCustomerRequestsPage(supabase,userId,columns,page=0){
  if(!supabase||typeof userId!=='string'||!userId.trim()||
    typeof columns!=='string'||!columns.trim()||
    !Number.isSafeInteger(page)||page<0||page>100000){
    return {data:null,count:null,error:true};
  }
  const start=page*customerRequestsPageSize;
  try{
    const response=await supabase.from('service_requests')
      .select(columns,{count:'exact'})
      .eq('customer_id',userId)
      .order('created_at',{ascending:false})
      .range(start,start+customerRequestsPageSize-1);
    if(response?.error||!Array.isArray(response?.data)||
      !Number.isSafeInteger(response?.count)||response.count<0)
      return {data:null,count:null,error:true};
    return {data:response.data,count:response.count,error:false};
  }catch{
    return {data:null,count:null,error:true};
  }
}
