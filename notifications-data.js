// API privada de avisos: siempre filtrar por el usuario autenticado.
export async function fetchOwnNotifications(supabase,userId){
  if(!userId)return {rows:[],error:true};
  try{
    const {data,error}=await supabase.from('notifications')
      .select('id,title,body,read,created_at')
      .eq('user_id',userId).order('created_at',{ascending:false}).limit(50);
    return {rows:error?[]:(Array.isArray(data)?data:[]),error:Boolean(error)};
  }catch{return {rows:[],error:true}}
}

export async function markOwnNotificationRead(supabase,userId,notificationId){
  if(!userId||!notificationId)return false;
  try{
    // No inferir éxito de un UPDATE que no ha afectado a ninguna fila.
    const {data,error}=await supabase.from('notifications').update({read:true})
      .eq('id',notificationId).eq('user_id',userId).select('id').maybeSingle();
    return !error && data?.id===notificationId;
  }catch{return false}
}
