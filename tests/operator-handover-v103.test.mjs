import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchWorkReport,fetchWorkReports,fetchWorkTransfers} from '../operator-work-service.js';

const job='b0000000-0000-4000-8000-000000000002';
const op1='a0000000-0000-4000-8000-000000000001';
const op2='c0000000-0000-4000-8000-000000000003';
const active=()=>true;
function mockData(){
 const calls=[],rows=[
  {request_id:job,operator_id:op1,description:'Parte anterior',created_at:'2026-10-02T09:00:00Z'},
  {request_id:job,operator_id:op2,description:'Parte sustituto',created_at:'2026-10-03T09:00:00Z'}
 ];
 const transfers=[{request_id:job,previous_operator_id:op1,next_operator_id:op2,
  changed_at:'2026-10-03T08:00:00Z',status_at_transfer:'in_progress'}];
 return {calls,supabase:{from(table){
  calls.push(['from',table]);
  const query={
   eq(key,value){calls.push(['eq',key,value]);this.filterOperator=key==='operator_id'?value:this.filterOperator;return this},
   order(key,opts){calls.push(['order',key,opts]);return this},
   async maybeSingle(){return {data:rows.find(r=>r.operator_id===this.filterOperator)||null,error:null}},
   then(resolve){return Promise.resolve({data:table==='work_reports'?rows:transfers,error:null}).then(resolve)}
  };
  return {select(fields){calls.push(['select',fields]);return query}};
 }}};
}
test('V103: el nuevo operario solo consulta su parte, sin mezclarlo con el anterior',async()=>{
 const {supabase,calls}=mockData();
 const found=await fetchWorkReport({supabase,requestId:job,operatorId:op2,isActive:active});
 assert.equal(found.operator_id,op2);
 assert.equal(found.description,'Parte sustituto');
 assert.ok(calls.some(x=>x[0]==='eq'&&x[1]==='request_id'&&x[2]===job));
 assert.ok(calls.some(x=>x[0]==='eq'&&x[1]==='operator_id'&&x[2]===op2));
 await assert.rejects(()=>fetchWorkReport({
  supabase,requestId:job,operatorId:'invalid',isActive:active
 }),/Servicio no válido/);
});

test('V103: el propietario ve los dos partes y el traspaso cronológico',async()=>{
 const {supabase,calls}=mockData();
 const reports=await fetchWorkReports({supabase,requestId:job,isActive:active});
 const transfers=await fetchWorkTransfers({supabase,requestId:job,isActive:active});
 assert.equal(reports.length,2);
 assert.deepEqual(reports.map(x=>x.operator_id),[op1,op2]);
 assert.equal(transfers.length,1);
 assert.equal(transfers[0].previous_operator_id,op1);
 assert.equal(transfers[0].next_operator_id,op2);
 assert.ok(calls.some(x=>x[0]==='from'&&x[1]==='work_operator_transfers'));
 assert.ok(calls.some(x=>x[0]==='order'&&x[1]==='created_at'));
 assert.ok(calls.some(x=>x[0]==='order'&&x[1]==='changed_at'));
});

test('V103: la migración conserva la autoría, registra traspasos y evita falsificar el historial',()=>{
 const sql=readFileSync(new URL('../supabase/migration-v103-operator-handover.sql',import.meta.url),'utf8');
 assert.match(sql,/primary key \(request_id,operator_id\)/);
 assert.match(sql,/create table if not exists public\.work_operator_transfers/);
 assert.match(sql,/alter table public\.work_operator_transfers enable row level security/);
 assert.match(sql,/revoke all on public\.work_operator_transfers from public,anon,authenticated/);
 assert.match(sql,/using \(\(select public\.is_reparado_admin\(\)\)\)/);
 assert.match(sql,/REPARADO_COMPLETED_OPERATOR_LOCKED/);
 assert.match(sql,/REPARADO_TRANSFER_OWNER_ONLY/);
 assert.match(sql,/create trigger reparado_record_work_transfer_v103 after update of operator_id/);
 assert.match(sql,/on conflict \(request_id,operator_id\) do nothing/);
 assert.match(sql,/where request_id=p_request_id and operator_id=v_operator/);
 assert.match(sql,/revoke all on function public\.reparado_record_work_transfer_v103\(\)/);
});

