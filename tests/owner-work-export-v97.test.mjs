import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildOwnerWorkCsv,ownerWorkCsv,ownerCsvCell,ownerWorkFilename,
  shareOwnerWorkCsv,OwnerExportError,ownerExportPageSize,ownerExportMaxRows}
  from '../owner-work-export.js';

const admin='a0000000-0000-4000-8000-000000000001';
const operator='b0000000-0000-4000-8000-000000000002';
const now=new Date('2026-11-09T18:00:00Z');
const uuid=n=>'c0000000-0000-4000-8000-'+String(n+1).padStart(12,'0');
const job=n=>({
 id:uuid(n),service_name:n===0?'Reparación de fugas':'Instalación de grifo',
 category:'Fontanería',status:n%2?'accepted':'completed',city:'Barcelona',
 price:121.23,operator_name:'Operario de prueba',
 created_at:'2026-10-29T09:00:00.000Z',scheduled_at:null
});
function mock({count=451,role='admin',authId=admin,fail=false,
  countDrift=false,duplicate=false,afterPage=null}={}){
 const calls=[];
 const db={
  auth:{async getUser(){calls.push(['auth']);return {data:{user:{id:authId}},error:null}}},
  from(table){
   calls.push(['from',table]);
   if(table==='profiles')return {
     select(cols){calls.push(['profileSelect',cols]);return this},
     eq(...args){calls.push(['profileEq',...args]);return this},
     async maybeSingle(){return {data:{id:authId,role},error:null}}
   };
   assert.equal(table,'service_requests');
   const q={
    select(cols,opts){calls.push(['select',cols,opts]);return this},
    eq(field,val){calls.push(['eq',field,val]);return this},
    order(field,opts){calls.push(['order',field,opts]);return this},
    async range(start,end){
      calls.push(['range',start,end]);
      if(fail)return {data:null,count:null,error:{code:'08006'}};
      const n=Math.max(0,Math.min(end+1,count)-start);
      const rows=Array.from({length:n},(_,i)=>job(duplicate&&start>0?i:start+i));
      afterPage?.(start);
      return {data:rows,count:countDrift&&start>=200?count+1:count,error:null};
    }
   };
   return q;
  }
 };
 return {db,calls};
}

test('V97: 451 trabajos en tres páginas con doble comprobación de sesión admin',async()=>{
 const {db,calls}=mock();
 const info=await buildOwnerWorkCsv({supabase:db,ownerId:admin,isActive:()=>true,now});
 assert.equal(info.count,451);
 assert.equal(info.type,'REPARADO_WORK_REPORT_CSV_V97');
 assert.equal(info.filename,'REPARADO-trabajos-all-2026-11-09.csv');
 assert.ok(info.contents.startsWith('\uFEFF'));
 assert.equal(info.contents.split('\r\n').length,453);
 assert.equal(calls.filter(c=>c[0]==='auth').length,2);
 assert.deepEqual(calls.filter(c=>c[0]==='range'),[
  ['range',0,199],['range',200,399],['range',400,599]
 ]);
 assert.ok(calls.some(c=>c[0]==='select'&&c[2].count==='exact'));
 assert.ok(calls.filter(c=>c[0]==='select')
   .every(c=>!c[1].includes('phone')&&!c[1].includes('street')&&!c[1].includes('customer_id')));
});

test('V97: el filtro de estado se aplica en el servidor antes de paginar',async()=>{
 const {db,calls}=mock({count:1});
 const result=await buildOwnerWorkCsv({supabase:db,ownerId:admin,
  isActive:()=>true,status:'completed',now});
 assert.equal(result.count,1);
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='status'&&c[2]==='completed'));
 assert.ok(calls.findIndex(c=>c[0]==='eq'&&c[1]==='status')<
   calls.findIndex(c=>c[0]==='range'));
});

test('V97: aborta ante roles inválidos, exceso de datos, duplicados y cortes de red',async()=>{
 for(const args of [
  {role:'operator'},{authId:operator},{count:ownerExportMaxRows+1},
  {count:401,countDrift:true},{count:250,duplicate:true},{count:9,fail:true}
 ]){
  await assert.rejects(()=>buildOwnerWorkCsv({
   supabase:mock(args).db,ownerId:admin,isActive:()=>true,now
  }),OwnerExportError);
 }
 let current=true;
 const {db}=mock({count:300,afterPage:()=>{current=false}});
 await assert.rejects(()=>buildOwnerWorkCsv({
   supabase:db,ownerId:admin,isActive:()=>current,now
 }),e=>e instanceof OwnerExportError&&e.code==='session');
 await assert.rejects(()=>buildOwnerWorkCsv({
   supabase:mock().db,ownerId:admin,isActive:()=>false,now
 }),OwnerExportError);
 await assert.rejects(()=>buildOwnerWorkCsv({
   supabase:mock().db,ownerId:admin,isActive:()=>true,status:'hidden',now
 }),OwnerExportError);
 assert.equal(ownerExportPageSize,200);
});

