// Reparado: fotografías privadas asociadas a una solicitud REAL.
export const MAX_REQUEST_PHOTOS=4;
export const MAX_PHOTO_SIZE=8*1024*1024;
export const ACCEPTED_PHOTO_TYPES=Object.freeze({
  'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic'
});

export function validateRequestPhotos(files,existing=0){
  const items=Array.from(files||[]);
  if(!items.length)return 'Selecciona alguna fotografía.';
  if(!Number.isSafeInteger(existing)||existing<0)return 'No se pudo comprobar el número de fotografías.';
  if(items.length+existing>MAX_REQUEST_PHOTOS)
    return 'Puedes adjuntar como máximo 4 fotografías por solicitud, contando las anteriores.';
  if(items.some(file=>!Object.hasOwn(ACCEPTED_PHOTO_TYPES,file?.type||'')||
    !Number.isFinite(file?.size)||file.size<=0||file.size>MAX_PHOTO_SIZE))
    return 'Usa imágenes JPG, PNG, WEBP o HEIC de 8 MB como máximo.';
  return null;
}
export function photoCountFromStorage(objects){
  return (objects||[]).filter(row=>row?.name && !row.name.startsWith('.') && row.name!=='emptyFolderPlaceholder').length;
}
export async function getRequestPhotoCount(supabase,userId,requestId){
  const folder=userId+'/'+requestId;
  const {data,error}=await supabase.storage.from('request-photos').list(folder,{limit:100});
  if(error)throw new Error('No se pudieron consultar las fotografías existentes.');
  return photoCountFromStorage(data);
}
export async function uploadRequestPhotos({supabase,userId,requestId,files,existing=0}){
  const items=Array.from(files||[]);
  const validation=validateRequestPhotos(items,existing);
  if(validation)return {uploaded:0,failed:0,error:validation};
  let uploaded=0,failed=0;
  for(const file of items){
    try{
      const filename=crypto.randomUUID()+'.'+ACCEPTED_PHOTO_TYPES[file.type];
      const path=userId+'/'+requestId+'/'+filename;
      const result=await supabase.storage.from('request-photos')
        .upload(path,file,{contentType:file.type,upsert:false});
      if(result.error)failed++;
      else uploaded++;
    }catch{failed++}
  }
  return {uploaded,failed,error:null};
}
