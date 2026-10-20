import test from 'node:test';
import assert from 'node:assert/strict';
import {requestStorageKey,profileStorageKey,messageDraftStorageKey,safeReadJSON,localRequests,localProfile,localWrite,localAgenda,localSummary,localDateLabel,validLocalDate} from '../local-data.js';
const storage=()=>{
 const store=new Map();
 return {getItem:key=>store.get(key)??null,setItem:(key,value)=>{store.set(key,value)}};
};
test('local: recuperación tras JSON corrupto o valores incompatibles',()=>{
 const s=storage();
 s.setItem(requestStorageKey,'invalid json');
 s.setItem(profileStorageKey,'null');
 assert.deepEqual(localRequests(s),[]);
 assert.deepEqual(localProfile(s),{});
 s.setItem(requestStorageKey,JSON.stringify([null,{},4,'x',{id:'ok',date:'2026-11-01'}]));
 assert.deepEqual(localRequests(s),[{}, {id:'ok',date:'2026-11-01'}]);
 s.setItem(profileStorageKey,JSON.stringify(['invalid']));
 assert.deepEqual(localProfile(s),{});
});
test('local: las fechas se validan y se ordenan sin desfases horarios',()=>{
 assert.equal(validLocalDate('2026-02-29'),false);
 assert.equal(validLocalDate('2028-02-29'),true);
 assert.equal(validLocalDate('2026-11-07'),true);
 assert.equal(validLocalDate('2026-13-01'),false);
 const items=[
  {id:'a',date:'2026-11-18',period:'Tarde'},
  {id:'b',date:''},
  {id:'c',date:'2026-11-07',period:'Mañana'}
 ];
 assert.deepEqual(localAgenda(items).map(x=>x.id),['c','a']);
 assert.deepEqual(localSummary(items),{total:3,withDate:2,withoutDate:1});
 assert.equal(localDateLabel('2026-11-07'),'07/11/2026');
 assert.equal(localDateLabel(''), 'Sin fecha preferida');
});
test('local: datos guardados y borradores de chat sin falsas confirmaciones',()=>{
 const s=storage();
 assert.equal(localWrite(s,requestStorageKey,[{id:'abc',status:'Pendiente (local)'}]),true);
 assert.equal(localRequests(s).length,1);
 assert.equal(localWrite(s,messageDraftStorageKey,'Consultar fuga'),true);
 assert.equal(safeReadJSON(s,messageDraftStorageKey,''),'Consultar fuga');
 assert.equal(localWrite({setItem(){throw Error('Cuota excedida')}},profileStorageKey,{name:'Prueba'}),false);
});
