// Solicitud de eliminación de cuenta: confirmación real y sin datos de otros usuarios.
// La cola pública tiene RLS (solo propia), unicidad por user_id y sin DELETE/UPDATE del cliente.
export async function readOwnDeletionStatus(supabase){
  try{
    const {data,error}=await supabase.from('account_deletion_requests')
      .select('id,status,requested_at').maybeSingle();
    if(error)return {ok:false,request:null};
    return {ok:true,request:data||null};
  }catch{return {ok:false,request:null}}
}

export async function submitOwnDeletionRequest(supabase,userId){
  if(!userId)return {ok:false,request:null,uncertain:false};
  let inserted=false;
  try{
    const {error}=await supabase.from('account_deletion_requests').insert({user_id:userId});
    inserted=!error;
  }catch{
    // Podría haberse confirmado en el servidor y perderse la respuesta.
  }
  // Evitar anunciar éxito por un error 23505 no comprobado:
  // leer la propia fila vía RLS y verificar que existe.
  const result=await readOwnDeletionStatus(supabase);
  if(result.ok && result.request?.id)
    return {ok:true,request:result.request,alreadyExisted:!inserted,uncertain:false};
  return {ok:false,request:null,uncertain:true};
}
export function ownDeletionLabel(request){
  if(!request)return 'No hay ninguna solicitud de eliminación registrada.';
  return 'Solicitud registrada. Estado: '+(
    request.status==='in_review'?'En revisión':
    request.status==='completed'?'Completada':'Recibida'
  )+'.';
}
