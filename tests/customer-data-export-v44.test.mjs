import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPersonalDataExport,personalDataFilename,PersonalDataExportError} from '../customer-data-export.js';

const USER='00000000-0000-4000-8000-000000000001';
const OTHER='00000000-0000-4000-8000-000000000002';
const when=new Date('2026-10-27T08:30:00.000Z');
const app=readFileSync(new URL('../connected.js',import.meta.url),'utf8');

function fake({role='customer',foreign=false,records=203,authSwitch=false,failOn=null,onRead=null}={}){
 const queries=[];
 let authChecks=0;
 const datasets={
  profiles:[{id:USER,full_name:'Cliente A',phone:'600000000',role,created_at:'2026-01-01'}],
  service_requests:Array.from({length:records},(_,i)=>({
    id:String(i+1).padStart(5,'0'),customer_id:USER,service_name:'Grifo '+i,street:'Calle de prueba',
    created_at:'2026-10-27'})),
  messages:[{id:'m1',customer_id:USER,sender_id:USER,body:'Mi mensaje privado'}],
  notifications:[{id:'n1',user_id:USER,title:'Presupuesto recibido'}],
  invoices:[{id:'f1',customer_id:USER,status:'issued',total:121},{id:'f2',customer_id:USER,status:'draft',total:50}],
  support_reports:[{id:'s1',subject:'Mi incidencia',description:'No funciona una pantalla'}],
  account_deletion_requests:[{id:'d1',status:'requested',requested_at:'2026-10-27'}]
 };
 if(foreign)datasets.service_requests[0].customer_id=OTHER;
 const from=table=>{
  const q={table,filters:[],not:[]};queries.push(q);
  const builder={
   select(fields){q.fields=fields;return builder},
   eq(field,value){q.filters.push([field,value]);return builder},
   neq(field,value){q.not.push([field,value]);return builder},
   order(field,opts){q.order=[field,opts];return builder},
   range:async(start,end)=>{
    q.range=[start,end];
    onRead?.(q);
    if(table===failOn)return {data:null,error:new Error('Confidencial')};
    let data=datasets[table]||[];
    for(const [key,val] of q.filters)if(!(foreign&&table==='service_requests'))data=data.filter(row=>row[key]===val);
    for(const [key,val] of q.not)data=data.filter(row=>row[key]!==val);
    return {data:data.slice(start,end+1),error:null};
   },
   maybeSingle:async()=>{
    onRead?.(q);
    if(table===failOn)return {data:null,error:new Error('Sin conexión')};
    const row=(datasets[table]||[])[0];
    return {data:row||null,error:null};
   }
  };
  return builder;
 };
 return {
  queries,
  supabase:{
   auth:{getUser:async()=>{
     authChecks++;
     return {data:{user:{id:authSwitch&&authChecks===2?OTHER:USER}},error:null}
   }},
   from
  }
 };
}
const own=()=>true;

test('V44: descarga completa por páginas de 200, con acceso solo a registros propios',async()=>{
 const x=fake();
 const data=await buildPersonalDataExport({supabase:x.supabase,userId:USER,isCurrentUser:own,generatedAt:when});
 assert.equal(data.usuario_id,USER);
 assert.equal(data.generado_el,when.toISOString());
 assert.equal(data.datos.perfil.id,USER);
 assert.equal(data.datos.solicitudes.length,203);
 assert.equal(data.datos.mensajes.length,1);
 assert.equal(data.datos.avisos.length,1);
 assert.equal(data.datos.facturas_visibles.length,1);
 assert.equal(data.datos.incidencias_soporte.length,1);
 assert.equal(data.datos.solicitud_eliminacion.status,'requested');
 assert.deepEqual(x.queries.filter(q=>q.table==='service_requests').map(q=>q.range),[[0,199],[200,399]]);
 for(const q of x.queries.filter(q=>['service_requests','messages','notifications','invoices'].includes(q.table)))
   assert.ok(q.filters.some(f=>f[1]===USER));
 assert.ok(x.queries.find(q=>q.table==='support_reports').fields.includes('description'));
 assert.equal(x.queries.find(q=>q.table==='support_reports').fields.includes('user_id'),false);
 assert.equal(x.queries.find(q=>q.table==='account_deletion_requests').fields.includes('user_id'),false);
 assert.equal(personalDataFilename(when),'REPARADO-mis-datos-2026-10-27.json');
 assert.doesNotMatch(JSON.stringify(data),/sb_secret_|access_token|refresh_token|device_token/i);
 assert.match(data.no_incluye,/Fotografías/);
});

test('V44: si la consulta falla, no se entrega un archivo incompleto',async()=>{
 const x=fake({failOn:'messages'});
 await assert.rejects(
   buildPersonalDataExport({supabase:x.supabase,userId:USER,isCurrentUser:own}),
   e=>e instanceof PersonalDataExportError&&e.code==='network');
 assert.equal(x.queries.some(q=>q.table==='invoices'),false);
});

test('V44: cambio de cuenta o cierre de sesión invalida la descarga',async()=>{
 const switched=fake({authSwitch:true});
 await assert.rejects(
   buildPersonalDataExport({supabase:switched.supabase,userId:USER,isCurrentUser:own}),
   e=>e.code==='session');
 let active=true;
 const expired=fake({onRead:q=>{if(q.table==='messages')active=false}});
 await assert.rejects(
   buildPersonalDataExport({supabase:expired.supabase,userId:USER,isCurrentUser:()=>active}),
   e=>e.code==='session');
 await assert.rejects(
   buildPersonalDataExport({supabase:expired.supabase,userId:OTHER,isCurrentUser:own}),
   e=>e.code==='session');
});

test('V44: el administrador no puede exportar accidentalmente incidencias de otros clientes',async()=>{
 const x=fake({role:'admin'});
 await assert.rejects(
   buildPersonalDataExport({supabase:x.supabase,userId:USER,isCurrentUser:own}),
   e=>e.code==='session');
 assert.equal(x.queries.some(q=>q.table==='support_reports'),false);
});

test('V44: cada fila identificable debe pertenecer al propietario autenticado',async()=>{
 const x=fake({foreign:true});
 // El cliente también valida el propietario si una respuesta no respeta RLS.
 await assert.rejects(
   buildPersonalDataExport({supabase:x.supabase,userId:USER,isCurrentUser:own}),
   e=>e.code==='network');
});

test('V44: la interfaz solo la muestra a clientes y valida la sesión después de leer datos',()=>{
 assert.match(app,/profile\?\.role==='customer'\?`<section class="reparado-help" id="customer-data-export"/);
 assert.match(app,/id="download-my-data"/);
 assert.match(app,/buildPersonalDataExport\(/);
 assert.match(app,/authEpoch===originalEpoch/);
 assert.match(app,/downloadPersonalDataExport\(snapshot\)/);
 assert.match(app,/revis(a|e) la carpeta de descargas|Revisa la carpeta de descargas/i);
});
