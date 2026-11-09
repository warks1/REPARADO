import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchOwnerMetrics,ownerMetrics,ownerSections,ownerDashboardMarkup} from '../owner-dashboard.js';
import {ownerWeekStart,ownerWeekDays,moveOwnerWeek,ownerTodayMadrid,
 fetchOwnerCalendar,saveOwnerVisit} from '../owner-calendar.js';
import {fetchOwnerMessagesPage,ownerMessagesPageSize,ownerMessagePageCount,
 ownerMailMarkup} from '../owner-messages.js';
import {fetchOwnerPeoplePage,ownerPeoplePageCount,ownerPeoplePageSize} from '../owner-people.js';

const owner='a0000000-0000-4000-8000-000000000001';
const operator='b0000000-0000-4000-8000-000000000002';
const request='c0000000-0000-4000-8000-000000000003';
const assigned={id:operator,full_name:'Operario Prueba',role:'operator'};
const accepted={id:request,service_name:'Cambio grifo',status:'accepted',
 operator_id:null,scheduled_at:null,price:180};

test('V84: centro propietario ofrece todas las áreas sin confundir correos externos',()=>{
 const html=ownerDashboardMarkup(Object.fromEntries(ownerMetrics.map((m,i)=>[m.id,i])));
 for(const name of ['Panel del propietario','Solicitudes nuevas','Presupuestos',
  'Calendario y operarios','Mensajes de clientes','Trabajos sin asignar',
  'Facturación y trabajos terminados','Incidencias','Reseñas','Correo externo',
  'Directorio de clientes','Equipo de operarios']){
   assert.ok(html.includes(name),name);
 }
 assert.equal(ownerSections.length,12);
 assert.ok(html.includes('Acceso exclusivo del rol administrador'));
 assert.ok(!html.includes('admin@reparado.com'));
 assert.ok(ownerMailMarkup().includes('outlook.live.com/mail/'));
 assert.ok(ownerMailMarkup().includes('no están conectados a la app'));
});

test('V84: 10 indicadores se consultan por separado mediante contadores exactos',async()=>{
 const calls=[];
 const db={from(table){return {select(columns,options){
    calls.push({table,columns,options});
    return {eq:async(field,status)=>{
      calls.at(-1).field=field;calls.at(-1).status=status;
      return {count:calls.length,error:null};
    }};
 }}}};
 const result=await fetchOwnerMetrics(db);
 assert.equal(result.error,false);
 assert.equal(calls.length,10);
 assert.ok(calls.every(c=>c.columns==='id'&&c.options.count==='exact'&&c.options.head===true));
 assert.ok(calls.slice(0,8).every(c=>c.field==='status'));
 assert.ok(calls.slice(8).every(c=>c.field==='role'));
 assert.equal(result.counts.new,1);
 assert.equal(result.counts.reviews,8);
 assert.equal(result.counts.customers,9);
 assert.equal(result.counts.operators,10);
});

test('V84: un recuento fallido no inventa cifras del negocio',async()=>{
 const db={from(){return {select(){return {eq:async()=>({count:null,error:{message:'red'}})}}}}};
 assert.deepEqual(await fetchOwnerMetrics(db),{counts:null,error:true});
 assert.deepEqual(await fetchOwnerMetrics(null),{counts:null,error:true});
 assert.match(ownerDashboardMarkup(),/Consultando el estado/);
});

test('V84: calendario de Cataluña siempre empieza lunes, navega semanas y respeta DST',()=>{
 assert.equal(ownerWeekStart('2026-11-09'),'2026-11-09');
 assert.equal(ownerWeekStart('2026-11-15'),'2026-11-09');
 assert.equal(moveOwnerWeek('2026-11-09',1),'2026-11-16');
 assert.equal(moveOwnerWeek('2026-11-09',-1),'2026-11-02');
 assert.deepEqual(ownerWeekDays('2026-11-09'),
 ['2026-11-09','2026-11-10','2026-11-11','2026-11-12',
  '2026-11-13','2026-11-14','2026-11-15']);
 assert.equal(ownerTodayMadrid(new Date('2026-11-09T00:05:00Z')),'2026-11-09');
 assert.throws(()=>ownerWeekStart('2026-02-31'));
});

