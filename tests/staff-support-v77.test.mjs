import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {staffSupportPageSize,staffSupportPageCount,
  staffSupportCanAdvance,fetchStaffSupportPage} from '../staff-support-page.js';

function mock({total=126,networkError=false,missingCount=false}={}){
  const calls=[];
  const chain={
    in(column,values){calls.push(['in',column,values]);return chain},
    order(column,options){calls.push(['order',column,options]);return chain},
    range(start,end){
      calls.push(['range',start,end]);
      if(networkError)return Promise.resolve({data:null,count:null,error:{message:'offline'}});
      const n=Math.max(0,Math.min(end,total-1)-start+1);
      return Promise.resolve({data:Array.from({length:n},(_,i)=>({id:'ticket-'+(start+i)})),
        count:missingCount?null:total,error:null});
    }
  };
  const client={from(table){calls.push(['from',table]);return {
    select(fields,options){calls.push(['select',fields,options]);return chain}
  }}};
  return {calls,client};
}

test('V77: más de 100 incidencias siguen siendo consultables',()=>{
  assert.equal(staffSupportPageSize,50);
  assert.equal(staffSupportPageCount(0),1);
  assert.equal(staffSupportPageCount(50),1);
  assert.equal(staffSupportPageCount(51),2);
  assert.equal(staffSupportPageCount(126),3);
  assert.equal(staffSupportPageCount(null),0);
  assert.equal(staffSupportCanAdvance(0,126),true);
  assert.equal(staffSupportCanAdvance(2,126),false);
  assert.equal(staffSupportCanAdvance(-1,126),false);
});

test('V77: consultar página 3 exige estados pendientes, orden estable y contador real',async()=>{
  const {calls,client}=mock();
  const result=await fetchStaffSupportPage(client,2);
  assert.equal(result.error,false);
  assert.equal(result.count,126);
  assert.equal(result.data.length,26);
  assert.equal(result.data[0].id,'ticket-100');
  assert.equal(result.data.at(-1).id,'ticket-125');
  assert.deepEqual(calls,[
    ['from','support_reports'],
    ['select','id,subject,description,context,status,created_at',{count:'exact'}],
    ['in','status',['open','reviewing']],
    ['order','created_at',{ascending:false}],
    ['order','id',{ascending:false}],
    ['range',100,149]
  ]);
});

test('V77: errores de red, recuento desconocido o página inválida no fingen bandeja vacía',async()=>{
  for(const options of [{networkError:true},{missingCount:true}]){
    const {client}=mock(options);
    assert.deepEqual(await fetchStaffSupportPage(client,0),
      {data:null,count:null,error:true});
  }
  const {client}=mock();
  for(const page of [-1,NaN,1.5,100001]){
    assert.deepEqual(await fetchStaffSupportPage(client,page),
      {data:null,count:null,error:true});
  }
});

test('V77: UI conserva autorización, gestión de estado y navegación segura',()=>{
  const app=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.ok(app.includes("profile?.role!=='admin'"));
  assert.ok(app.includes("fetchStaffSupportPage(supabase,supportPage)"));
  assert.ok(app.includes("staffSupportPageCount(count)-1"));
  assert.ok(app.includes('staffSupportCanAdvance(supportPage,count)'));
  assert.ok(app.includes("data-support-page"));
  assert.ok(app.includes("available()&&seq===refreshSeq"));
  assert.ok(app.includes(".from('support_reports').update({status:next})"));
  assert.ok(app.includes("['reviewing','resolved'].includes(next)"));
  assert.ok(app.includes('esc(item.description)'));
  assert.ok(!app.includes(".order('created_at',{ascending:false}).limit(100)"));
});
