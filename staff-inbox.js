// REPARADO V68 · Bandeja de nuevas solicitudes con paginación real.
// El recuento y las páginas se consultan en Supabase con RLS; no se
// deducen de los últimos 150 trabajos mostrados en la vista general.
export const newRequestsPageSize=50;

export function newRequestsPageBounds(page){
  if(!Number.isSafeInteger(page)||page<0||page>100000)throw Error('Página de solicitudes no válida.');
  return {start:page*newRequestsPageSize,end:(page+1)*newRequestsPageSize-1};
}

export function newRequestsPageCount(count){
  if(!Number.isSafeInteger(count)||count<0)return 0;
  return Math.ceil(count/newRequestsPageSize);
}

export function canAdvanceNewRequests(page,count){
  return Number.isSafeInteger(page)&&page>=0&&page+1<newRequestsPageCount(count);
}

export async function fetchNewRequestsCount(supabase){
  try{
    const {count,error}=await supabase.from('service_requests')
      .select('id',{count:'exact',head:true}).eq('status','new');
    if(error||!Number.isSafeInteger(count)||count<0)
      return {count:null,error:true};
    return {count,error:false};
  }catch{return {count:null,error:true}}
}

export async function fetchNewRequestsPage(supabase,columns,page){
  try{
    const {start,end}=newRequestsPageBounds(page);
    const {data,count,error}=await supabase.from('service_requests')
      .select(columns,{count:'exact'})
      .eq('status','new')
      .order('created_at',{ascending:false})
      .range(start,end);
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
      return {data:null,count:null,error:true};
    return {data,count,error:false};
  }catch{return {data:null,count:null,error:true}}
}
