import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newRequestsPageSize,newRequestsPageBounds,newRequestsPageCount,
  canAdvanceNewRequests,fetchNewRequestsCount,fetchNewRequestsPage} from '../staff-inbox.js';

function db({count=172,fail=false,invalidCount=false}={}){
  const calls=[];
  const fake={from(table){
    calls.push(['from',table]);
    return {select(fields,options){
      calls.push(['select',fields,options]);
      const qb={
        eq(key,val){calls.push(['eq',key,val]);return qb},
        order(col,opts){calls.push(['order',col,opts]);return qb},
        range(start,end){
          calls.push(['range',start,end]);
          const last=Math.min(end,count-1);
          const data=last<start?[]:Array.from({length:last-start+1},(_,i)=>({id:'job-'+(start+i+1),status:'new'}));
          return Promise.resolve(fail?{error:{message:'offline'},data:null,count:null}:
            {error:null,data,count:invalidCount?null:count});
        },
        then(resolve,reject){return Promise.resolve(fail?{error:{message:'offline'},count:null}:
          {error:null,count:invalidCount?null:count}).then(resolve,reject)}
      };
      return qb;
    }};
  }};
  return {fake,calls};
}

test('V68: páginas de 50 sin límite artificial de 150 solicitudes',()=>{
  assert.equal(newRequestsPageSize,50);
  assert.deepEqual(newRequestsPageBounds(0),{start:0,end:49});
  assert.deepEqual(newRequestsPageBounds(1),{start:50,end:99});
  assert.deepEqual(newRequestsPageBounds(3),{start:150,end:199});
  assert.equal(newRequestsPageCount(172),4);
  assert.equal(newRequestsPageCount(0),0);
  assert.equal(newRequestsPageCount(null),0);
  assert.equal(canAdvanceNewRequests(2,172),true);
  assert.equal(canAdvanceNewRequests(3,172),false);
  for(const p of [-1,1.5,Infinity,NaN,100001,'2'])assert.throws(()=>newRequestsPageBounds(p));
});

test('V68: contador real HEAD con filtrado de estado en Supabase',async()=>{
  const {fake,calls}=db({count:172});
  const info=await fetchNewRequestsCount(fake);
  assert.deepEqual(info,{count:172,error:false});
  assert.deepEqual(calls,[
    ['from','service_requests'],
    ['select','id',{count:'exact',head:true}],
    ['eq','status','new']
  ]);
});

test('V68: cuarta página obtiene solicitudes más antiguas que las primeras 150',async()=>{
  const {fake,calls}=db({count:172});
  const result=await fetchNewRequestsPage(fake,'id,status',3);
  assert.equal(result.error,false);
  assert.equal(result.count,172);
  assert.equal(result.data.length,22);
  assert.equal(result.data[0].id,'job-151');
  assert.equal(result.data.at(-1).id,'job-172');
  assert.deepEqual(calls,[
    ['from','service_requests'],
    ['select','id,status',{count:'exact'}],
    ['eq','status','new'],
    ['order','created_at',{ascending:false}],
    ['range',150,199]
  ]);
});

test('V68: fallos de recuento no se interpretan como cero trabajos',async()=>{
  for(const options of [{fail:true},{invalidCount:true}]){
    const {fake}=db(options);
    assert.deepEqual(await fetchNewRequestsCount(fake),{count:null,error:true});
    assert.deepEqual(await fetchNewRequestsPage(fake,'id',0),{data:null,count:null,error:true});
  }
  assert.deepEqual(await fetchNewRequestsPage(db().fake,'id',-1),
    {data:null,count:null,error:true});
});

test('V68: administración usa datos privados de consulta paginada y vuelve a comprobar permisos',()=>{
  const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.ok(code.includes("if(!userIsStaff()){renderHome();return}"));
  assert.ok(code.includes("fetchStaffWorkCounts(supabase,{operatorId:admin?null:staffUserId})"));
  assert.ok(code.includes("filter==='new'\n             ? fetchNewRequestsPage"));
  assert.ok(code.includes("fetchNewRequestsCount(supabase)"));
  assert.ok(code.includes("const all=admin && filter==='new' ? newQueue.data : admin && filter==='unassigned' ? unassignedQueue.data : filteredPage.data"));
  assert.ok(code.includes("if(admin && newQueue?.error)"));
  assert.ok(code.includes("Recuento de todas las solicitudes nuevas del servidor"));
  assert.ok(code.includes('staff-new-pagination'));
  assert.ok(code.includes('data-new-page="prev"'));
  assert.ok(code.includes('data-new-page="next"'));
  assert.ok(code.includes('canAdvanceNewRequests(newRequestsPage,counts.new)'));
  assert.ok(code.includes("if(btn.dataset.adminFilter!==adminFilter){"));
  assert.ok(code.includes("newRequestsPage=0;"));
  assert.ok(code.includes("unassignedRequestsPage=0;"));
});

test('V68: conserva accesibilidad de la paginación y no declara emails activos',()=>{
  const css=readFileSync(new URL('../vivid-theme.css',import.meta.url),'utf8');
  assert.match(css,/\.staff-new-pagination/);
  assert.match(css,/staff-new-pagination button:focus-visible/);
  const markup=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.match(markup,/aria-label="Páginas de solicitudes nuevas"/);
  assert.match(markup,/los avisos por correo dependen de una configuración externa/);
});
