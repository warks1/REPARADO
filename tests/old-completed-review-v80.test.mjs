import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchReviewableRequests,recentReviewableLimit} from '../reviewable-requests.js';

const OWNER='a0000000-0000-4000-8000-000000000080';
const OLD='b0000000-0000-4000-8000-000000000080';
const OTHER='b0000000-0000-4000-8000-000000000081';
const recent=Array.from({length:50},(_,i)=>({
  id:'c0000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
  service_name:'Trabajo terminado '+(i+1)
}));

function mock({latest=recent,target={id:OLD,service_name:'Reparación antigua'},
  listError=null,targetError=null}={}){
  const calls=[];
  const client={from(table){
    assert.equal(table,'service_requests');
    const filters=[];
    return {
      select(columns){
        calls.push(['select',columns]);
        assert.equal(columns,'id,service_name');
        return {
          eq(column,value){filters.push([column,value]);calls.push(['eq',column,value]);return this;},
          order(column,options){calls.push(['order',column,options]);return this;},
          async limit(size){
            calls.push(['limit',size]);
            return {data:latest,error:listError};
          },
          async maybeSingle(){
            calls.push(['maybeSingle']);
            const good=filters.some(([field,val])=>field==='customer_id'&&val===OWNER)&&
              filters.some(([field,val])=>field==='status'&&val==='completed')&&
              filters.some(([field,val])=>field==='id'&&val===OLD);
            return {data:good?target:null,error:targetError};
          }
        };
      }
    };
  }};
  return {client,calls};
}

test('V80: conserva los últimos 50 y recupera una reparación antigua concreta',async()=>{
  const {client,calls}=mock();
  const rows=await fetchReviewableRequests(client,OWNER,OLD);
  assert.equal(recentReviewableLimit,50);
  assert.equal(rows.length,51);
  assert.deepEqual(rows[0],{id:OLD,service_name:'Reparación antigua'});
  assert.equal(rows[1].id,recent[0].id);
  assert.deepEqual(calls,[
    ['select','id,service_name'],
    ['eq','customer_id',OWNER],
    ['eq','status','completed'],
    ['order','created_at',{ascending:false}],
    ['limit',50],
    ['select','id,service_name'],
    ['eq','customer_id',OWNER],
    ['eq','status','completed'],
    ['eq','id',OLD],
    ['maybeSingle']
  ]);
});

test('V80: no vuelve a consultar una reparación reciente ya visible',async()=>{
  const {client,calls}=mock();
  const rows=await fetchReviewableRequests(client,OWNER,recent[6].id);
  assert.equal(rows.length,50);
  assert.ok(!calls.some(c=>c[0]==='maybeSingle'));
});

test('V80: impide preseleccionar un trabajo ajeno, inacabado o distinto al pedido',async()=>{
  for(const target of [null,{id:OTHER,service_name:'Trabajo ajeno'}]){
    const {client}=mock({target});
    const rows=await fetchReviewableRequests(client,OWNER,OLD);
    assert.equal(rows.length,50);
    assert.ok(rows.every(row=>row.id!==OLD));
  }
  const {client,calls}=mock();
  const rows=await fetchReviewableRequests(client,OWNER,'../../../otra-cuenta');
  assert.equal(rows.length,50);
  assert.ok(!calls.some(c=>c[0]==='maybeSingle'));
});

test('V80: ante fallos de Supabase no se declara un servicio verificado',async()=>{
  const list=mock({listError:{code:'network'}});
  await assert.rejects(fetchReviewableRequests(list.client,OWNER,OLD),/comprobar/);
  const lookup=mock({targetError:{code:'network'}});
  await assert.rejects(fetchReviewableRequests(lookup.client,OWNER,OLD),/comprobar/);
  await assert.rejects(fetchReviewableRequests(mock().client,'usuario-no-valido',OLD),/cuenta/);
});

test('V80: el formulario ofrece valorar reparaciones históricas desde el historial privado',()=>{
  const src=readFileSync(new URL('../reviews.js',import.meta.url),'utf8');
  const control=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.ok(src.includes('fetchReviewableRequests(supabase,session.user.id,selectedRequestId)'));
  assert.ok(src.includes('data.find(row=>row.id===selectedRequestId)'));
  assert.ok(src.includes('form.elements.request_id.value=requested.id'));
  assert.ok(src.includes('Para valorar otro anterior, entra en Mis solicitudes'));
  assert.ok(control.includes('renderHome(requestId)'));
  assert.ok(control.includes('data-rate-request='));
});
