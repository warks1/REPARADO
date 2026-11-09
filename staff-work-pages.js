// V95 · Historial, contadores exactos y búsqueda privada del personal.
// La RLS del servidor sigue delimitando qué trabajos puede ver cada cuenta.
export const staffWorkPageSize=50;
export const staffWorkColumns=
  'id,customer_id,service_name,street,address_number,postal_code,city,phone,'+
  'description,status,scheduled_at,operator_id,operator_name,price';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const staffWorkPagedFilters=Object.freeze(['all','new','pending','agenda','active','finished']);

// Campo cerrado: nunca interpretar nombres de columnas enviados por el cliente.
export const staffWorkSearchFields=Object.freeze(['service_name','city','phone']);
export function staffWorkSearchTerm(value){
  return String(value??'').normalize('NFKC')
    .replace(/[%_*\\]/g,'').replace(/\s+/g,' ').trim().slice(0,64).trim();
}

export function staffWorkPageCount(count){
  return Number.isSafeInteger(count)&&count>=0?
    Math.max(1,Math.ceil(count/staffWorkPageSize)):0;
}
export function staffWorkCanAdvance(page,count){
  return Number.isSafeInteger(page)&&page>=0&&
    page+1<staffWorkPageCount(count);
}
// El listado y los recuentos deben compartir los mismos predicados de estado.
export function staffWorkFilterQuery(query,filter){
  if(filter==='new')return query.eq('status','new');
  if(filter==='pending')return query.in('status',['new','quoted','accepted']);
  if(filter==='agenda')return query.in('status',['scheduled','in_progress']);
  if(filter==='active')return query.eq('status','in_progress');
  if(filter==='finished')return query.in('status',['completed','cancelled']);
  if(filter==='all')return query;
  throw Error('Filtro de trabajo no válido');
}

// HEAD + count exact: los contadores no transfieren teléfonos, direcciones ni
// descripciones. Un operario solo consulta su operator_id además de RLS.
export async function fetchStaffWorkCounts(supabase,{operatorId=null}={}){
  if(!supabase||(operatorId!==null&&!uuid.test(String(operatorId))))
    return {counts:null,error:true};
  try{
    const pairs=await Promise.all(staffWorkPagedFilters.map(async filter=>{
      let query=supabase.from('service_requests')
        .select('id',{count:'exact',head:true});
      if(operatorId)query=query.eq('operator_id',operatorId);
      const {count,error}=await staffWorkFilterQuery(query,filter);
      if(error||!Number.isSafeInteger(count)||count<0)
        throw Error('Recuento no disponible');
      return [filter,count];
    }));
    return {counts:Object.fromEntries(pairs),error:false};
  }catch{return {counts:null,error:true}}
}

export async function fetchStaffWorkPage(supabase,{
  filter='all',page=0,operatorId=null,searchTerm='',searchField='service_name'
}={}){
  if(!supabase||!staffWorkPagedFilters.includes(filter)||
     !Number.isSafeInteger(page)||page<0||page>100000||
     (operatorId!==null&&!uuid.test(String(operatorId)))||
     !staffWorkSearchFields.includes(searchField))
    return {error:true};
  try{
    let query=supabase.from('service_requests')
      .select(staffWorkColumns,{count:'exact'});
    if(operatorId)query=query.eq('operator_id',operatorId);
    query=staffWorkFilterQuery(query,filter);
    const search=staffWorkSearchTerm(searchTerm);
    if(search)query=query.ilike(searchField,'%'+search+'%');
    query=query.order(filter==='agenda'?'scheduled_at':'created_at',
      {ascending:filter==='agenda'}).order('id',{ascending:false});
    const {data,count,error}=await query.range(
      page*staffWorkPageSize,(page+1)*staffWorkPageSize-1);
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
      return {error:true};
    return {data,count,error:false};
  }catch{return {error:true}}
}
