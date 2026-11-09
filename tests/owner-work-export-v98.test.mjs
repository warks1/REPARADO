import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownerExportDateRange,ownerWorkFilename,buildOwnerWorkCsv,
  shareOwnerWorkCsv,OwnerExportError} from '../owner-work-export.js';

const admin='a0000000-0000-4000-8000-000000000001';
const instant=new Date('2026-11-09T18:00:00Z');
const row={
  id:'c0000000-0000-4000-8000-000000000001',
  service_name:'Reparación de grifo',category:'Fontanería',
  status:'completed',city:'Barcelona',price:150.55,
  operator_name:'Operario de prueba',
  created_at:'2026-11-03T08:15:00.000Z',scheduled_at:null
};

function mockExport(){
  const calls=[];
  const supabase={
    auth:{getUser:async()=>({data:{user:{id:admin}},error:null})},
    from(table){
      calls.push(['from',table]);
      if(table==='profiles')return {
        select(){return this},
        eq(){return this},
        maybeSingle:async()=>({data:{id:admin,role:'admin'},error:null})
      };
      assert.equal(table,'service_requests');
      return {
        select(cols,opts){calls.push(['select',cols,opts]);return this},
        eq(...args){calls.push(['eq',...args]);return this},
        gte(...args){calls.push(['gte',...args]);return this},
        lt(...args){calls.push(['lt',...args]);return this},
        order(...args){calls.push(['order',...args]);return this},
        range:async(start,end)=>{
          calls.push(['range',start,end]);
          return {data:start===0?[row]:[],count:1,error:null};
        }
      };
    }
  };
  return {supabase,calls};
}

test('V98: fechas en Cataluña incluyen día completo en cambios DST de marzo y octubre',()=>{
  assert.deepEqual(ownerExportDateRange('2026-03-29','2026-03-29'),{
    fromDate:'2026-03-29',toDate:'2026-03-29',
    startIso:'2026-03-28T23:00:00.000Z',
    endExclusiveIso:'2026-03-29T22:00:00.000Z'
  });
  assert.deepEqual(ownerExportDateRange('2026-10-25','2026-10-25'),{
    fromDate:'2026-10-25',toDate:'2026-10-25',
    startIso:'2026-10-24T22:00:00.000Z',
    endExclusiveIso:'2026-10-25T23:00:00.000Z'
  });
  assert.deepEqual(ownerExportDateRange(),{
    fromDate:'',toDate:'',startIso:null,endExclusiveIso:null
  });
  assert.equal(ownerExportDateRange('','2026-11-09').startIso,null);
  assert.equal(ownerExportDateRange('2026-11-09','').endExclusiveIso,null);
});

test('V98: rechazar intervalos invertidos, fechas imposibles y entradas maliciosas',()=>{
  for(const [from,to] of [
    ['2026-02-30',''],['2026-02-29',''],['','2026-13-01'],
    ['2026-11-10','2026-11-09'],['1999-12-31',''],
    ['2100-01-01',''],['2026-01-01T00:00',''],
    ["2026-11-09'); DROP TABLE service_requests; --",'']
  ]){
    assert.throws(()=>ownerExportDateRange(from,to),
      e=>e instanceof OwnerExportError && e.code==='date',
      'Rechazar '+from+' / '+to);
  }
});

test('V98: los filtros se aplican en Supabase antes de ordenar y paginar',async()=>{
  const {supabase,calls}=mockExport();
  const result=await buildOwnerWorkCsv({
    supabase,ownerId:admin,isActive:()=>true,
    status:'completed',fromDate:'2026-11-01',toDate:'2026-11-09',now:instant
  });
  assert.equal(result.count,1);
  assert.equal(result.fromDate,'2026-11-01');
  assert.equal(result.toDate,'2026-11-09');
  assert.equal(result.filename,
    'REPARADO-trabajos-completed-desde-2026-11-01-hasta-2026-11-09-2026-11-09.csv');
  assert.deepEqual(calls.find(c=>c[0]==='gte'),[
    'gte','created_at','2026-10-31T23:00:00.000Z'
  ]);
  assert.deepEqual(calls.find(c=>c[0]==='lt'),[
    'lt','created_at','2026-11-09T23:00:00.000Z'
  ]);
  const rangeIndex=calls.findIndex(c=>c[0]==='range');
  assert.ok(calls.findIndex(c=>c[0]==='gte')<rangeIndex);
  assert.ok(calls.findIndex(c=>c[0]==='lt')<rangeIndex);
  assert.ok(calls.findIndex(c=>c[0]==='eq')<rangeIndex);
  assert.ok(calls.some(c=>c[0]==='select'&&!c[1].includes('phone')&&!c[1].includes('street')));
  let downloaded='';
  await shareOwnerWorkCsv(result,{
    ownerId:admin,isActive:()=>true,isNative:()=>false,
    webDownload:snapshot=>{downloaded=snapshot.filename;}
  });
  assert.equal(downloaded,result.filename);
});

test('V98: sin fechas mantiene el formato de los informes V97 y un único límite opcional funciona',async()=>{
  assert.equal(ownerWorkFilename(instant,'all'),
    'REPARADO-trabajos-all-2026-11-09.csv');
  assert.equal(ownerWorkFilename(instant,'new','2026-01-01'),
    'REPARADO-trabajos-new-desde-2026-01-01-2026-11-09.csv');
  assert.equal(ownerWorkFilename(instant,'all','','2026-11-09'),
    'REPARADO-trabajos-all-hasta-2026-11-09-2026-11-09.csv');
  const {supabase,calls}=mockExport();
  await buildOwnerWorkCsv({supabase,ownerId:admin,
    isActive:()=>true,fromDate:'2026-11-01',now:instant});
  assert.ok(calls.some(c=>c[0]==='gte'));
  assert.ok(!calls.some(c=>c[0]==='lt'));
});

test('V98: el panel privado conserva sesión, invalida el CSV si cambian fechas y no altera facturas',()=>{
  const source=readFileSync(new URL('../owner-export-view.js',import.meta.url),'utf8');
  assert.ok(source.includes('name="from_date"'));
  assert.ok(source.includes('name="to_date"'));
  assert.ok(source.includes('for(const input of filterInputs)input.addEventListener'));
  assert.ok(source.includes('fromDate:fromInput.value,toDate:toInput.value'));
  assert.ok(source.includes('clear();'));
  assert.ok(source.includes('isActive:active'));
  assert.ok(source.includes('No se ha emitido ninguna factura'));
});
