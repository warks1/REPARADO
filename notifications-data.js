// API privada de avisos: siempre filtrar por el usuario autenticado.
// V79: recuperar todas las páginas en vez de ocultar avisos más antiguos.
export const notificationsPageSize=50;
export function notificationsPageCount(count){
  if(!Number.isSafeInteger(count)||count<0)return 0;
  return Math.max(1,Math.ceil(count/notificationsPageSize));
}
export function notificationsCanAdvance(page,count){
  return Number.isSafeInteger(page)&&page>=0&&
    page+1<notificationsPageCount(count);
}
export async function fetchOwnNotifications(supabase,userId,page=0){
  if(!supabase||typeof userId!=='string'||!userId.trim()||
     !Number.isSafeInteger(page)||page<0||page>100000)
    return {rows:[],count:null,error:true};
  try{
    const {data,count,error}=await supabase.from('notifications')
      .select('id,title,body,read,created_at',{count:'exact'})
      .eq('user_id',userId)
      .order('created_at',{ascending:false})
      .order('id',{ascending:false})
      .range(page*notificationsPageSize,(page+1)*notificationsPageSize-1);
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
      return {rows:[],count:null,error:true};
    return {rows:data,count,error:false};
  }catch{return {rows:[],count:null,error:true}}
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
