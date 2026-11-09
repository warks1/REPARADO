// V82 · Consultar solo reseñas aprobadas, sin mostrar opiniones privadas.
// La base de datos aplica políticas RLS también para usuarios sin sesión.
export const publicReviewsPageSize=20;

export function publicReviewsHasMore(loaded,total){
  return Number.isSafeInteger(loaded)&&loaded>=0&&
    Number.isSafeInteger(total)&&total>=0&&loaded<total;
}

export async function fetchApprovedReviewsPage(supabase,offset=0){
  if(!supabase||!Number.isSafeInteger(offset)||offset<0||offset>1000000)
    return {data:null,count:null,error:true};
  try{
    const {data,count,error}=await supabase.from('customer_reviews')
      .select('id,rating,comment,created_at,status',{count:'exact'})
      .eq('status','approved')
      .order('created_at',{ascending:false})
      .order('id',{ascending:false})
      .range(offset,offset+publicReviewsPageSize-1);
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
      return {data:null,count:null,error:true};
    return {data,count,error:false};
  }catch{return {data:null,count:null,error:true}}
}
