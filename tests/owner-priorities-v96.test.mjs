import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchOwnerOperationalCounts,ownerPriorityCountsFromMetrics,
  ownerPriorityMarkup,ownerPriorityTasks} from '../owner-priorities.js';
import {ownerDashboardMarkup,ownerMetrics,ownerSections} from '../owner-dashboard.js';

const now=new Date('2026-11-09T15:30:00.000Z');
function db({accepted=7,past=3,fail=null,missingCount=false}={}){
  const calls=[];
  return {calls,client:{from(table){
    const trace=[['from',table]];
    calls.push(trace);
    const qb={
      select(...args){trace.push(['select',...args]);return this},
      eq(...args){trace.push(['eq',...args]);return this},
      is(...args){trace.push(['is',...args]);return this},
      in(...args){trace.push(['in',...args]);return this},
      lt(...args){trace.push(['lt',...args]);return this},
      then(resolve,reject){
        const kind=trace.some(r=>r[0]==='is')?'accepted':'past';
        return Promise.resolve({
          count:missingCount&&kind==='past'?null:(kind==='accepted'?accepted:past),
          error:fail===kind?{code:'42501',message:'Sin permiso'}:null
        }).then(resolve,reject);
      }
    };
    return qb;
  }}};
}

test('V96: cuenta presupuestos aceptados sin operario y visitas pasadas sin finalizar',async()=>{
 const {client,calls}=db({accepted:8,past:2});
 assert.deepEqual(await fetchOwnerOperationalCounts(client,now),{
   counts:{acceptedUnassigned:8,pastVisits:2},error:false
 });
 assert.equal(calls.length,2);
 const accepted=calls.find(x=>x.some(c=>c[0]==='is'));
 assert.deepEqual(accepted,[
  ['from','service_requests'],
  ['select','id',{count:'exact',head:true}],
  ['eq','status','accepted'],
  ['is','operator_id',null]
 ]);
 const overdue=calls.find(x=>x.some(c=>c[0]==='lt'));
 assert.deepEqual(overdue,[
  ['from','service_requests'],
  ['select','id',{count:'exact',head:true}],
  ['in','status',['scheduled','in_progress']],
  ['lt','scheduled_at','2026-11-09T15:30:00.000Z']
 ]);
 assert.ok(calls.every(trace=>!trace.some(row=>JSON.stringify(row).includes('phone'))));
});

test('V96: ninguna caída de red, error de RLS o cuenta inválida se convierte en cero',async()=>{
 for(const opts of [{fail:'accepted'},{fail:'past'},{missingCount:true}]){
  assert.deepEqual(await fetchOwnerOperationalCounts(db(opts).client,now),
    {counts:null,error:true});
 }
 assert.deepEqual(await fetchOwnerOperationalCounts(null,now),{counts:null,error:true});
 assert.deepEqual(await fetchOwnerOperationalCounts(db().client,new Date(NaN)),
   {counts:null,error:true});
 assert.deepEqual(await fetchOwnerOperationalCounts(db().client,'2026-11-09'),
   {counts:null,error:true});
});

test('V96: cuatro prioridades reutilizan métricas auténticas y no inventan estados',()=>{
 assert.deepEqual(ownerPriorityCountsFromMetrics(
   {support:5,reviews:2},{acceptedUnassigned:11,pastVisits:4}),{
   acceptedUnassigned:11,pastVisits:4,support:5,reviews:2
 });
 assert.deepEqual(ownerPriorityCountsFromMetrics(null,null),{
   acceptedUnassigned:null,pastVisits:null,support:null,reviews:null
 });
 assert.equal(ownerPriorityTasks.length,4);
 const html=ownerPriorityMarkup({support:0,reviews:2},
   {acceptedUnassigned:11,pastVisits:4});
 assert.equal((html.match(/class="owner-priority-card"/g)||[]).length,4);
 for(const text of ['Aceptados sin operario','Visitas anteriores sin cerrar',
  'Incidencias abiertas','Reseñas por moderar']){
  assert.ok(html.includes(text),text);
 }
 assert.ok(html.includes('data-owner-target="owner-calendar"'));
 assert.ok(html.includes('data-owner-filter="agenda"'));
 assert.ok(html.includes('data-owner-target="support-admin"'));
 assert.ok(html.includes('data-owner-target="review-moderation"'));
 assert.ok(html.includes('no indica por sí sola un retraso'));
 assert.ok(html.includes('>0</span>'));
 const unknown=ownerPriorityMarkup();
 assert.equal((unknown.match(/>—<\/span>/g)||[]).length,4);
});

test('V96: métricas y prioridades se actualizan juntas en el panel privado',()=>{
 const html=ownerDashboardMarkup(
   Object.fromEntries(ownerMetrics.map(m=>[m.id,3])),
   {acceptedUnassigned:5,pastVisits:0}
 );
 assert.equal((html.match(/class="owner-metric"/g)||[]).length,10);
 assert.equal((html.match(/class="owner-module"/g)||[]).length,12);
 assert.equal((html.match(/class="owner-priority-card"/g)||[]).length,4);
 const src=readFileSync(new URL('../owner-dashboard.js',import.meta.url),'utf8');
 assert.ok(src.includes('fetchOwnerOperationalCounts(supabase)'));
 assert.ok(src.includes('if(!root.isConnected||!isActive()||id!==refreshId)return;'));
 assert.ok(src.includes("root.querySelector('[data-owner-priorities]').replaceWith("));
 assert.ok(src.includes("const btn=event.target.closest('[data-owner-target]')"));
 assert.ok(src.includes('algunas prioridades no se pudieron comprobar'));
 const conn=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(conn.includes("const ownerOnly=()=>Boolean(session?.user?.id&&profile?.role==='admin')"));
 assert.ok(conn.includes("if(!ownerOnly()){if(!session)showLogin();else renderHome();return}"));
 assert.equal(ownerSections.length,12);
});
