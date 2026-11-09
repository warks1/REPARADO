import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  validateWorkDescription,validateWorkPhotos,mayStartWork,mayFinishWork,
  startOperatorWork,completeOperatorWork,saveOperatorWorkDescription,
  uploadOperatorWorkPhotos,fetchWorkReport,listWorkPhotos,
  WorkSessionChanged,MAX_WORK_PHOTOS
} from '../operator-work-service.js';

const op='a0000000-0000-4000-8000-000000000001';
const job='b0000000-0000-4000-8000-000000000002';
const other='c0000000-0000-4000-8000-000000000003';
const current=()=>true;

test('V100: transiciones de servicio solo para el operario asignado',()=>{
  assert.equal(mayStartWork({id:job,operator_id:op,status:'scheduled'},op),true);
  assert.equal(mayStartWork({id:job,operator_id:op,status:'in_progress'},op),true);
  assert.equal(mayStartWork({id:job,operator_id:op,status:'accepted'},op),false);
  assert.equal(mayStartWork({id:job,operator_id:op,status:'completed'},op),false);
  assert.equal(mayStartWork({id:job,operator_id:other,status:'scheduled'},op),false);
  assert.equal(mayFinishWork({id:job,operator_id:op,status:'in_progress'},op),true);
  assert.equal(mayFinishWork({id:job,operator_id:op,status:'scheduled'},op),false);
  assert.equal(mayFinishWork({id:job,operator_id:other,status:'in_progress'},op),false);
});

test('V100: parte y fotos tienen límites explícitos y no aceptan contenido inválido',()=>{
  assert.match(validateWorkDescription(''),/20 caracteres/);
  assert.match(validateWorkDescription('Muy breve'),/20 caracteres/);
  assert.equal(validateWorkDescription('Se ha sustituido y comprobado el grifo.'),null);
  assert.match(validateWorkDescription('x'.repeat(4001)),/4.000/);
  const image={name:'prueba.jpg',type:'image/jpeg',size:2000};
  assert.equal(validateWorkPhotos([image],0),null);
  assert.equal(validateWorkPhotos([image],7),null);
  assert.match(validateWorkPhotos([image],8),/8 fotografías/);
  assert.match(validateWorkPhotos([image],-1),/verificar/);
  assert.match(validateWorkPhotos([{...image,type:'image/svg+xml'}],0),/JPG/);
  assert.match(validateWorkPhotos([{...image,size:9*1024*1024}],0),/8 MB/);
  assert.match(validateWorkPhotos([],0),/Selecciona/);
  assert.equal(MAX_WORK_PHOTOS,8);
});

test('V100: iniciar y terminar utilizan RPC autenticada, sin editar precio ni operario',async()=>{
  const calls=[],supabase={rpc:async(name,args)=>{
    calls.push([name,args]);return {data:true,error:null};
  }};
  assert.equal(await startOperatorWork({
    supabase,operatorId:op,requestId:job,isActive:current
  }),true);
  assert.equal(await completeOperatorWork({
    supabase,operatorId:op,requestId:job,isActive:current,
    description:'Reparación ejecutada y prueba de estanqueidad correcta.'
  }),true);
  assert.deepEqual(calls,[
    ['reparado_start_work',{p_request_id:job}],
    ['reparado_complete_work',{
      p_request_id:job,
      p_description:'Reparación ejecutada y prueba de estanqueidad correcta.'
    }]
  ]);
  await assert.rejects(()=>completeOperatorWork({
    supabase,operatorId:op,requestId:job,isActive:current,
    description:'Breve'
  }),/20 caracteres/);
  assert.equal(calls.length,2);
  await assert.rejects(()=>startOperatorWork({
    supabase,operatorId:'no-valid',requestId:job,isActive:current
  }),/Servicio no válido/);
  await assert.rejects(()=>startOperatorWork({
    supabase,operatorId:op,requestId:job,isActive:()=>false
  }),WorkSessionChanged);
});

test('V100: error de servidor y sesión revocada nunca se confunden con éxito',async()=>{
  await assert.rejects(()=>completeOperatorWork({
    supabase:{rpc:async()=>({data:false,error:null})},
    operatorId:op,requestId:job,isActive:current,
    description:'He sustituido la pieza y comprobado su funcionamiento.'
  }),/No se ha cerrado/);
  await assert.rejects(()=>startOperatorWork({
    supabase:{rpc:async()=>({data:null,error:{code:'42501'}})},
    operatorId:op,requestId:job,isActive:current
  }),/No se pudo iniciar/);
  let active=true;
  await assert.rejects(()=>startOperatorWork({
    supabase:{rpc:async()=>{active=false;return {data:true,error:null}}},
    operatorId:op,requestId:job,isActive:()=>active
  }),WorkSessionChanged);
});

