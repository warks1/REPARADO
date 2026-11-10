import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ownerDeletionPageSize,ownerDeletionPageCount,
  fetchOwnerDeletionCount,fetchOwnerDeletionPage,
  beginOwnerDeletionReview
} from '../owner-deletions.js';
import {ownerDashboardMarkup,ownerSections} from '../owner-dashboard.js';

const requestId='a0000000-0000-4000-8000-000000000001';
const customerId='b0000000-0000-4000-8000-000000000002';

function pendingDb({status='requested',count=1,updateData=null}={}){
  const calls=[],entry={
    id:requestId,user_id:customerId,status,
    requested_at:'2026-11-10T10:00:00Z',completed_at:null
  };
  const db={from(table){
    calls.push(['from',table]);
    if(table==='profiles')return {
      select(cols){calls.push(['profiles-select',cols]);return this},
      async in(field,ids){
        calls.push(['profiles-filter',field,ids]);
        return {data:[{id:customerId,full_name:'Cliente de pruebas',
          phone:'600000000',role:'customer'}],error:null};
      }
    };
    assert.equal(table,'account_deletion_requests');
    return {
      select(cols,options){
        calls.push(['select',cols,options]);
        return this;
      },
      in(field,values){calls.push(['in',field,values]);return this},
      eq(field,val){
        calls.push(['eq',field,val]);
        if(this.countMode)return Promise.resolve({count,error:null});
        return this;
      },
      order(field,opts){calls.push(['order',field,opts]);return this},
      async range(start,end){
        calls.push(['range',start,end]);
        return {data:[entry],count,error:null};
      },
      update(values){
        calls.push(['update',values]);
        return {
          eq(field,val){calls.push(['update-eq',field,val]);return this},
          async select(fields){
            calls.push(['update-select',fields]);
            return {data:updateData??[{id:requestId,status:'in_review'}],error:null};
          }
        };
      }
    };
  }};
  return {db,calls};
}

test('V105: el propietario tiene una sección privada nueva sin cambiar métricas previas',()=>{
  assert.equal(ownerSections.length,14);
  const card=ownerSections.find(x=>x.view==='owner-deletions');
  assert.match(card.title,/Privacidad/);
  assert.match(ownerDashboardMarkup(null,null,null,4),/4 recibida\(s\)/);
  assert.match(ownerDashboardMarkup(),/data-owner-target="owner-deletions"/);
  const js=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.match(js,/import \{mountOwnerDeletionInbox\} from '\.\/owner-deletions\.js'/);
  assert.match(js,/if\(view==='owner-deletions'\)return showOwnerDeletions\(\)/);
  assert.match(js,/currentView==='owner-deletions'&&isCurrentUser\(ownerId\)/);
  assert.match(js,/authEpoch===epoch&&ownerOnly\(\)/);
});

test('V105: paginación de pendientes por fecha y nombres autorizados por perfiles',async()=>{
  const {db,calls}=pendingDb();
  const result=await fetchOwnerDeletionPage(db,1,'pending');
  assert.equal(result.error,false);
  assert.equal(result.count,1);
  assert.equal(result.data[0].user_id,customerId);
  assert.equal(result.names.get(customerId).name,'Cliente de pruebas');
  assert.ok(calls.some(x=>x[0]==='in'&&x[1]==='status'&&x[2].includes('in_review')));
  assert.ok(calls.some(x=>x[0]==='range'&&x[1]===30&&x[2]===59));
  assert.ok(calls.some(x=>x[0]==='profiles-select'&&!x[1].includes('email')));
  assert.equal(ownerDeletionPageSize,30);
  assert.equal(ownerDeletionPageCount(31),2);
  assert.equal(ownerDeletionPageCount(null),0);
});

test('V105: solo revisa una solicitud recibida, comprobando fila y sesión',async()=>{
  const {db,calls}=pendingDb();
  assert.equal(await beginOwnerDeletionReview({
    supabase:db,requestId,isActive:()=>true
  }),true);
  assert.deepEqual(calls.find(x=>x[0]==='update'),['update',{status:'in_review'}]);
  assert.ok(calls.some(x=>x[0]==='update-eq'&&x[1]==='id'&&x[2]===requestId));
  assert.ok(calls.some(x=>x[0]==='update-eq'&&x[1]==='status'&&x[2]==='requested'));
  const missing=pendingDb({updateData:[]});
  await assert.rejects(()=>beginOwnerDeletionReview({
    supabase:missing.db,requestId,isActive:()=>true
  }),/ya cambió/);
  await assert.rejects(()=>beginOwnerDeletionReview({
    supabase:db,requestId,isActive:()=>false
  }),/Sesión/);
  await assert.rejects(()=>beginOwnerDeletionReview({
    supabase:db,requestId:'invalid',isActive:()=>true
  }),/Sesión/);
});

test('V105: recuento servidor y validación de filtros sin consultar cuentas externas',async()=>{
  const calls=[];
  const counter={
    from(table){
      assert.equal(table,'account_deletion_requests');
      return {
        select(fields,opts){
          calls.push(['select',fields,opts]);
          return {async eq(field,status){
            calls.push(['eq',field,status]);
            return {count:5,error:null};
          }};
        }
      };
    }
  };
  assert.deepEqual(await fetchOwnerDeletionCount(counter),{count:5,error:false});
  assert.deepEqual(calls[0],['select','id',{head:true,count:'exact'}]);
  assert.deepEqual(calls[1],['eq','status','requested']);
  assert.equal((await fetchOwnerDeletionPage(counter,-1)).error,true);
  assert.equal((await fetchOwnerDeletionPage(counter,0,'invalid')).error,true);
  assert.equal((await fetchOwnerDeletionPage(null,0)).error,true);
  const history=pendingDb({status:'completed'});
  assert.equal((await fetchOwnerDeletionPage(history.db,0,'completed')).data[0].status,'completed');
});

test('V105: la base impide que el cliente gestione solicitudes ajenas o simule un borrado',()=>{
  const sql=readFileSync(new URL('../supabase/migration-v105-owner-deletion-inbox.sql',import.meta.url),'utf8');
  const testSql=readFileSync(new URL('./owner-deletions-v105.sql',import.meta.url),'utf8');
  const panel=readFileSync(new URL('../owner-deletions.js',import.meta.url),'utf8');
  assert.match(sql,/enable row level security/);
  assert.match(sql,/grant select\(user_id\)/);
  assert.match(sql,/create policy "deletion request admin read v105"/);
  assert.match(sql,/create policy "deletion request admin review v105"/);
  assert.match(sql,/grant update\(status\)/);
  assert.match(sql,/status='requested'/);
  assert.match(sql,/status='in_review'/);
  assert.match(sql,/completed_at is null/);
  assert.doesNotMatch(sql,/grant update\(completed_at\)/);
  assert.match(testSql,/^begin;/im);
  assert.match(testSql,/\brollback;\s*$/i);
  assert.match(testSql,/V105_OTHER_CUSTOMER_SEES_PRIVATE_REQUEST/);
  assert.match(testSql,/V105_UNVERIFIED_COMPLETION_ALLOWED/);
  assert.match(testSql,/V105_COMPLETED_AT_TAMPER_ALLOWED/);
  assert.match(panel,/esta pantalla no puede marcar solicitudes como completadas/);
  assert.doesNotMatch(panel,/\.delete\(/);
  assert.doesNotMatch(panel,/auth\.admin\.deleteUser/);
  assert.doesNotMatch(panel,/service_role/);
});
