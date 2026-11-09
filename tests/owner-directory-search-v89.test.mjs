import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownerPeopleSearchTerm,fetchOwnerPeoplePage,ownerPeoplePageSize}
  from '../owner-people.js';

const example='a0000000-0000-4000-8000-000000000001';

function mockDirectory(rows=[{id:example,role:'customer',full_name:"Ana D'Oro",phone:'600000000'}],count=1){
  const calls=[];
  const db={from(table){
    calls.push(['from',table]);
    return {
      select(fields,opts){calls.push(['select',fields,opts]);return this},
      eq(field,value){calls.push(['eq',field,value]);return this},
      ilike(field,pattern){calls.push(['ilike',field,pattern]);return this},
      order(field,opts){calls.push(['order',field,opts]);return this},
      async range(start,end){
        calls.push(['range',start,end]);
        return {data:rows,count,error:null};
      }
    };
  }};
  return {db,calls};
}

test('V89: normaliza espacios, Unicode y escapa comodines sin recortar nombres válidos',()=>{
 assert.equal(ownerPeopleSearchTerm("   Ana    María  "),'Ana María');
 assert.equal(ownerPeopleSearchTerm("   50%_\\ "),'50');
 assert.equal(ownerPeopleSearchTerm("O'Connor"),"O'Connor");
 assert.equal(ownerPeopleSearchTerm(null),'');
 assert.ok(ownerPeopleSearchTerm('A'.repeat(200)).length<=64);
});

test('V89: busca clientes por nombre con RLS, orden y paginación exacta',async()=>{
 const {db,calls}=mockDirectory(undefined,37);
 const result=await fetchOwnerPeoplePage(db,'customer',1," Ana   D'Oro ",'full_name');
 assert.equal(result.error,false);
 assert.equal(result.count,37);
 assert.equal(result.data[0].full_name,"Ana D'Oro");
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='role'&&c[2]==='customer'));
 assert.ok(calls.some(c=>c[0]==='ilike'&&c[1]==='full_name'&&c[2]==="%Ana D'Oro%"));
 assert.ok(calls.some(c=>c[0]==='range'&&c[1]===ownerPeoplePageSize&&c[2]===2*ownerPeoplePageSize-1));
 assert.ok(!calls.some(c=>JSON.stringify(c).includes('auth.users')));
});

test('V89: permite buscar teléfono sin cambiar permisos ni listar clientes a operarios',async()=>{
 const {db,calls}=mockDirectory([{id:example,role:'operator',full_name:'Tecnico',phone:'610000001'}]);
 const result=await fetchOwnerPeoplePage(db,'operator',0,'610','phone');
 assert.equal(result.error,false);
 assert.equal(result.data[0].role,'operator');
 assert.ok(calls.some(c=>c[0]==='ilike'&&c[1]==='phone'&&c[2]==='%610%'));
 assert.equal(calls.find(c=>c[0]==='eq')[2],'operator');
});

test('V89: términos inválidos y búsqueda vacía no evitan los controles de rol',async()=>{
 const {db,calls}=mockDirectory();
 assert.equal((await fetchOwnerPeoplePage(db,'owner',0,'Ana')).error,true);
 assert.equal((await fetchOwnerPeoplePage(db,'customer',0,'Ana','role')).error,true);
 assert.equal((await fetchOwnerPeoplePage(db,'customer',-1,'Ana')).error,true);
 assert.deepEqual(calls,[]);
 assert.equal((await fetchOwnerPeoplePage(db,'customer',0,'%_\\')).error,false);
 assert.ok(!calls.some(c=>c[0]==='ilike'));
});

test('V89: el buscador de directorio es privado, con botón de limpieza y consulta a Supabase',()=>{
 const src=readFileSync(new URL('../owner-people.js',import.meta.url),'utf8');
 const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.ok(src.includes('data-owner-people-search'));
 assert.ok(src.includes('data-owner-people-clear'));
 assert.ok(src.includes("query=query.ilike(field,'%'+search+'%')"));
 assert.ok(src.includes("fetchOwnerPeoplePage(supabase,role,page,search,searchField)"));
 assert.ok(connected.includes("const ownerOnly=()=>Boolean(session?.user?.id&&profile?.role==='admin')"));
});
