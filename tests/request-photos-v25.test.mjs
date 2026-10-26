import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_REQUEST_PHOTOS,MAX_PHOTO_SIZE,validateRequestPhotos,photoCountFromStorage,getRequestPhotoCount,uploadRequestPhotos} from '../request-photos.js';

const photo=(name='foto.jpg',type='image/jpeg',size=100)=>({name,type,size});
test('máximo cuatro fotos en TOTAL por solicitud, incluyendo antiguas',()=>{
  assert.equal(MAX_REQUEST_PHOTOS,4);
  assert.equal(validateRequestPhotos([photo(),photo()],2),null);
  assert.match(validateRequestPhotos([photo()],4),/máximo 4/);
  assert.match(validateRequestPhotos(Array(5).fill(photo())),/máximo 4/);
  assert.match(validateRequestPhotos([],0),/Selecciona/);
});
test('imágenes admitidas y límite 8 MiB: rechaza vacías, ejecutables o grandes',()=>{
  for(const type of ['image/jpeg','image/png','image/webp','image/heic'])
    assert.equal(validateRequestPhotos([photo('x',type,MAX_PHOTO_SIZE)]),null);
  assert.match(validateRequestPhotos([photo('script.svg','image/svg+xml')]),/JPG/);
  assert.match(validateRequestPhotos([photo('x','image/jpeg',0)]),/8 MB/);
  assert.match(validateRequestPhotos([photo('x','image/jpeg',MAX_PHOTO_SIZE+1)]),/8 MB/);
  assert.ok(validateRequestPhotos([photo()],-1));
});
test('cuenta fotografías reales sin confundir placeholders de carpeta',()=>{
  assert.equal(photoCountFromStorage([{name:'file.webp'},{name:'.emptyFolderPlaceholder'},{name:'emptyFolderPlaceholder'},{name:'image.heic'}]),2);
});
test('consulta las fotografías en carpeta exacta cliente/solicitud',async()=>{
  const seen=[];
  const api={storage:()=>({list:async(folder,opts)=>{seen.push({folder,opts});return {data:[{name:'a.jpg'},{name:'b.webp'}],error:null}}})};
  assert.equal(await getRequestPhotoCount(api,'user-id','request-id'),2);
  assert.deepEqual(seen,[{folder:'user-id/request-id',opts:{limit:100}}]);
});
test('subida parcial deja la solicitud intacta, cuenta fallos y no hace upsert',async()=>{
  const paths=[];
  const api={storage:name=>{assert.equal(name,'request-photos');return {upload:async(path,file,options)=>{
    paths.push({path,options});
    return {error:file.name==='fallo.png'?new Error('network'):null};
  }}}};
  const result=await uploadRequestPhotos({supabase:api,userId:'u',requestId:'r',files:[photo(),photo('fallo.png','image/png')],existing:0});
  assert.deepEqual(result,{uploaded:1,failed:1,error:null});
  assert.equal(paths.length,2);
  assert.ok(paths.every(x=>x.options.upsert===false && x.path.startsWith('u/r/')));
});
test('no intenta subir si la solicitud ya tiene 4 imágenes',async()=>{
  const api={storage:()=>{throw Error('No debe tocar el servidor')}};
  const r=await uploadRequestPhotos({supabase:api,userId:'u',requestId:'r',files:[photo()],existing:4});
  assert.equal(r.uploaded,0);assert.ok(r.error);
});
