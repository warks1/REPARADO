// V92 · Historial completo del personal por páginas reales de Supabase.
// La RLS del servidor sigue delimitando qué trabajos puede ver cada cuenta.
export const staffWorkPageSize=50;
export const staffWorkColumns=
  'id,customer_id,service_name,street,address_number,postal_code,city,phone,'+
  'description,status,scheduled_at,operator_id,operator_name,price';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const staffWorkPagedFilters=Object.freeze(['all','new','pending','agenda','active','finished']);

export function staffWorkPageCount(count){
  return Number.isSafeInteger(count)&&count>=0?
    Math.max(1,Math.ceil(count/staffWorkPageSize)):0;
}
export function staffWorkCanAdvance(page,count){
  return Number.isSafeInteger(page)&&page>=0&&
    page+1<staffWorkPageCount(count);
}
export async function fetchStaffWorkPage(supabase,{
  filter='all',page=0,operatorId=null
}={}){
  if(!supabase||!staffWorkPagedFilters.includes(filter)||
     !Number.isSafeInteger(page)||page<0||page>100000||
     (operatorId!==null&&!uuid.test(String(operatorId))))
    return {error:true};
  try{
    let query=supabase.from('service_requests')
      .select(staffWorkColumns,{count:'exact'});
    if(operatorId)query=query.eq('operator_id',operatorId);
    if(filter==='new')query=query.eq('status','new');
    else if(filter==='pending')query=query.in('status',['new','quoted','accepted']);
    else if(filter==='agenda')query=query.in('status',['scheduled','in_progress']);
    else if(filter==='active')query=query.eq('status','in_progress');
    else if(filter==='finished')query=query.in('status',['completed','cancelled']);
    query=query.order(filter==='agenda'?'scheduled_at':'created_at',
      {ascending:filter==='agenda'}).order('id',{ascending:false});
    const {data,count,error}=await query.range(
      page*staffWorkPageSize,(page+1)*staffWorkPageSize-1);
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
      return {error:true};
    return {data,count,error:false};
  }catch{return {error:true}}
}
