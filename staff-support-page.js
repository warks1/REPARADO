// REPARADO V77 · Bandeja de incidencias de clientes por páginas privadas.
// La base de datos aplica RLS: solo administradores pueden leer esta cola.
export const staffSupportPageSize=50;

export function staffSupportPageCount(count){
  if(!Number.isSafeInteger(count)||count<0)return 0;
  return Math.max(1,Math.ceil(count/staffSupportPageSize));
}
export function staffSupportCanAdvance(page,count){
  return Number.isSafeInteger(page)&&page>=0&&page+1<staffSupportPageCount(count);
}
export async function fetchStaffSupportPage(supabase,page=0){
  if(!supabase||!Number.isSafeInteger(page)||page<0||page>100000)
    return {data:null,count:null,error:true};
  try{
    const {data,count,error}=await supabase.from('support_reports')
      .select('id,subject,description,context,status,created_at',{count:'exact'})
      .in('status',['open','reviewing'])
      .order('created_at',{ascending:false})
      .order('id',{ascending:false})
      .range(page*staffSupportPageSize,(page+1)*staffSupportPageSize-1);
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
      return {data:null,count:null,error:true};
    return {data,count,error:false};
  }catch{
    return {data:null,count:null,error:true};
  }
}
