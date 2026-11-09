import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchStaffWorkPage,staffWorkPageSize,staffWorkPageCount,staffWorkCanAdvance,
  staffWorkPagedFilters} from '../staff-work-pages.js';

const op='b0000000-0000-4000-8000-000000000002';
function mock(rows=[],count=251,error=null){
 const calls=[];
 const db={from(table){
  calls.push(['from',table]);
  const chain={
   select(fields,opt){calls.push(['select',fields,opt]);return this},
   eq(key,val){calls.push(['eq',key,val]);return this},
   in(key,vals){calls.push(['in',key,vals]);return this},
   order(key,opt){calls.push(['order',key,opt]);return this},
   async range(start,end){
    calls.push(['range',start,end]);
    return {data:rows,count,error}
   }
  };
  return chain;
 }};
 return {db,calls};
}

test('V92: estados y paginación estables no limitan el historial a 150',async()=>{
 const {db,calls}=mock([{id:'1'}],311);
 const result=await fetchStaffWorkPage(db,{filter:'all',page:3});
 assert.equal(result.error,false);
 assert.equal(result.count,311);
 assert.equal(result.data.length,1);
 assert.ok(calls.some(c=>c[0]==='select'&&c[2].count==='exact'));
 assert.deepEqual(calls.find(c=>c[0]==='range'),['range',3*staffWorkPageSize,4*staffWorkPageSize-1]);
 assert.ok(calls.some(c=>c[0]==='order'&&c[1]==='created_at'&&c[2].ascending===false));
 assert.ok(calls.some(c=>c[0]==='order'&&c[1]==='id'));
 assert.equal(staffWorkPageCount(311),7);
 assert.equal(staffWorkCanAdvance(5,311),true);
 assert.equal(staffWorkCanAdvance(6,311),false);
});

test('V92: la agenda se pagina por la fecha de visita',async()=>{
 const {db,calls}=mock([{id:'4'}],2);
 const result=await fetchStaffWorkPage(db,{filter:'agenda',page:0,operatorId:op});
 assert.equal(result.error,false);
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='operator_id'&&c[2]===op));
 assert.deepEqual(calls.find(c=>c[0]==='in'),['in','status',['scheduled','in_progress']]);
 assert.ok(calls.some(c=>c[0]==='order'&&c[1]==='scheduled_at'&&c[2].ascending===true));
});

test('V92: filtro aplica restricciones del servidor y mantiene RLS',async()=>{
 const expected={
  new:['eq','status','new'],
  pending:['in','status',['new','quoted','accepted']],
  active:['eq','status','in_progress'],
  finished:['in','status',['completed','cancelled']]
 };
 for(const [filter,where] of Object.entries(expected)){
  const {db,calls}=mock([],0);
  assert.equal((await fetchStaffWorkPage(db,{filter})).error,false);
  assert.deepEqual(calls.find(c=>c[0]===where[0]&&c[1]==='status'),where);
 }
 assert.deepEqual([...staffWorkPagedFilters],['all','new','pending','agenda','active','finished']);
});

test('V92: entradas inválidas no generan consultas y errores no falsifican recuentos',async()=>{
 const {db,calls}=mock();
 for(const x of [{filter:'unassigned'},{filter:'fake'},{page:-1},{page:100001},
                 {page:1.7},{operatorId:'no-es-uuid'}]){
  assert.equal((await fetchStaffWorkPage(db,x)).error,true);
 }
 assert.deepEqual(calls,[]);
 assert.equal((await fetchStaffWorkPage(null,{})).error,true);
 assert.equal((await fetchStaffWorkPage(mock([],0,{code:'42501'}).db,{})).error,true);
});

test('V92: panel conecta navegación por páginas para administrador y operario',()=>{
 const src=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(src.includes("import {fetchStaffWorkPage,fetchStaffWorkCounts,staffWorkPageCount,staffWorkCanAdvance,staffWorkSearchTerm,staffWorkSearchFields}"));
 assert.ok(src.includes('fetchStaffWorkPage(supabase,{'));
 assert.ok(src.includes('operatorId:admin?null:staffUserId'));
 assert.ok(src.includes('data-staff-work-page="prev"'));
 assert.ok(src.includes('data-staff-work-page="next"'));
 assert.ok(src.includes("const all=admin && filter==='new' ? newQueue.data"));
 assert.ok(src.includes("filteredPage.data"));
 assert.ok(src.includes('staffWorkPage=0;'));
 assert.ok(src.includes('Historial completo por páginas de 50'));
});
