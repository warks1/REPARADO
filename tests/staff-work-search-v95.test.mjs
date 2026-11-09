import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchStaffWorkPage,staffWorkSearchFields,staffWorkSearchTerm,staffWorkPageSize}
  from '../staff-work-pages.js';

const technician='c0000000-0000-4000-8000-000000000003';
function mock({data=[],count=0,error=null}={}){
 const calls=[];
 const chain={
  select(...args){calls.push(['select',...args]);return this},
  eq(...args){calls.push(['eq',...args]);return this},
  in(...args){calls.push(['in',...args]);return this},
  ilike(...args){calls.push(['ilike',...args]);return this},
  order(...args){calls.push(['order',...args]);return this},
  async range(...args){calls.push(['range',...args]);return {data,count,error}}
 };
 return {calls,db:{from(table){calls.push(['from',table]);return chain}}};
}

test('V95: normalización protege comodines, espacios, extensión y Unicode',()=>{
 assert.deepEqual([...staffWorkSearchFields],['service_name','city','phone']);
 assert.equal(staffWorkSearchTerm('  Cambio   de %_*\\ enchufe  '),'Cambio de enchufe');
 assert.equal(staffWorkSearchTerm('  Barcelona  '),'Barcelona');
 assert.equal(staffWorkSearchTerm('+34  600  123 456'),'+34 600 123 456');
 assert.equal(staffWorkSearchTerm(null),'');
 assert.equal(staffWorkSearchTerm('A'.repeat(100)).length,64);
});

test('V95: busca por servicio en toda la paginación en Supabase',async()=>{
 const {db,calls}=mock({data:[{id:'x'}],count:4});
 const result=await fetchStaffWorkPage(db,{
   filter:'finished',page:2,searchField:'service_name',
   searchTerm:'  Reparación %_ de   fugas '
 });
 assert.deepEqual(result,{data:[{id:'x'}],count:4,error:false});
 assert.ok(calls.some(c=>c[0]==='in'&&c[1]==='status'&&
   c[2].includes('completed')));
 assert.deepEqual(calls.find(c=>c[0]==='ilike'),
   ['ilike','service_name','%Reparación de fugas%']);
 assert.deepEqual(calls.find(c=>c[0]==='range'),
   ['range',2*staffWorkPageSize,3*staffWorkPageSize-1]);
 assert.ok(calls.some(c=>c[0]==='select'&&c[2].count==='exact'));
});

test('V95: población y teléfono aplican consulta filtrada antes de paginar',async()=>{
 for(const [field,term] of [
  ['city','Tarragona'],
  ['phone','600 123'],
 ]){
  const {db,calls}=mock({count:9});
  const result=await fetchStaffWorkPage(db,{
    filter:'all',page:0,searchField:field,searchTerm:term
  });
  assert.equal(result.error,false);
  assert.deepEqual(calls.find(c=>c[0]==='ilike'),['ilike',field,'%'+term+'%']);
  assert.ok(calls.findIndex(c=>c[0]==='ilike')<
    calls.findIndex(c=>c[0]==='range'));
 }
});

test('V95: búsquedas del operario restringidas a su ID y RLS',async()=>{
 const {db,calls}=mock({count:2});
 const res=await fetchStaffWorkPage(db,{
  filter:'agenda',page:0,operatorId:technician,searchField:'city',searchTerm:'Barcelona'
 });
 assert.equal(res.error,false);
 assert.deepEqual(calls.find(c=>c[0]==='eq'&&c[1]==='operator_id'),
   ['eq','operator_id',technician]);
 assert.deepEqual(calls.find(c=>c[0]==='ilike'),['ilike','city','%Barcelona%']);
 assert.deepEqual(calls.find(c=>c[0]==='in'),
   ['in','status',['scheduled','in_progress']]);
 assert.ok(!calls.some(c=>JSON.stringify(c).includes('auth.users')));
});

test('V95: campos manipulados, UUID inválidos y errores no muestran otros trabajos',async()=>{
 const {db,calls}=mock();
 for(const opts of [
  {searchField:'role',searchTerm:'admin'},
  {searchField:'customer_id',searchTerm:'x'},
  {searchField:'service_name);drop table',searchTerm:'x'},
  {operatorId:'no-id',searchTerm:'Madrid'}
 ]){
  assert.equal((await fetchStaffWorkPage(db,opts)).error,true);
 }
 assert.equal(calls.length,0);
 assert.equal((await fetchStaffWorkPage(mock({error:{code:'42501'}}).db,{
   searchTerm:'Barcelona'
 })).error,true);
 const clean=mock();
 assert.equal((await fetchStaffWorkPage(clean.db,{searchTerm:'%_*\\'})).error,false);
 assert.equal(clean.calls.some(c=>c[0]==='ilike'),false);
});

test('V95: interfaz conserva totales globales y limpia filtro al cambiar pestaña',()=>{
 const source=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 const start=source.indexOf('async function renderAdmin(');
 const admin=source.slice(start,source.indexOf("    main.querySelectorAll('[data-new-page=",start));
 assert.ok(admin.includes("searchTerm:staffSearchTerm,searchField:staffSearchField"));
 assert.ok(admin.includes('data-staff-work-search'));
 assert.ok(admin.includes('data-staff-search-clear'));
 assert.ok(admin.includes('staffWorkSearchTerm('));
 assert.ok(admin.includes('staffWorkSearchFields.includes(field)'));
 assert.ok(admin.includes("&&!staffSearchTerm"));
 assert.ok(admin.includes('Los indicadores de arriba muestran los totales generales.'));
 assert.ok(admin.includes("staffSearchTerm=''"));
 assert.ok(admin.includes('staffWorkPage=0'));
 const css=readFileSync(new URL('../vivid-theme.css',import.meta.url),'utf8');
 assert.ok(css.includes('.staff-work-search'));
 assert.ok(css.includes('@media(max-width:760px)'));
});
