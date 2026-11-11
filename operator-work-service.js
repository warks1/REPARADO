// REPARADO V100 · Operario: comenzar servicio, parte de trabajo y fotos.
import {hashedPhotoFilename} from './photo-retry.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHOTO_NAME=/^foto-[a-f0-9]{64}\.(jpg|png|webp|heic)$/;
export const MAX_WORK_PHOTOS=8;
export const MAX_WORK_IMAGE_SIZE=8*1024*1024;
export const WORK_IMAGE_TYPES=Object.freeze(['image/jpeg','image/png','image/webp','image/heic']);
export const WORK_DESCRIPTION_MIN=20;
export const WORK_DESCRIPTION_MAX=4000;

export class WorkSessionChanged extends Error {
  constructor(){super('La sesión ha cambiado. Vuelve a entrar en tu cuenta.');this.name='WorkSessionChanged'}
}
const ensureActive=isActive=>{
  if(typeof isActive!=='function'||!isActive())throw new WorkSessionChanged();
};
function validIds(operatorId,requestId){
  return UUID.test(String(operatorId||''))&&UUID.test(String(requestId||''));
}
export function validateWorkDescription(value){
  const text=String(value??'').trim();
  if(text.length<WORK_DESCRIPTION_MIN)
    return 'Describe el trabajo realizado con al menos 20 caracteres.';
  if(text.length>WORK_DESCRIPTION_MAX)
    return 'La descripción no puede superar 4.000 caracteres.';
  return null;
}
// Guardar un borrador durante la intervención NO es terminar el servicio.
// La RPC de cierre conserva el mínimo de 20 caracteres y una foto privada.
export function validateWorkDraft(value){
  const text=String(value??'').trim();
  if(text.length>WORK_DESCRIPTION_MAX)
    return 'La descripción no puede superar 4.000 caracteres.';
  return null;
}
export function validateWorkPhotos(files,existing=0){
  const items=Array.from(files||[]);
  if(!items.length)return 'Selecciona una o varias fotografías.';
  if(!Number.isSafeInteger(existing)||existing<0||existing>MAX_WORK_PHOTOS)
    return 'No se pudo verificar el número de fotos existentes.';
  if(existing+items.length>MAX_WORK_PHOTOS)
    return 'Puedes añadir hasta 8 fotografías al parte de trabajo.';
  if(items.some(file=>!WORK_IMAGE_TYPES.includes(file?.type)||
    !Number.isSafeInteger(file?.size)||file.size<=0||file.size>MAX_WORK_IMAGE_SIZE))
    return 'Usa fotografías JPG, PNG, WEBP o HEIC de hasta 8 MB cada una.';
  return null;
}
export function mayOperateWork(job,operatorId){
  return Boolean(job&&validIds(operatorId,job.id)&&job.operator_id===operatorId);
}
export function mayStartWork(job,operatorId){
  return mayOperateWork(job,operatorId) &&
    ['scheduled','in_progress'].includes(job.status);
}
export function mayFinishWork(job,operatorId){
  return mayOperateWork(job,operatorId) && job.status==='in_progress';
}
export async function fetchWorkReport({supabase,requestId,operatorId=null,isActive}){
  ensureActive(isActive);
  if(!UUID.test(String(requestId||''))||!supabase?.from||
    (operatorId!==null&&!UUID.test(String(operatorId))))
    throw new Error('Servicio no válido.');
  const query=supabase.from('work_reports')
    .select('request_id,operator_id,description,created_at')
    .eq('request_id',requestId);
  if(operatorId)query.eq('operator_id',operatorId);
  const response=await query.maybeSingle();
  ensureActive(isActive);
  if(response?.error)throw new Error('No se pudo consultar el parte del operario. Revisa la conexión y la migración V103.');
  return response?.data??null;
}

// Solo la cuenta del propietario recibe el historial COMPLETO gracias a RLS.
// Cada operario sigue leyendo exclusivamente su parte asignado.
export async function fetchWorkReports({supabase,requestId,isActive}){
  ensureActive(isActive);
  if(!UUID.test(String(requestId||''))||!supabase?.from)
    throw new Error('Servicio no válido.');
  const result=await supabase.from('work_reports')
    .select('request_id,operator_id,description,created_at')
    .eq('request_id',requestId)
    .order('created_at',{ascending:true})
    .order('operator_id',{ascending:true});
  ensureActive(isActive);
  if(result?.error||!Array.isArray(result?.data))
    throw new Error('No se pudo consultar el historial de intervenciones.');
  return result.data;
}

