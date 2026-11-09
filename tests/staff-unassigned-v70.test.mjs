import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterUnassignedRequestQuery,fetchUnassignedRequestsCount,
  fetchUnassignedRequestsPage,unassignedActiveStatuses} from '../staff-unassigned.js';
import {newRequestsPageCount,canAdvanceNewRequests} from '../staff-inbox.js';

function mockRequests({count=187,networkError=false,missingCount=false}={}){
  const calls=[];
  const query={
    is(field,val){calls.push(['is',field,val]);return query},
    in(field,values){calls.push(['in',field,[...values]]);return query},
    order(field,opts){calls.push(['order',field,opts]);return query},
    range(start,end){
      calls.push(['range',start,end]);
      const rows=Array.from({length:Math.max(0,Math.min(end,count-1)-start+1)},
        (_,i)=>({id:`r-${start+i+1}`,operator_id:null,status:'accepted'}));
      return Promise.resolve(networkError?{data:null,count:null,error:{message:'offline'}}:
        {data:rows,count:missingCount?null:count,error:null});
    },
    then(resolve,reject){return Promise.resolve(networkError?
      {data:null,count:null,error:{message:'offline'}}:
      {count:missingCount?null:count,error:null}).then(resolve,reject);}
  };
  return {
    calls,
    client:{from(table){
      calls.push(['from',table]);
      return {select(cols,opts){calls.push(['select',cols,opts]);return query}};
    }}
  };
}

test('V70: filtro de sin operario se aplica en SQL antes de paginar',()=>{
  const {calls}=mockRequests();
  const dummy={is(field,val){calls.push(['is',field,val]);return this},
    in(field,values){calls.push(['in',field,values]);return this}};
  filterUnassignedRequestQuery(dummy);
  assert.deepEqual(calls,[
    ['is','operator_id',null],
    ['in','status',['new','quoted','accepted','scheduled','in_progress']]
  ]);
  assert.equal(unassignedActiveStatuses.includes('completed'),false);
  assert.equal(unassignedActiveStatuses.includes('cancelled'),false);
  assert.equal(Object.isFrozen(unassignedActiveStatuses),true);
});

test('V70: contador global exacto no depende de los últimos 150',async()=>{
  const {client,calls}=mockRequests({count:187});
  assert.deepEqual(await fetchUnassignedRequestsCount(client),{count:187,error:false});
  assert.deepEqual(calls,[
    ['from','service_requests'],
    ['select','id',{count:'exact',head:true}],
    ['is','operator_id',null],
    ['in','status',['new','quoted','accepted','scheduled','in_progress']]
  ]);
});

test('V70: página 4 recoge trabajos 151 a 187, aunque estén fuera de la vista reciente',async()=>{
  const {client,calls}=mockRequests({count:187});
  const res=await fetchUnassignedRequestsPage(client,'id,operator_id,status',3);
  assert.equal(res.error,false);
  assert.equal(res.count,187);
  assert.equal(res.data.length,37);
  assert.equal(res.data[0].id,'r-151');
  assert.equal(res.data.at(-1).id,'r-187');
  assert.deepEqual(calls,[
    ['from','service_requests'],
    ['select','id,operator_id,status',{count:'exact'}],
    ['is','operator_id',null],
    ['in','status',['new','quoted','accepted','scheduled','in_progress']],
    ['order','created_at',{ascending:false}],
    ['range',150,199]
  ]);
  assert.equal(newRequestsPageCount(187),4);
  assert.equal(canAdvanceNewRequests(2,187),true);
  assert.equal(canAdvanceNewRequests(3,187),false);
});

test('V70: contador desconocido o corte de red nunca se interpreta como 0',async()=>{
  for(const opts of [{networkError:true},{missingCount:true}]){
    const {client}=mockRequests(opts);
    assert.deepEqual(await fetchUnassignedRequestsCount(client),{count:null,error:true});
    assert.deepEqual(await fetchUnassignedRequestsPage(client,'id',0),
      {count:null,data:null,error:true});
  }
  const {client}=mockRequests();
  assert.deepEqual(await fetchUnassignedRequestsPage(client,'id',-1),
    {count:null,data:null,error:true});
});

test('V70: solo administrador consulta la segunda bandeja global y conserva RLS',()=>{
  const app=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.ok(app.includes("if(!userIsStaff()){renderHome();return}"));
  assert.ok(app.includes("fetchStaffWorkCounts(supabase,{operatorId:admin?null:staffUserId})"));
  assert.ok(app.includes("filter==='unassigned'"));
  assert.ok(app.includes("fetchUnassignedRequestsCount(supabase)"));
  assert.ok(app.includes("fetchUnassignedRequestsPage(supabase"));
  assert.ok(app.includes("unassigned:admin?unassignedQueue.count:0"));
  assert.ok(app.includes("if(admin && unassignedQueue?.error)"));
  assert.ok(app.includes("filter==='unassigned' && unassignedRequestsPage>="));
  assert.ok(app.includes("const all=admin && filter==='new' ? newQueue.data : admin && filter==='unassigned' ? unassignedQueue.data : filteredPage.data"));
  assert.ok(app.includes("No se mostrará un recuento incompleto"));
  assert.ok(app.includes("Sin operario"));
  assert.ok(app.includes("data-admin-filter=\"unassigned\""));
  assert.ok(app.includes('aria-label="Páginas de trabajos sin operario"'));
  assert.ok(app.includes('data-unassigned-page="prev"'));
  assert.ok(app.includes('data-unassigned-page="next"'));
  assert.ok(app.includes("unassignedRequestsPage=0"));
});

test('V70: la interfaz indica la diferencia entre la bandeja completa y los trabajos recientes',()=>{
  const app=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.ok(app.includes("Trabajos sin operario consultados directamente en Supabase, de 50 en 50."));
  assert.ok(app.includes("Historial completo por páginas de 50"));
  assert.ok(app.includes('Sin operario (total)'));
  assert.ok(app.includes("los avisos por correo dependen de una configuración externa"));
  const css=readFileSync(new URL('../vivid-theme.css',import.meta.url),'utf8');
  assert.ok(css.includes(".staff-new-pagination button:focus-visible"));
  assert.ok(css.includes("@media(max-width:540px)"));
});