test('V84: agenda consulta visitas de semana, aprobados sin hora y operarios',async()=>{
 const calls=[];
 const db={from(table){return {
    select(fields){calls.push([table,'select',fields]);return this;},
    in(field,values){calls.push([table,'in',field,values]);return this;},
    eq(field,value){calls.push([table,'eq',field,value]);return this;},
    gte(field,value){calls.push([table,'gte',field,value]);return this;},
    lt(field,value){calls.push([table,'lt',field,value]);return this;},
    order(field,opts){calls.push([table,'order',field,opts]);return this;},
    async limit(){
      if(table==='profiles')throw Error('Unexpected limit');
      return {data:table==='service_requests'?[accepted]:[],error:null};
    },
    then(resolve){
      if(table!=='profiles')throw Error('Unexpected then');
      return Promise.resolve({data:[assigned],error:null}).then(resolve);
    }
 }}};
 const result=await fetchOwnerCalendar(db,'2026-11-09');
 assert.equal(result.error,false);
 assert.equal(result.start,'2026-11-09');
 assert.equal(result.operators.length,1);
 assert.ok(calls.some(c=>c[0]==='service_requests'&&c[1]==='in'&&
   c[2]==='status'&&c[3].includes('scheduled')));
 assert.ok(calls.some(c=>c[0]==='service_requests'&&c[1]==='eq'&&
   c[2]==='status'&&c[3]==='accepted'));
 assert.ok(calls.some(c=>c[0]==='profiles'&&c[1]==='eq'&&c[3]==='operator'));
 assert.ok(calls.some(c=>c[1]==='gte'&&c[3]==='2026-11-08T23:00:00.000Z'));
});

function scheduler({busy=[],updateError=null,updateRows=null,readError=null}={}){
 const calls=[];
 const service={
   select(){return {
     eq(field,value){calls.push(['eq',field,value]);return this},
     in(field,values){calls.push(['in',field,values]);return this},
     gte(field,value){calls.push(['gte',field,value]);return this},
     async lt(field,value){
       calls.push(['lt',field,value]);
       return {data:busy,error:readError};
     }
   }},
   update(payload){
     calls.push(['update',payload]);
     return {
       eq(field,value){calls.push(['where',field,value]);return this},
       async select(){
         return {data:updateRows??[{
           id:request,status:'scheduled',operator_id:operator,
           scheduled_at:'2026-11-10T09:00:00+00:00'
         }],error:updateError};
       }
     };
   }
 };
 return {db:{from(table){assert.equal(table,'service_requests');return service}},calls};
}

test('V84: asignar accepted a operario, fecha Cataluña y estado scheduled sin cambiar precio',async()=>{
 const {db,calls}=scheduler();
 const result=await saveOwnerVisit(db,{
   job:accepted,operators:[assigned],operatorId:operator,
   datetime:'2026-11-10T10:00'
 });
 assert.equal(result.ok,true);
 const update=calls.find(c=>c[0]==='update')?.[1];
 assert.deepEqual(update,{
   status:'scheduled',operator_id:operator,
   operator_name:'Operario Prueba',scheduled_at:'2026-11-10T09:00:00.000Z'
 });
 assert.ok(!Object.hasOwn(update,'price'));
 assert.ok(calls.some(c=>c[0]==='where'&&c[1]==='status'&&c[2]==='accepted'));
});

test('V84: presupuestos sin aceptar, otro operario y sesión caducada no escriben',async()=>{
 const {db,calls}=scheduler();
 for(const override of [
   {job:{...accepted,status:'quoted'}},
   {operatorId:owner},
   {allowed:()=>false},
   {datetime:'2026-03-29T02:30'},
   {datetime:'2026-10-25T02:30'}
 ]){
   const result=await saveOwnerVisit(db,{
     job:accepted,operators:[assigned],operatorId:operator,
     datetime:'2026-11-10T10:00',...override
   });
   assert.equal(result.ok,false);
 }
 assert.equal(calls.length,0);
});

test('V84: evita solapamientos y respeta el bloqueo transaccional de PostgreSQL',async()=>{
 const conflict={id:owner,operator_id:operator,status:'scheduled',
   scheduled_at:'2026-11-10T09:30:00.000Z'};
 const {db,calls}=scheduler({busy:[conflict]});
 const opts={job:accepted,operators:[assigned],operatorId:operator,datetime:'2026-11-10T10:00'};
 const busy=await saveOwnerVisit(db,opts);
 assert.equal(busy.ok,false);
 assert.ok(busy.message.includes('menos de 60'));
 assert.ok(!calls.some(c=>c[0]==='update'));
 const pg=scheduler({updateError:{code:'23P01'}});
 assert.equal((await saveOwnerVisit(pg.db,opts)).ok,false);
 const read=scheduler({readError:{message:'sin permisos'}});
 assert.equal((await saveOwnerVisit(read.db,opts)).ok,false);
 const other=scheduler({updateRows:[]});
 assert.equal((await saveOwnerVisit(other.db,opts)).ok,false);
});

