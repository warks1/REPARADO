// REPARADO V74 · Historial de chat limitado y paginado.
// Página 0 = los mensajes más recientes. Cada página se presenta en orden cronológico.
export const customerChatPageSize=50;
export function customerChatPageCount(count){
  if(!Number.isSafeInteger(count)||count<0)return 0;
  return Math.max(1,Math.ceil(count/customerChatPageSize));
}
export function customerChatCanReadOlder(page,count){
  return Number.isSafeInteger(page)&&page>=0&&
    customerChatPageCount(count)>page+1;
}
export async function fetchCustomerChatPage(supabase,userId,page=0){
  if(!supabase||typeof userId!=='string'||!userId.trim()||
    !Number.isSafeInteger(page)||page<0||page>100000)
    return {data:null,count:null,error:true};
  const start=page*customerChatPageSize;
  try{
    const reply=await supabase.from('messages')
      .select('id,sender_id,body,created_at',{count:'exact'})
      .eq('customer_id',userId)
      .order('created_at',{ascending:false})
      .order('id',{ascending:false})
      .range(start,start+customerChatPageSize-1);
    if(reply?.error||!Array.isArray(reply?.data)||
      !Number.isSafeInteger(reply?.count)||reply.count<0)
      return {data:null,count:null,error:true};
    return {data:reply.data.slice().reverse(),count:reply.count,error:false};
  }catch{return {data:null,count:null,error:true}}
}
