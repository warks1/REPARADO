import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const view=readFileSync(new URL('../operator-work-view.js',import.meta.url),'utf8');
const operatorA='a0000000-0000-4000-8000-000000000001';
const operatorB='b0000000-0000-4000-8000-000000000002';
const requestId='c0000000-0000-4000-8000-000000000003';
const job={id:requestId,operator_id:operatorB,status:'completed',
 service_name:'Instalación eléctrica',street:'Calle Prueba',address_number:'1',
 city:'Barcelona',description:'Servicio completado',
 work_started_at:'2026-11-10T09:00:00.000Z',
 work_finished_at:'2026-11-10T10:00:00.000Z'};

const render=(role,history,photos)=>{
 // Evaluar únicamente funciones puras de presentación; no se ejecuta
 // ningún fetch, handler, sesión ni acceso a Supabase en esta prueba.
 const pure=view.slice(view.indexOf('const UUID='),view.indexOf('export async function mountOperatorWork'));
 const fn=vm.runInNewContext(pure+';viewMarkup;',{
   mayStartWork:()=>false,mayFinishWork:()=>false,
   MAX_WORK_PHOTOS:8,WORK_DESCRIPTION_MAX:4000
 });
 return fn(job,history.find(x=>x.operator_id===operatorB)||null,photos,{
   role,userId:operatorB,history,transfers:[]
 });
};

test('V104: las fotos del propietario quedan junto al parte del operario que las subió',()=>{
 const history=[
  {operator_id:operatorA,description:'Revisión de instalación anterior.',
   created_at:'2026-11-10T09:00:00.000Z',photoCount:2,
   operator_label:'Operario A'},
  {operator_id:operatorB,description:'Reparación y verificación.',
   created_at:'2026-11-10T10:00:00.000Z',photoCount:1,
   operator_label:'Operario B'}
 ];
 const photos=[
  {operator_id:operatorA,name:'foto-'+('ab'.repeat(32))+'.jpg'},
  {operator_id:operatorA,name:'foto-'+('cd'.repeat(32))+'.jpg'},
  {operator_id:operatorB,name:'foto-'+('ef'.repeat(32))+'.jpg'}
 ];
 const html=render('admin',history,photos);
 assert.match(html,/3 fotografías del historial/);
 assert.match(html,/Fotografías de Operario A/);
 assert.match(html,/Fotografías de Operario B/);
 assert.match(html,/data-work-gallery-operator="a0000000-0000-4000-8000-000000000001"/);
 assert.match(html,/data-work-gallery-operator="b0000000-0000-4000-8000-000000000002"/);
 assert.equal((html.match(/data-work-gallery-operator=/g)||[]).length,2);
 assert.ok(html.indexOf('Revisión de instalación anterior.') <
   html.indexOf('data-work-gallery-operator="'+operatorA+'"'));
 assert.ok(html.indexOf('Reparación y verificación.') <
   html.indexOf('data-work-gallery-operator="'+operatorB+'"'));
 assert.doesNotMatch(html,/\sdata-work-gallery(?=[\s>])/);
});

test('V104: no mezcla fotos, fechas ni campos editables de otro operario',()=>{
 const history=[
  {operator_id:operatorA,description:'Parte previo',photoCount:0},
  {operator_id:operatorB,description:'Parte actual',photoCount:1}
 ];
 const html=render('admin',history,[{operator_id:operatorB,name:'foto-123.jpg'}]);
 assert.match(html,/Sin fotografías de esta intervención/);
 assert.doesNotMatch(html,/data-work-finish/);
 assert.doesNotMatch(html,/name="work_description"/);
 assert.ok(html.includes('Parte previo'));
 assert.ok(html.includes('Parte actual'));
});

test('V104: el operario conserva su galería única y la descripción de trabajo',()=>{
 const history=[{operator_id:operatorB,description:'Trabajo completado',photoCount:1}];
 const html=render('operator',history,[{operator_id:operatorB,name:'foto-abc.jpg'}]);
 assert.match(html,/data-work-gallery aria-label="Fotos del trabajo"/);
 assert.doesNotMatch(html,/data-work-gallery-operator=/);
 assert.match(html,/data-work-description/);
 assert.match(html,/1 de 8 fotografías adjuntas/);
});

test('V104: los enlaces firmados siguen separados por carpeta de operario',()=>{
 assert.match(view,/photo\.operator_id\+'\/'\+requestId\+'\/'\+photo\.name/);
 assert.match(view,/screen\.querySelector\('\[data-work-gallery-operator=/);
 assert.match(view,/createSignedUrl\(path,120\)/);
 assert.match(view,/link\.rel='noopener noreferrer'/);
 assert.match(view,/img\.alt='Foto del trabajo de '/);
});
