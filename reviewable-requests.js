// V80 · Seleccionar trabajos terminados incluso fuera de los 50 más recientes.
// Las consultas siempre se restringen al cliente y al estado completed; RLS
// comprueba los permisos en el servidor, nunca se confía en un ID de la interfaz.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const recentReviewableLimit=50;

export async function fetchReviewableRequests(supabase,userId,selectedRequestId=null){
  if(!supabase||!UUID.test(String(userId||'')))
    throw new Error('No se puede comprobar la cuenta.');
  const response=await supabase.from('service_requests')
    .select('id,service_name')
    .eq('customer_id',userId)
    .eq('status','completed')
    .order('created_at',{ascending:false})
    .limit(recentReviewableLimit);
  if(response?.error||!Array.isArray(response?.data))
    throw new Error('No se pudieron comprobar los servicios terminados.');
  const recent=response.data.filter(row=>row&&UUID.test(String(row.id||'')));
  // Cuando «Mis solicitudes» muestra una reparación antigua, validar ese
  // registro concreto; no depender de que aparezca entre los últimos 50.
  if(selectedRequestId&&UUID.test(String(selectedRequestId))&&
     !recent.some(row=>row.id===selectedRequestId)){
    const target=await supabase.from('service_requests')
      .select('id,service_name')
      .eq('customer_id',userId)
      .eq('status','completed')
      .eq('id',selectedRequestId)
      .maybeSingle();
    if(target?.error)throw new Error('No se pudo comprobar el servicio seleccionado.');
    if(target?.data?.id===selectedRequestId)
      recent.unshift(target.data);
  }
  return recent;
}
