import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {hashedPhotoFilename,uploadPhotosWithRecovery,PhotoSessionChanged} from '../photo-retry.js';

const userId='00000000-0000-4000-8000-000000000001';
const requestId='00000000-0000-4000-8000-000000000002';
const subtle={digest:async(_algorithm,bytes)=>createHash('sha256').update(Buffer.from(bytes)).digest()};
const image=(body='image content',name='foto.jpg',type='image/jpeg')=>{
  const bytes=new TextEncoder().encode(body);
  return {name,type,size:bytes.byteLength,arrayBuffer:async()=>bytes.slice().buffer};
};
const mock=(existing=[],onUpload=()=>null)=>{
  const names=new Set(existing),operations=[];
  const supabase={storage:{from:bucket=>{
    assert.equal(bucket,'request-photos');
    return {
      list:async(folder,options)=>{
        operations.push(['list',folder,options]);
        return {data:Array.from(names,x=>({name:x})),error:null};
      },
      upload:async(path,_file,opts)=>{
        operations.push(['upload',path,opts]);
        return onUpload(path,names,opts);
      }
    };
  }}};
  return {supabase,names,operations};
};
const opts=m=>({supabase:m.supabase,userId,requestId,subtle,isSessionCurrent:id=>id===userId});
const file=image();
const ui=readFileSync(new URL('../connected.js',import.meta.url),'utf8');

test('V52: archivos iguales generan un nombre fijo aunque se renombren',async()=>{
  const a=await hashedPhotoFilename(file,{subtle});
  const b=await hashedPhotoFilename(image('image content','segundo.jpg'),{subtle});
  const c=await hashedPhotoFilename(image('otra foto','tercero.jpg'),{subtle});
  assert.equal(a,b);
  assert.notEqual(a,c);
  assert.match(a,/^foto-[0-9a-f]{64}\.jpg$/);
});

test('V52: una respuesta de subida perdida se recupera consultando Storage',async()=>{
  const m=mock([],async(path,names)=>{names.add(path.split('/').at(-1));return {error:new Error('se perdió la respuesta')}});
  const result=await uploadPhotosWithRecovery({...opts(m),files:[file]});
  assert.deepEqual(result,{uploaded:0,recovered:1,alreadyPresent:0,failed:0,error:null});
  const retry=await uploadPhotosWithRecovery({...opts(m),files:[image('image content','otra.jpg')]});
  assert.deepEqual(retry,{uploaded:0,recovered:0,alreadyPresent:1,failed:0,error:null});
  assert.equal(m.operations.filter(x=>x[0]==='upload').length,1);
});

test('V52: distintos archivos respetan cuatro existentes, incluso rutas antiguas',async()=>{
  const m=mock(['random-a.jpg','random-b.jpg','random-c.jpg'],async(path,names)=>{
    names.add(path.split('/').at(-1));return {error:null};
  });
  const result=await uploadPhotosWithRecovery({...opts(m),files:[file,image('distinta')]});
  assert.deepEqual(result,{uploaded:1,recovered:0,alreadyPresent:0,failed:1,error:null});
  assert.equal(m.names.size,4);
  assert.equal(m.operations.filter(x=>x[0]==='upload').length,1);
});

test('V52: mismo archivo seleccionado dos veces no se guarda duplicado',async()=>{
  const m=mock([],async(path,names)=>{names.add(path.split('/').at(-1));return {error:null}});
  const result=await uploadPhotosWithRecovery({...opts(m),files:[file,file]});
  assert.deepEqual(result,{uploaded:1,recovered:0,alreadyPresent:1,failed:0,error:null});
  assert.equal(m.names.size,1);
});

test('V52: si cambia la sesión no continúa subiendo fotografías',async()=>{
  let active=true;
  const m=mock([],async(path,names)=>{names.add(path.split('/').at(-1));active=false;return {error:null}});
  await assert.rejects(uploadPhotosWithRecovery({
    ...opts(m),isSessionCurrent:()=>active,files:[file,image('another')]
  }),e=>e instanceof PhotoSessionChanged);
  assert.equal(m.operations.filter(x=>x[0]==='upload').length,1);
});

test('V52: si Storage no confirmó el archivo, se devuelve fallo sin afirmar éxito',async()=>{
  const m=mock([],async()=>({error:new Error('offline')}));
  assert.deepEqual(await uploadPhotosWithRecovery({...opts(m),files:[file]}),
    {uploaded:0,recovered:0,alreadyPresent:0,failed:1,error:null});
  const invalid=await uploadPhotosWithRecovery({...opts(m),files:[{...file,type:'application/pdf'}]});
  assert.ok(invalid.error);
});

test('V52: la interfaz utiliza la recuperación de fotos al crear y al completar solicitudes',()=>{
  assert.equal((ui.match(/await uploadPhotosWithRecovery\(/g)||[]).length,2);
  assert.match(ui,/isSessionCurrent:id=>isCurrentUser\(id\)&&authEpoch===uploadEpoch/);
  assert.match(ui,/Fotografías recuperadas o adjuntadas sin duplicar/);
});
