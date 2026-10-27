// Diagnóstico de lectura no destructivo para una sesión administrativa.
// No crea solicitudes, no comprueba contraseñas, no devuelve datos de clientes.
// La seguridad efectiva sigue dependiendo de Supabase Auth y RLS.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const checked=(label,ok)=>({label,ok:Boolean(ok)});
export async function checkRealBackendConnection({supabase,userId}={}){
  if(!supabase||!uuid.test(String(userId||'')))
    return {ok:false,checks:[checked('Identidad de sesión',false)]};
  const checks=[];
  try{
    // getUser consulta Auth en el servidor; getSession aislado no bastaría.
    const {data,error}=await supabase.auth.getUser();
    const valid=!error&&data?.user?.id===userId;
    checks.push(checked('Identidad de sesión',valid));
    if(!valid)return {ok:false,checks};
  }catch{
    return {ok:false,checks:[checked('Identidad de sesión',false)]};
  }

  try{
    const {data,error}=await supabase.from('profiles')
      .select('id,role').eq('id',userId).maybeSingle();
    const valid=!error&&data?.id===userId&&data?.role==='admin';
    checks.push(checked('Rol de administración autorizado',valid));
    if(!valid)return {ok:false,checks};
  }catch{
    checks.push(checked('Rol de administración autorizado',false));
    return {ok:false,checks};
  }

  const probes=[
    ['Lectura autorizada de solicitudes','service_requests','customer_id'],
    ['Lectura de avisos propios','notifications','user_id']
  ];
  for(const [label,table,column] of probes){
    try{
      const {error}=await supabase.from(table)
        .select('id',{count:'exact',head:true}).eq(column,userId);
      checks.push(checked(label,!error));
    }catch{
      checks.push(checked(label,false));
    }
  }
  return {ok:checks.every(x=>x.ok),checks};
}