test('V100: guardar la descripción solo por fila y operario actuales',async()=>{
  const calls=[];
  const supabase={from:table=>{
    assert.equal(table,'work_reports');
    return {
      update:values=>{calls.push(['update',values]);return thisApi},
    };
  }};
  const thisApi={
    eq(key,value){calls.push(['eq',key,value]);return this},
    select:async keys=>{calls.push(['select',keys]);return {
      data:[{request_id:job}],error:null
    }}
  };
  assert.equal(await saveOperatorWorkDescription({
    supabase,requestId:job,operatorId:op,isActive:current,
    description:'  Se han fijado los soportes y comprobado la instalación.  '
  }),true);
  assert.deepEqual(calls[0],['update',{
    description:'Se han fijado los soportes y comprobado la instalación.'
  }]);
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='operator_id'&&c[2]===op));
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='request_id'&&c[2]===job));
});

test('V100: subida recupera respuestas perdidas con hash y no duplica fotos',async()=>{
  const digest=new Uint8Array(32).fill(171);
  const filename='foto-'+('ab'.repeat(32))+'.png';
  const image={
    type:'image/png',size:4,arrayBuffer:async()=>new Uint8Array([1,2,3,4]).buffer
  };
  const names=new Set();
  let calls=0;
  const store={
    list:async()=>({data:[...names].map(name=>({name})),error:null}),
    upload:async(path)=>{
      calls++;names.add(path.split('/').at(-1));
      if(calls===1)throw Error('response lost');
      return {error:null};
    }
  };
  const supabase={storage:{from:name=>{
    assert.equal(name,'work-photos');return store;
  }}};
  const subtle={digest:async()=>digest.buffer};
  const first=await uploadOperatorWorkPhotos({
    supabase,operatorId:op,requestId:job,
    files:[image],isActive:current,subtle
  });
  assert.equal(first.recovered,1);
  assert.equal(first.failed,0);
  assert.equal(names.has(filename),true);
  const second=await uploadOperatorWorkPhotos({
    supabase,operatorId:op,requestId:job,
    files:[image],isActive:current,subtle
  });
  assert.equal(second.alreadyPresent,1);
  assert.equal(calls,1);
});

test('V100: fotos y partes son consultas privadas; el UI no expone el bucket',async()=>{
  const calls=[];
  const supabase={
    storage:{from:name=>{
      calls.push(['bucket',name]);
      return {list:async(path,opts)=>{
        calls.push(['list',path,opts]);
        return {data:[{name:'foto-'+('ab'.repeat(32))+'.jpg'},
          {name:'../../credenciales.json'}],error:null};
      }};
    }},
    from:name=>({
      select:()=>({
        eq:()=>({
          maybeSingle:async()=>({data:{operator_id:op,request_id:job},error:null})
        })
      })
    })
  };
  assert.equal((await listWorkPhotos({supabase,operatorId:op,requestId:job,isActive:current})).length,1);
  assert.equal((await fetchWorkReport({supabase,requestId:job,isActive:current})).operator_id,op);
  assert.ok(calls.some(c=>c[0]==='list'&&c[1]===op+'/'+job));
  const migration=readFileSync(new URL('../supabase/migration-v100-operator-work-reports.sql',import.meta.url),'utf8');
  const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  const view=readFileSync(new URL('../operator-work-view.js',import.meta.url),'utf8');
  assert.match(migration,/alter table public\.work_reports enable row level security/);
  assert.match(migration,/security invoker/g);
  assert.match(migration,/grant update \(description\)/);
  assert.match(migration,/REPARADO_WORK_PHOTO_REQUIRED/);
  assert.match(migration,/bucket_id='work-photos'/);
  assert.match(migration,/work_finished_at/);
  assert.doesNotMatch(migration,/security definer/i);
  assert.ok(connected.includes("import {mountOperatorWork} from './operator-work-view.js'"));
  assert.ok(connected.includes('data-work-detail'));
  assert.ok(view.includes('data-work-finish'));
  assert.ok(view.includes('createSignedUrl(path,120)'));
});
