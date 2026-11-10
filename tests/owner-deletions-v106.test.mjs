import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchOwnerDeletionCount} from '../owner-deletions.js';
import {ownerDashboardMarkup} from '../owner-dashboard.js';

test('V106: tanto recibidas como en revisión cuentan como pendientes',async()=>{
 const calls=[];
 const db={from(table){
   assert.equal(table,'account_deletion_requests');
   return {select(fields,opts){
     assert.equal(fields,'id');
     assert.deepEqual(opts,{head:true,count:'exact'});
     return {async in(field,values){
       calls.push([field,values]);
       const rows=[
         {status:'requested'},{status:'in_review'},{status:'in_review'},
         {status:'completed'}
       ];
       return {count:rows.filter(r=>values.includes(r.status)).length,error:null};
     }};
   }};
 }};
 assert.deepEqual(await fetchOwnerDeletionCount(db),{count:3,error:false});
 assert.deepEqual(calls,[['status',['requested','in_review']]]);
 const html=ownerDashboardMarkup(null,null,null,3);
 assert.match(html,/3 pendiente\(s\)/);
 assert.match(html,/3 solicitudes de supresión pendientes/);
 assert.doesNotMatch(html,/3 recibida\(s\)/);
});

test('V106: 0 pendientes no se anuncia como deuda ni se inventan cifras',async()=>{
 const db={from(){return {select(){
   return {async in(){return {count:0,error:null}}};
 }}}};
 assert.deepEqual(await fetchOwnerDeletionCount(db),{count:0,error:false});
 const html=ownerDashboardMarkup(null,null,null,0);
 assert.doesNotMatch(html,/0 pendiente\(s\)/);
 assert.equal((await fetchOwnerDeletionCount(null)).error,true);
});

test('V106: no se considera finalizada una solicitud en revisión',()=>{
 const source=readFileSync(new URL('../owner-deletions.js',import.meta.url),'utf8');
 assert.match(source,/\.in\('status',\['requested','in_review'\]\)/);
 assert.match(source,/status:'in_review'/);
 assert.doesNotMatch(source,/\.update\(\{status:'completed'\}\)/);
 const e2e=readFileSync(new URL('../e2e-private/owner-deletions-v105.spec.mjs',import.meta.url),'utf8');
 assert.match(e2e,/status!=='completed'\?1:0/);
 assert.match(e2e,/1 pendiente\(s\)/);
});
