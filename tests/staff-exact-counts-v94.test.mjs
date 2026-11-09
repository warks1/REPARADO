import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchStaffWorkCounts,fetchStaffWorkPage,staffWorkPagedFilters}
  from '../staff-work-pages.js';

const operator='c0000000-0000-4000-8000-000000000003';
const totals={all:315,new:12,pending:62,agenda:37,active:19,finished:210};
function db({roleCount=null,failFilter=null,invalidCount=null}={}){
 const calls=[];
 const client={from(table){
   assert.equal(table,'service_requests');
   const item={filter:'all',role:null},trace=[['from',table]];
   calls.push({item,trace});
   const chain={
     select(fields,options){
       trace.push(['select',fields,options]);
       return this;
     },
     eq(field,value){
       trace.push(['eq',field,value]);
       if(field==='operator_id')item.role=value;
       if(field==='status')item.filter=value==='new'?'new':'active';
       return this;
     },
     in(field,values){
       trace.push(['in',field,values]);
       if(field==='status')item.filter=values.includes('completed')?'finished':
         values.includes('scheduled')?'agenda':'pending';
       return this;
     },
     then(resolve,reject){
       const filter=item.filter;
       const count=invalidCount===filter?null:
         roleCount===null?totals[filter]:roleCount[filter];
       return Promise.resolve({
         count,error:failFilter===filter?{code:'42501'}:null
       }).then(resolve,reject);
     },
     order(){return this},
     range(){return Promise.resolve({data:[],count:totals[item.filter],error:null})}
   };
   return chain;
 }};
 return {client,calls};
}

test('V94: todos los filtros muestran totales exactos, incluso con 315 servicios',async()=>{
 const {client,calls}=db();
 const result=await fetchStaffWorkCounts(client);
 assert.deepEqual(result,{error:false,counts:totals});
 assert.equal(calls.length,6);
 assert.deepEqual([...staffWorkPagedFilters],['all','new','pending','agenda','active','finished']);
 for(const call of calls){
   assert.ok(call.trace.some(r=>r[0]==='select'&&r[1]==='id'&&
     r[2].count==='exact'&&r[2].head===true));
   assert.equal(call.trace.some(r=>r[0]==='range'),false);
 }
});

test('V94: el operario restringe todas las consultas a su ID y no conoce otros trabajos',async()=>{
 const own={all:79,new:0,pending:6,agenda:11,active:3,finished:62};
 const {client,calls}=db({roleCount:own});
 const result=await fetchStaffWorkCounts(client,{operatorId:operator});
 assert.deepEqual(result,{error:false,counts:own});
 assert.equal(calls.length,6);
 for(const call of calls){
   assert.ok(call.trace.some(r=>r[0]==='eq'&&r[1]==='operator_id'&&r[2]===operator));
   assert.ok(!call.trace.some(r=>JSON.stringify(r).includes('auth.users')));
 }
});

test('V94: los filtros del resumen coinciden con los de la paginación',async()=>{
 for(const filter of staffWorkPagedFilters){
   const {client,calls}=db();
   const res=await fetchStaffWorkPage(client,{filter,page:0});
   assert.equal(res.error,false);
   const relevant=calls[0].trace.filter(row=>row[0]==='eq'||row[0]==='in');
   const countsDb=db();
   await fetchStaffWorkCounts(countsDb.client);
   const countTrace=countsDb.calls[staffWorkPagedFilters.indexOf(filter)].trace
     .filter(row=>row[0]==='eq'||row[0]==='in');
   assert.deepEqual(relevant,countTrace,filter);
 }
});

test('V94: un error o contador desconocido no se convierte en cero',async()=>{
 for(const bad of [
   {failFilter:'agenda'}, {invalidCount:'finished'}
 ]){
   const result=await fetchStaffWorkCounts(db(bad).client);
   assert.deepEqual(result,{counts:null,error:true});
 }
 assert.deepEqual(await fetchStaffWorkCounts(null),{counts:null,error:true});
 const {client,calls}=db();
 assert.deepEqual(await fetchStaffWorkCounts(client,{operatorId:'no-uuid'}),
   {counts:null,error:true});
 assert.equal(calls.length,0);
});

test('V94: se elimina el límite de 150 fichas y se mantienen bandejas privadas',()=>{
 const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 const admin=code.slice(code.indexOf('async function renderAdmin('),
    code.indexOf("    main.querySelectorAll('[data-admin-filter]')"));
 assert.ok(admin.includes('fetchStaffWorkCounts(supabase,{operatorId:admin?null:staffUserId})'));
 assert.ok(!admin.includes('baseJobs'));
 assert.ok(!admin.includes("jobCounters(recent)"));
 assert.ok(admin.includes('No se mostrarán cifras parciales como si fueran totales'));
 assert.ok(admin.includes('Trabajos totales'));
 assert.ok(admin.includes('Todos los contadores consultan el total real autorizado'));
 assert.ok(admin.includes("counts.new=newQueue.count"));
 assert.ok(admin.includes("unassigned:admin?unassignedQueue.count:0"));
 assert.ok(admin.includes('counts[filter]=filteredPage.count'));
 assert.ok(admin.includes('counts.finished'));
 assert.ok(admin.includes('fetchNewRequestsPage(supabase'));
 assert.ok(admin.includes('fetchUnassignedRequestsPage(supabase'));
});