test('V97: CSV español impide ejecutar fórmulas y evita PII de los clientes',()=>{
 const row={...job(0),service_name:'=HYPERLINK("https://malicious.invalid")',
   city:'  +1+2  ',operator_name:'@SUM(1,1)',category:'-1+1'};
 const csv=ownerWorkCsv([row]);
 assert.ok(csv.startsWith('\uFEFF'));
 assert.ok(csv.includes('"\'=HYPERLINK(""https://malicious.invalid"")"'));
 assert.ok(csv.includes('"\'\\u002b1+2"'.replace('\\u002b','+')));
 assert.ok(csv.includes('"\'@SUM(1,1)"'));
 assert.ok(csv.includes('"\'-1+1"'));
 assert.ok(csv.includes('"121,23"'));
 assert.ok(!csv.includes('600000000'));
 assert.equal(ownerCsvCell('Hola;\r\nMundo'),'"Hola; Mundo"');
 assert.equal(ownerWorkFilename(now,'completed'),'REPARADO-trabajos-completed-2026-11-09.csv');
 assert.throws(()=>ownerWorkFilename(now,'../../hack'),OwnerExportError);
});

test('V97: guardar en navegador requiere copia válida y sesión del propietario',async()=>{
 const snapshot=await buildOwnerWorkCsv({
  supabase:mock({count:1}).db,ownerId:admin,isActive:()=>true,now
 });
 let saved=false;
 assert.deepEqual(await shareOwnerWorkCsv(snapshot,{
  ownerId:admin,isActive:()=>true,isNative:()=>false,
  webDownload:()=>{saved=true}
 }),{mode:'browser'});
 assert.equal(saved,true);
 await assert.rejects(()=>shareOwnerWorkCsv(snapshot,{
  ownerId:operator,isActive:()=>true,isNative:()=>false
 }),OwnerExportError);
});

test('V97: en iPhone y Android el fichero queda en caché y se borra tras compartir',async()=>{
 const snapshot=await buildOwnerWorkCsv({
  supabase:mock({count:1}).db,ownerId:admin,isActive:()=>true,now
 });
 const events=[];
 const Filesystem={
  writeFile:async data=>{events.push(['write',data]);return {}},
  getUri:async()=>({uri:'file:///private/cache/report.csv'}),
  deleteFile:async data=>{events.push(['delete',data]);return {}}
 };
 const api={Filesystem,Directory:{Cache:'CACHE'},Encoding:{UTF8:'utf8'},
   Share:{canShare:async()=>({value:true}),
     share:async data=>{events.push(['share',data]);return {}}}};
 const cleanup=[];
 const result=await shareOwnerWorkCsv(snapshot,{
  ownerId:admin,isActive:()=>true,isNative:()=>true,
  randomId:()=>operator,getNativeApis:async()=>api,
  scheduleCleanup:(fn,ms)=>cleanup.push([fn,ms])
 });
 assert.deepEqual(result,{mode:'native'});
 assert.equal(events[0][0],'write');
 assert.equal(events[0][1].directory,'CACHE');
 assert.ok(events[0][1].data.startsWith('\uFEFF'));
 assert.deepEqual(events[1][1].files,['file:///private/cache/report.csv']);
 assert.equal(cleanup[0][1],90000);
 await cleanup[0][0]();
 assert.equal(events.at(-1)[0],'delete');
});

test('V97: solo propietario accede a la exportación, nunca se emite una factura',()=>{
 const owner=readFileSync(new URL('../owner-dashboard.js',import.meta.url),'utf8');
 const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 const view=readFileSync(new URL('../owner-export-view.js',import.meta.url),'utf8');
 assert.ok(owner.includes("view:'owner-export'"));
 assert.ok(connected.includes("if(view==='owner-export')return showOwnerWorkExport();"));
 assert.ok(connected.includes("else if(view==='owner-export')showOwnerWorkExport();"));
 assert.ok(connected.includes("currentView==='owner-export'&&isCurrentUser(ownerId)"));
 assert.ok(view.includes('data-owner-export-form'));
 assert.ok(view.includes('data-owner-export-download disabled'));
 assert.ok(view.includes('onProgress:'));
 assert.ok(view.includes('if(!active()||working||!prepared)return;'));
 assert.ok(view.includes('No se ha emitido ninguna factura'));
});
