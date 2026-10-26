// REPARADO V27: cada envío de una solicitud lleva una clave de operación.
const VALID_UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export async function submitRepairRequest({supabase,payload,submissionId}){
  if(!payload?.customer_id || !VALID_UUID.test(submissionId||'')){
    return {id:null,recovered:false,error:'No se pudo preparar el envío. Vuelve al formulario.'};
  }
  try{
    const {data,error}=await supabase.from('service_requests')
      .insert({...payload,client_submission_id:submissionId}).select('id').single();
    if(!error && data?.id)return {id:data.id,recovered:false,error:null};
  }catch{
    // Se puede haber registrado el trabajo antes de perder la respuesta.
  }
  // La consulta está limitada por RLS y, adicionalmente, por la identidad
  // y la clave de este intento. Nunca consultamos datos de otro cliente.
  try{
    const {data,error}=await supabase.from('service_requests').select('id')
      .eq('customer_id',payload.customer_id)
      .eq('client_submission_id',submissionId).maybeSingle();
    if(!error && data?.id)return {id:data.id,recovered:true,error:null};
  }catch{
    // La conexión podría seguir caída. Conservar la clave para reintentar.
  }
  return {
    id:null,recovered:false,
    error:'No se pudo confirmar la solicitud. Comprueba Mis solicitudes antes de reintentar.'
  };
}