export async function fetchWorkTransfers({supabase,requestId,isActive}){
  ensureActive(isActive);
  if(!UUID.test(String(requestId||''))||!supabase?.from)
    throw new Error('Servicio no válido.');
  const result=await supabase.from('work_operator_transfers')
    .select('request_id,previous_operator_id,next_operator_id,changed_by,changed_at,status_at_transfer')
    .eq('request_id',requestId)
    .order('changed_at',{ascending:true});
  ensureActive(isActive);
  if(result?.error||!Array.isArray(result?.data))
    throw new Error('No se pudo consultar el historial de traspasos.');
  return result.data;
}
export async function listWorkPhotos({supabase,operatorId,requestId,isActive}){
  ensureActive(isActive);
  if(!validIds(operatorId,requestId)||!supabase?.storage?.from)
    throw new Error('No se pudo identificar el servicio.');
  const folder=operatorId+'/'+requestId;
  const {data,error}=await supabase.storage.from('work-photos')
    .list(folder,{limit:100});
  ensureActive(isActive);
  if(error||!Array.isArray(data))throw new Error('No se pudieron consultar las fotos privadas.');
  return data.filter(item=>PHOTO_NAME.test(String(item?.name||'')));
}
export async function startOperatorWork({supabase,requestId,operatorId,isActive}){
  ensureActive(isActive);
  if(!validIds(operatorId,requestId)||!supabase?.rpc)
    throw new Error('Servicio no válido.');
  const response=await supabase.rpc('reparado_start_work',{p_request_id:requestId});
  ensureActive(isActive);
  if(response?.error)throw new Error('No se pudo iniciar el servicio. Comprueba la conexión o la configuración de Supabase.');
  if(response?.data!==true)
    throw new Error('No tienes permiso para iniciar este servicio o ya no está programado a tu nombre.');
  return true;
}
export async function saveOperatorWorkDescription({supabase,requestId,operatorId,description,isActive}){
  ensureActive(isActive);
  if(!validIds(operatorId,requestId)||!supabase?.from)
    throw new Error('Servicio no válido.');
  const issue=validateWorkDraft(description);
  if(issue)throw new Error(issue);
  const {data,error}=await supabase.from('work_reports')
    .update({description:description.trim()})
    .eq('request_id',requestId).eq('operator_id',operatorId)
    .select('request_id');
  ensureActive(isActive);
  if(error||!Array.isArray(data)||data.length!==1)
    throw new Error('No se pudo guardar la descripción del servicio. Revisa que siga en curso.');
  return true;
}
export async function completeOperatorWork({supabase,requestId,operatorId,description,isActive}){
  ensureActive(isActive);
  if(!validIds(operatorId,requestId)||!supabase?.rpc)
    throw new Error('Servicio no válido.');
  const issue=validateWorkDescription(description);
  if(issue)throw new Error(issue);
  const response=await supabase.rpc('reparado_complete_work',{
    p_request_id:requestId,p_description:description.trim()
  });
  ensureActive(isActive);
  if(response?.error)throw new Error(
    response.error?.message?.includes('REPARADO_WORK_PHOTO_REQUIRED')
      ? 'Debes subir al menos una fotografía antes de finalizar.'
      : 'No se pudo finalizar el servicio. Comprueba la conexión y el estado.');
  if(response?.data!==true)
    throw new Error('No se ha cerrado el servicio: debe estar asignado a tu cuenta, en curso y tener al menos una foto guardada.');
  return true;
}
export async function uploadOperatorWorkPhotos({supabase,operatorId,requestId,
  files,isActive,subtle=globalThis.crypto?.subtle}){
  ensureActive(isActive);
  if(!validIds(operatorId,requestId)||!supabase?.storage?.from)
    throw new Error('No se pudo identificar el servicio.');
  const pictures=Array.from(files||[]);
  const validation=validateWorkPhotos(pictures,0);
  if(validation)throw new Error(validation);
  const store=supabase.storage.from('work-photos');
  const folder=operatorId+'/'+requestId;
  let names=new Set((await listWorkPhotos({supabase,operatorId,requestId,isActive}))
    .map(item=>item.name));
  if(names.size>MAX_WORK_PHOTOS)throw new Error('El parte ya supera el límite de fotos.');
  let uploaded=0,alreadyPresent=0,failed=0,recovered=0;
  for(const file of pictures){
    ensureActive(isActive);
    let name;
    try{name=await hashedPhotoFilename(file,{subtle})}
    catch{failed++;continue}
    ensureActive(isActive);
    if(names.has(name)){alreadyPresent++;continue}
    if(names.size>=MAX_WORK_PHOTOS){failed++;continue}
    let result;
    try{result=await store.upload(folder+'/'+name,file,{contentType:file.type,upsert:false})}
    catch{result={error:new Error('Respuesta interrumpida')}}
    ensureActive(isActive);
    if(!result?.error){uploaded++;names.add(name);continue}
    // La respuesta puede perderse aun cuando el fichero se haya guardado.
    // Si la misma huella está en el servidor, no crear una copia duplicada.
    try{
      const latest=await listWorkPhotos({supabase,operatorId,requestId,isActive});
      names=new Set(latest.map(item=>item.name));
      if(names.has(name)){recovered++;continue}
    }catch(error){if(error instanceof WorkSessionChanged)throw error}
    failed++;
  }
  return {uploaded,alreadyPresent,recovered,failed,total:names.size};
}
