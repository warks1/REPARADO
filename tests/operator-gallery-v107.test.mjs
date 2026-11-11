import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../operator-work-view.js',import.meta.url),'utf8');
const pure=source.slice(source.indexOf('const UUID='),source.indexOf('export async function mountOperatorWork'));
const viewMarkup=vm.runInNewContext(pure+';viewMarkup;',{
  mayStartWork:()=>false,mayFinishWork:()=>false,
  MAX_WORK_PHOTOS:8,WORK_DESCRIPTION_MAX:4000
});

const admin='a0000000-0000-4000-8000-000000000001';
const oldOperator='b0000000-0000-4000-8000-000000000002';
const newOperator='c0000000-0000-4000-8000-000000000003';
const job={
  id:'d0000000-0000-4000-8000-000000000004',
  service_name:'Reparación de fontanería',
  description:'Reparar la fuga de agua',
  status:'in_progress',operator_id:newOperator,
  city:'Barcelona',street:'Calle de prueba',address_number:'1'
};

test('V107: el propietario ve los dos partes aunque fallen las fotos de uno',()=>{
  const history=[
    {operator_id:oldOperator,operator_label:'Operario anterior',
      description:'Se reparó la fuga inicial.',created_at:'2026-11-09T10:00:00Z',
      photoCount:null,photoError:true},
    {operator_id:newOperator,operator_label:'Operario sustituto',
      description:'Se completó la intervención.',created_at:'2026-11-10T10:00:00Z',
      photoCount:1}
  ];
  const html=viewMarkup(job,null,[{operator_id:newOperator,name:'foto-'+
    'a'.repeat(64)+'.jpg'}],{userId:admin,role:'admin',history,
    transfers:[{previous_operator_id:oldOperator,next_operator_id:newOperator,
      changed_at:'2026-11-10T09:00:00Z',status_at_transfer:'in_progress'}]});
  assert.match(html,/Operario anterior/);
  assert.match(html,/Operario sustituto/);
  assert.match(html,/Se reparó la fuga inicial/);
  assert.match(html,/Se completó la intervención/);
  assert.match(html,/Traspasos de operario/);
  assert.match(html,/Fotografías no disponibles: error de lectura o permisos/);
  assert.match(html,/No se pudieron consultar estas fotografías/);
  assert.match(html,/1 fotografía accesible del historial/);
  assert.match(html,/Algunas intervenciones tienen fotos pendientes de consultar/);
  assert.doesNotMatch(html,/0 fotografía\(s\) de esta intervención/);
});

test('V107: una intervención realmente sin fotos no se anuncia como fallo',()=>{
  const html=viewMarkup(job,null,[],{userId:admin,role:'admin',
    history:[{operator_id:newOperator,description:'Parte sin imágenes',
      photoCount:0,photoError:false}]});
  assert.match(html,/Sin fotografías de esta intervención/);
  assert.match(html,/0 fotografía\(s\) de esta intervención/);
  assert.doesNotMatch(html,/Fotografías no disponibles/);
});

test('V107: un fallo de fotos no se ignora para el operario ni se inventa cierre',()=>{
  assert.match(source,/if\(role!=='admin'\)throw error/);
  assert.match(source,/entry\.photoError=true/);
  assert.match(source,/if\(error\|\|!data\?\.signedUrl\)/);
  assert.match(source,/showPhotoUnavailable\(gallery\)/);
  assert.match(source,/role="status"/);
  assert.doesNotMatch(source,/createPublicUrl\(/);
});
