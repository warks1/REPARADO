import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchOwnerCalendarMore} from '../owner-calendar.js';

// Supabase ficticio. No se consultan datos de clientes ni servicios reales.
function fakeDb({rows=[],count=rows.length,error=null}={}){
  const calls=[];
  const db={from(table){
    calls.push(['from',table]);
    return {
      select(fields,options){calls.push(['select',fields,options]);return this},
      in(field,values){calls.push(['in',field,values]);return this},
      eq(field,value){calls.push(['eq',field,value]);return this},
      gte(field,value){calls.push(['gte',field,value]);return this},
      lt(field,value){calls.push(['lt',field,value]);return this},
      order(field,options){calls.push(['order',field,options]);return this},
      async range(start,end){
        calls.push(['range',start,end]);
        return {data:rows,count,error};
      }
    };
  }};
  return {db,calls};
}

test('V87: visitas posteriores a 200 se leen por rangos con horario Cataluña y orden estable',async()=>{
  const rows=[{id:'1'},{id:'2'}];
  const {db,calls}=fakeDb({rows,count:202});
  const result=await fetchOwnerCalendarMore(db,'2026-11-09','scheduled',200);
  assert.equal(result.error,false);
  assert.deepEqual(result.data,rows);
  assert.equal(result.hasMore,false);
  assert.ok(calls.some(x=>x[0]==='range'&&x[1]===200&&x[2]===399));
  assert.ok(calls.some(x=>x[0]==='in'&&x[1]==='status'&&
    x[2].includes('scheduled')&&x[2].includes('in_progress')));
  assert.ok(calls.some(x=>x[0]==='gte'&&x[2]==='2026-11-08T23:00:00.000Z'));
  assert.ok(calls.some(x=>x[0]==='lt'&&x[2]==='2026-11-15T23:00:00.000Z'));
  assert.deepEqual(calls.filter(x=>x[0]==='order').map(x=>x[1]),['scheduled_at','id']);
  assert.ok(calls.some(x=>x[0]==='select'&&x[2]?.count==='exact'));
  assert.ok(calls.every(x=>JSON.stringify(x).indexOf('auth.users')===-1));
});

test('V87: aceptados se paginan de 50 en 50 sin mostrar servicios no aceptados',async()=>{
  const first=Array.from({length:50},(_,i)=>({id:String(i)}));
  const db1=fakeDb({rows:first,count:125});
  const a=await fetchOwnerCalendarMore(db1.db,'2026-11-09','accepted',50);
  assert.equal(a.error,false);
  assert.equal(a.hasMore,true);
  assert.ok(db1.calls.some(x=>x[0]==='range'&&x[1]===50&&x[2]===99));
  assert.ok(db1.calls.some(x=>x[0]==='eq'&&x[1]==='status'&&x[2]==='accepted'));
  assert.deepEqual(db1.calls.filter(x=>x[0]==='order').map(x=>x[1]),['created_at','id']);
  const db2=fakeDb({rows:Array.from({length:25},(_,i)=>({id:String(i+100)})),count:125});
  const b=await fetchOwnerCalendarMore(db2.db,'2026-11-09','accepted',100);
  assert.equal(b.hasMore,false);
  assert.equal(b.data.length,25);
});

test('V87: errores, categorías incorrectas e índices inválidos no inventan resultados',async()=>{
  const {db,calls}=fakeDb();
  for(const kind of ['', 'all', 'new']){
    assert.equal((await fetchOwnerCalendarMore(db,'2026-11-09',kind,0)).error,true);
  }
  for(const offset of [-1,0.5,1000001,NaN]){
    assert.equal((await fetchOwnerCalendarMore(db,'2026-11-09','accepted',offset)).error,true);
  }
  assert.equal((await fetchOwnerCalendarMore(db,'2026-02-31','accepted',50)).error,true);
  assert.equal((await fetchOwnerCalendarMore(null,'2026-11-09','scheduled',200)).error,true);
  assert.deepEqual(calls,[]);
  const broken=fakeDb({rows:[],count:100,error:{message:'Sin red'}});
  assert.equal((await fetchOwnerCalendarMore(broken.db,'2026-11-09','accepted',50)).error,true);
});

test('V87: si PostgREST omite el recuento, detecta bloques completos',async()=>{
  const rows=Array.from({length:50},(_,i)=>({id:String(i)}));
  const {db}=fakeDb({rows,count:null});
  assert.equal((await fetchOwnerCalendarMore(db,'2026-11-09','accepted',50)).hasMore,true);
  const empty=fakeDb({rows:[],count:null});
  assert.equal((await fetchOwnerCalendarMore(empty.db,'2026-11-09','accepted',50)).hasMore,false);
});

test('V87: calendario muestra carga incremental sin tocar el editor ni la seguridad',()=>{
  const source=readFileSync(new URL('../owner-calendar.js',import.meta.url),'utf8');
  assert.ok(source.includes('data-owner-more="scheduled"'));
  assert.ok(source.includes('data-owner-more="accepted"'));
  assert.ok(source.includes('request!==sequence||week!==monday'));
  assert.ok(source.includes('if(!active()||!activeData||loadingMore||saving)return'));
  assert.ok(source.includes("if(!activeData[partialKey])return"));
  assert.ok(source.includes("await saveOwnerVisit(supabase"));
});
