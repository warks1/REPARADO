// REPARADO V52 · Subidas de fotos reintentables sin duplicados en el mismo trabajo.
// Una huella SHA-256 de cada archivo permite reintentar después de perder la
// respuesta del servidor. Solo afecta a nuevas imágenes: las rutas antiguas
// aleatorias permanecen intactas y deben contabilizarse como adjuntos existentes.
import {MAX_REQUEST_PHOTOS,validateRequestPhotos,photoCountFromStorage} from './request-photos.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const extensions=Object.freeze({
  'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic'
});

export class PhotoSessionChanged extends Error{
  constructor(){super('La sesión ha cambiado durante la subida.');this.name='PhotoSessionChanged'}
}
const ensureOwner=(id,isSessionCurrent)=>{
  if(!UUID.test(String(id||''))||typeof isSessionCurrent!=='function'||!isSessionCurrent(id))
    throw new PhotoSessionChanged();
};
export async function hashedPhotoFilename(file,{subtle=globalThis.crypto?.subtle}={}){
  if(validateRequestPhotos([file]))throw new Error('Imagen no válida.');
  if(typeof file.arrayBuffer!=='function'||!subtle?.digest)
    throw new Error('No se pudo comprobar la identidad del archivo.');
  const buffer=await file.arrayBuffer();
  if(buffer.byteLength!==file.size)throw new Error('Tamaño de archivo inconsistente.');
  const hash=new Uint8Array(await subtle.digest('SHA-256',buffer));
  const hex=Array.from(hash,byte=>byte.toString(16).padStart(2,'0')).join('');
  if(!/^[a-f0-9]{64}$/.test(hex))throw new Error('Huella de fotografía inválida.');
  return 'foto-'+hex+'.'+extensions[file.type];
}
async function currentNames(store,folder,id,isSessionCurrent){
  ensureOwner(id,isSessionCurrent);
  const {data,error}=await store.list(folder,{limit:100});
  ensureOwner(id,isSessionCurrent);
  if(error||!Array.isArray(data))throw new Error('No se pudo consultar el almacenamiento privado.');
  return new Set(data.filter(x=>x?.name&&!x.name.startsWith('.')&&x.name!=='emptyFolderPlaceholder').map(x=>x.name));
}
export async function uploadPhotosWithRecovery({supabase,userId,requestId,files,
  isSessionCurrent,subtle=globalThis.crypto?.subtle}){
  ensureOwner(userId,isSessionCurrent);
  if(!UUID.test(String(requestId||''))||!supabase?.storage?.from)
    return {uploaded:0,recovered:0,alreadyPresent:0,failed:0,error:'Solicitud no válida.'};
  const items=Array.from(files||[]);
  const validation=validateRequestPhotos(items,0);
  if(validation)return {uploaded:0,recovered:0,alreadyPresent:0,failed:0,error:validation};
  const folder=userId+'/'+requestId;
  const store=supabase.storage.from('request-photos');
  let names;
  try{names=await currentNames(store,folder,userId,isSessionCurrent)}
  catch(e){if(e instanceof PhotoSessionChanged)throw e;
    return {uploaded:0,recovered:0,alreadyPresent:0,failed:0,error:'No se pudieron consultar las fotografías de la solicitud.'}}
  if(names.size>MAX_REQUEST_PHOTOS)
    return {uploaded:0,recovered:0,alreadyPresent:0,failed:0,error:'La solicitud supera el límite de fotografías. Contacta con soporte.'};
  let uploaded=0,recovered=0,alreadyPresent=0,failed=0;
  for(const file of items){
    ensureOwner(userId,isSessionCurrent);
    let name;
    try{name=await hashedPhotoFilename(file,{subtle})}
    catch{failed++;continue}
    ensureOwner(userId,isSessionCurrent);
    if(names.has(name)){alreadyPresent++;continue}
    if(names.size>=MAX_REQUEST_PHOTOS){failed++;continue}
    const path=folder+'/'+name;
    let result;
    try{result=await store.upload(path,file,{contentType:file.type,upsert:false})}
    catch{result={error:new Error('Respuesta perdida')}}
    ensureOwner(userId,isSessionCurrent);
    if(!result?.error){names.add(name);uploaded++;continue}
    // La respuesta pudo perderse aunque Storage ya guardara el objeto.
    // Solo recuperar si el mismo nombre derivado del contenido es visible.
    try{
      const latest=await currentNames(store,folder,userId,isSessionCurrent);
      if(latest.has(name)){names=latest;recovered++;continue}
      names=latest;
    }catch(e){if(e instanceof PhotoSessionChanged)throw e}
    failed++;
  }
  return {uploaded,recovered,alreadyPresent,failed,error:null};
}
