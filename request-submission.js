// REPARADO V27: cada envío de una solicitud lleva una clave de operación.
const VALID_UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export async function submitRepairRequest({supabase,payload,submissionId}){
  if(!payload?.customer_id || !VALID_UUID.test(submissionId||'')){
    return {id:null,recovered:false,error:'No se pudo preparar el envío. Vuelve al formulario.'};
  }
  let definiteInsertError=null;
  try{
    const {data,error}=await supabase.from('service_requests')
      .insert({...payload,client_submission_id:submissionId}).select('id').single();
    if(!error && data?.id)return {id:data.id,recovered:false,error:null};
    if(error)definiteInsertError=error;
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
  // Mostrar errores corregibles solo después de verificar si existe
  // una solicitud registrada con esta clave de intento y este cliente.
  // Un fallo de red sin respuesta del servidor NO es un rechazo confirmado.
  const code=String(definiteInsertError?.code||'');
  const detail=String(definiteInsertError?.message||'');
  const other=String(definiteInsertError?.details||'')+' '+String(definiteInsertError?.hint||'');
  if(code==='23514' && detail.includes('REPARADO_V66_PREFERRED_DATE_PAST'))
    return {id:null,recovered:false,rejected:true,
      error:'La fecha preferida ya ha pasado en Cataluña. Selecciona hoy u otra fecha futura.'};
  if(code==='23514' && (detail.includes('reparado_catalonia_area_v65')||
       other.includes('reparado_catalonia_area_v65')))
    return {id:null,recovered:false,rejected:true,
      error:'Código postal o municipio fuera de la zona de atención de Cataluña. Revisa la dirección.'};
  return {
    id:null,recovered:false,
    error:'No se pudo confirmar la solicitud. Comprueba Mis solicitudes antes de reintentar.'
  };
}
