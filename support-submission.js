// Informe de soporte sin duplicados: recuperar el registro tras pérdida de respuesta.
// La búsqueda se filtra también por user_id; RLS limita acceso al propietario.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function submitSupportIssue({supabase,userId,subject,description,context,reportId}){
  if(!userId||!UUID.test(reportId||''))return {ok:false,recovered:false,code:'invalid'};
  let issueCode='network';
  try{
    const {error}=await supabase.from('support_reports').insert({
      user_id:userId,subject,description,context,client_report_id:reportId
    });
    if(!error)return {ok:true,recovered:false,code:null};
    if(error?.message?.includes('REPARADO_SUPPORT_RATE_LIMIT'))issueCode='limit';
  }catch{}
  try{
    const {data,error}=await supabase.from('support_reports').select('id')
      .eq('user_id',userId).eq('client_report_id',reportId).maybeSingle();
    if(!error&&data?.id)return {ok:true,recovered:true,code:null};
  }catch{}
  return {ok:false,recovered:false,code:issueCode};
}
export function supportIssueFailureMessage(code){
  if(code==='limit')return 'Has alcanzado el límite temporal de incidencias. Inténtalo más tarde o escribe a reparado_soporte@outlook.es.';
  if(code==='invalid')return 'No se pudo preparar la incidencia. Vuelve a abrir el formulario.';
  return 'No se pudo confirmar el registro. Comprueba Mis incidencias antes de volver a enviarla.';
}
