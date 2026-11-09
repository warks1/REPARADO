// REPARADO V98 · Número auténtico de conversaciones sin leer del titular.
// La autorización se decide en el servidor (RPC SECURITY INVOKER + RLS).
export async function fetchOwnerUnreadConversationCount(supabase){
  if(!supabase||typeof supabase.rpc!=='function')
    return {count:null,error:true};
  try{
    const {data,error}=await supabase.rpc('reparado_owner_unread_conversations');
    if(error||!Number.isSafeInteger(data)||data<0)return {count:null,error:true};
    return {count:data,error:false};
  }catch{return {count:null,error:true}}
}