test('V84: bandeja de mensajes internos paginada, recuento exacto y nombres privados',async()=>{
 const calls=[];
 const row={id:request,customer_id:owner,sender_id:owner,body:'Necesito presupuesto',
   created_at:'2026-11-09T09:00:00.000Z'};
 const db={from(table){return {select(columns,options){
   calls.push([table,columns,options]);return this;
 },order(){return this},async range(start,end){
   calls.push(['range',start,end]);return {data:[row],count:31,error:null};
 },async in(field,values){
   calls.push(['in',field,values]);return {data:[{id:owner,full_name:'Cliente de prueba'}],error:null};
 }}}};
 const result=await fetchOwnerMessagesPage(db,1);
 assert.equal(result.error,false);
 assert.equal(result.count,31);
 assert.equal(result.names[owner],'Cliente de prueba');
 assert.equal(ownerMessagesPageSize,30);
 assert.equal(ownerMessagePageCount(31),2);
 assert.ok(calls.some(c=>c[0]==='range'&&c[1]===30&&c[2]===59));
 assert.ok(calls.some(c=>c[0]==='messages'&&c[2]?.count==='exact'));
 assert.ok(calls.some(c=>c[0]==='profiles'));
});

test('V84: el propietario es exclusivamente admin; ni clientes ni operarios tienen el acceso',()=>{
 const src=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 const nav=readFileSync(new URL('../customer-ui.js',import.meta.url),'utf8');
 assert.ok(src.includes("ownerEntry.hidden=!(session&&profile?.role==='admin')"));
 assert.ok(src.includes("const ownerOnly=()=>Boolean(session?.user?.id&&profile?.role==='admin')"));
 assert.ok(src.includes("if(!ownerOnly()){if(!session)showLogin();else renderHome();return}"));
 assert.ok(src.includes("else if(profile?.role==='admin'&&!destination)showOwnerDashboard()"));
 assert.ok(src.includes("data-view=\"owner\""));
 assert.ok(!nav.includes("data-view=\"owner\""));
 assert.ok(src.includes("onConversation:customerId=>loadStaffChat"));
 assert.ok(src.includes("onChat:id=>loadStaffChat(id,'Cliente',0,view)"));
 assert.ok(src.includes("if(view==='owner-customers')return showOwnerPeople('customer')"));
});

test('V84: directorio de clientes 30 por página sin leer emails de Auth',async()=>{
 const calls=[];
 const db={from(table){
   assert.equal(table,'profiles');
   return {
     select(fields,options){calls.push(['select',fields,options]);return this},
     eq(field,value){calls.push(['eq',field,value]);return this},
     order(field,options){calls.push(['order',field,options]);return this},
     async range(start,end){
       calls.push(['range',start,end]);
       return {data:[{id:owner,full_name:'Cliente de prueba',phone:'600000000',role:'customer'}],
         count:31,error:null};
     }
   };
 }};
 const result=await fetchOwnerPeoplePage(db,'customer',1);
 assert.equal(result.error,false);
 assert.equal(result.count,31);
 assert.equal(result.data[0].role,'customer');
 assert.equal(ownerPeoplePageSize,30);
 assert.equal(ownerPeoplePageCount(31),2);
 assert.ok(calls.some(c=>c[0]==='range'&&c[1]===30&&c[2]===59));
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='role'&&c[2]==='customer'));
 assert.ok(!calls.some(c=>JSON.stringify(c).includes('email')));
});

test('V84: clientes no pueden forzar rol admin ni consultar directorio inválido',async()=>{
 const db={from(){throw Error('No debe leer tablas privadas')}};
 for(const role of ['admin','billing','owner','']){
   const result=await fetchOwnerPeoplePage(db,role,0);
   assert.equal(result.error,true);
 }
 for(const page of [-1,1.5,100001]){
   const result=await fetchOwnerPeoplePage(db,'operator',page);
   assert.equal(result.error,true);
 }
 assert.deepEqual(await fetchOwnerPeoplePage(null,'operator',0),{data:null,count:null,error:true});
});