test('V103: la interfaz del propietario muestra todos los partes y fotos y confirma el cambio',()=>{
 const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 const view=readFileSync(new URL('../operator-work-view.js',import.meta.url),'utf8');
 assert.match(connected,/original\.status==='in_progress'/);
 assert.match(connected,/window\.confirm\(/);
 assert.match(connected,/Traspaso cancelado/);
 assert.match(connected,/eq\('operator_id',original\.operator_id\)/);
 assert.match(connected,/eq\('status','in_progress'\)/);
 assert.match(connected,/Otro cambio se ha realizado antes que tú/);
 assert.match(view,/fetchWorkReports\(\{supabase,requestId,isActive\}\)/);
 assert.match(view,/fetchWorkTransfers\(\{supabase,requestId,isActive\}\)/);
 assert.match(view,/fetchWorkReport\(\{\s*supabase,requestId,operatorId:userId,isActive/);
 assert.match(view,/data-work-history/);
 assert.match(view,/data-work-report-operator/);
 assert.match(view,/photo\.operator_id\+'\/'\+requestId\+'\/'\+photo\.name/);
 assert.match(view,/data-work-photo-count/);
});

test('V103: PostgreSQL mantiene RLS sobre partes y bucket privado después del cambio',()=>{
 const sql=readFileSync(new URL('../supabase/migration-v103-operator-handover.sql',import.meta.url),'utf8');
 assert.match(sql,/select relrowsecurity from pg_class/);
 assert.match(sql,/id='work-photos' and not public/);
 assert.match(sql,/grant select on public\.work_operator_transfers to authenticated/);
 assert.match(sql,/for select to authenticated using \(\(select public\.is_reparado_admin\(\)\)\)/);
});


test('V103: la agenda exige confirmación y bloquea un traspaso obsoleto',async()=>{
 const {saveOwnerVisit}=await import('../owner-calendar.js');
 const current={id:job,status:'in_progress',operator_id:op1,
   scheduled_at:'2026-11-10T09:00:00.000Z'};
 const ops=[{id:op2,full_name:'Operario sustituto',role:'operator'}];
 let modified=0;
 const db={from(){
  const query={
   select(){return this},
   eq(){return this},
   in(){return this},
   gte(){return this},
   async lt(){return {data:[],error:null}},
   update(){modified++;return this},
   async selectResult(){return {data:[],error:null}}
  };
  return {
    select(){return query},
    update(){modified++;return {
      eq(){return this},
      async select(){return {data:[{id:job,status:'in_progress',
        operator_id:op2,scheduled_at:'2026-11-10T09:00:00.000Z'}],error:null}}
    }}
  };
 }};
 const blocked=await saveOwnerVisit(db,{job:current,operatorId:op2,
   datetime:'2026-11-10T10:00',operators:ops});
 assert.equal(blocked.ok,false);
 assert.match(blocked.message,/Confirma expresamente/);
 assert.equal(modified,0);

 const accepted=await saveOwnerVisit(db,{job:current,operatorId:op2,
   datetime:'2026-11-10T10:00',operators:ops,handoverConfirmed:true});
 assert.equal(accepted.ok,true);
 assert.equal(modified,1);
});

test('V103: el calendario del propietario avisa de traspasos en curso',()=>{
 const source=readFileSync(new URL('../owner-calendar.js',import.meta.url),'utf8');
 assert.match(source,/handoverConfirmed=false/);
 assert.match(source,/const handover=job\.status==='in_progress'/);
 assert.match(source,/if\(handover\)update=update\.eq\('operator_id',job\.operator_id\)/);
 assert.match(source,/window\.confirm\(/);
 assert.match(source,/Traspaso cancelado/);
 const sql=readFileSync(new URL('./operator-handover-v103.sql',import.meta.url),'utf8');
 assert.match(sql,/^begin;/im);
 assert.match(sql,/\brollback;\s*$/i);
 assert.match(sql,/V103_FORMER_OPERATOR_CAN_STILL_READ/);
 assert.match(sql,/V103_HISTORY_OR_COMPLETION_NOT_PRESERVED/);
});
