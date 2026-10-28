import {prepareBillingDraft} from './billing-draft.js';

const ATTRS=['issuer_name','issuer_nif','issuer_address','recipient_name','recipient_nif',
  'recipient_address','description','operation_date'];

export async function savePrivateBillingDraft({supabase,job,fields}){
  const d=prepareBillingDraft(job,fields);
  if(!supabase||typeof supabase.rpc!=='function')
    throw new Error('No está disponible el guardado seguro de borradores.');
  let response;
  try{
    response=await supabase.rpc('reparado_save_invoice_draft',{
      p_request_id:d.reference,
      p_expected_total:d.price,
      p_issuer_name:d.issuer.name,p_issuer_nif:d.issuer.nif,p_issuer_address:d.issuer.address,
      p_recipient_name:d.recipient.name,p_recipient_nif:d.recipient.nif,
      p_recipient_address:d.recipient.address,p_description:d.description,
      p_operation_date:d.operationDate||null
    });
  }catch{throw new Error('No se pudo confirmar el guardado. Consulta el borrador antes de reintentar.')}
  if(response?.error||typeof response?.data!=='string')
    throw new Error('No se pudo guardar el borrador. Verifica la conexión y la migración V60.');
  return response.data;
}

export async function readPrivateBillingDraft({supabase,job}){
  if(!supabase||typeof supabase.from!=='function'||!job?.id)
    throw new Error('No se puede consultar el borrador.');
  let response;
  try{
    response=await supabase.from('invoice_drafts')
      .select('request_id,customer_id,issuer_name,issuer_nif,issuer_address,recipient_name,recipient_nif,recipient_address,description,operation_date,total')
      .eq('request_id',job.id).maybeSingle();
  }catch{throw new Error('No se pudo recuperar el borrador.')}
  if(response?.error)throw new Error('No se pudo consultar el borrador. Revisa los permisos y la conexión.');
  const saved=response?.data;
  if(!saved)return null;
  if(saved.request_id!==job.id||saved.customer_id!==job.customer_id||
     job.status!=='completed'||Math.round(Number(saved.total)*100)!==Math.round(Number(job.price)*100))
    throw new Error('El borrador guardado no coincide con el estado actual del trabajo.');
  return Object.fromEntries(ATTRS.map(key=>[key,saved[key]??'']));
}
