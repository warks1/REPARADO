// V81 · Moderación privada con paginación real en PostgreSQL.
// Todas las consultas respetan RLS; solamente el rol admin ve pendientes.
export const moderationPageSize=50;

export function moderationPageCount(count){
  if(!Number.isSafeInteger(count)||count<0)return 0;
  return Math.max(1,Math.ceil(count/moderationPageSize));
}

export function moderationCanAdvance(page,count){
  return Number.isSafeInteger(page)&&page>=0&&page+1<moderationPageCount(count);
}

export async function fetchPendingModerationPage(supabase,page=0){
  if(!supabase||!Number.isSafeInteger(page)||page<0||page>100000)
    return {data:null,count:null,error:true};
  try{
    const {data,count,error}=await supabase.from('customer_reviews')
      .select('id,rating,comment,status,created_at',{count:'exact'})
      .eq('status','pending')
      .order('created_at',{ascending:true})
      .order('id',{ascending:true})
      .range(page*moderationPageSize,(page+1)*moderationPageSize-1);
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
      return {data:null,count:null,error:true};
    return {data,count,error:false};
  }catch{return {data:null,count:null,error:true}}
}
