// REPARADO V44 · Copia descargable de los datos propios visibles para el cliente.
// No sustituye el derecho de acceso completo (fotos, valoraciones y otros datos
// pueden requerir un trámite adicional por soporte). Nunca consulta tokens Auth
// ni registros de otras cuentas. Las políticas RLS actúan en el servidor.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE=200;
const MAX_ROWS_PER_SECTION=10000;

const sections=Object.freeze([
  {label:'solicitudes',table:'service_requests',owner:'customer_id',
    fields:'id,customer_id,service_name,category,price,street,address_number,postal_code,city,phone,preferred_date,scheduled_at,description,status,operator_name,created_at,accepted_at,accepted_price'},
  {label:'mensajes',table:'messages',owner:'customer_id',
    fields:'id,customer_id,sender_id,body,created_at'},
  {label:'avisos',table:'notifications',owner:'user_id',
    fields:'id,user_id,title,body,read,created_at'},
  {label:'facturas_visibles',table:'invoices',owner:'customer_id',
    fields:'id,request_id,customer_id,number,subtotal,vat,total,status,created_at',excludeDraft:true},
  // La columna user_id no es legible para clientes por diseño. La política RLS
  // devuelve únicamente las incidencias propias de cuentas customer.
  {label:'incidencias_soporte',table:'support_reports',owner:null,
    fields:'id,subject,description,context,status,created_at'}
]);

export class PersonalDataExportError extends Error{
  constructor(code){
    super(code==='session'?'La sesión ha cambiado. Inicia sesión y vuelve a intentarlo.':
      code==='size'?'El volumen de datos supera el límite de la descarga. Contacta con soporte.':
      'No se pudieron consultar todos tus datos. Comprueba la conexión e inténtalo de nuevo.');
    this.name='PersonalDataExportError';
    this.code=code;
  }
}
function assertOwner(userId,isCurrentUser){
  if(!UUID.test(String(userId||''))||!isCurrentUser(userId))
    throw new PersonalDataExportError('session');
}
async function serverOwner(supabase,userId,isCurrentUser){
  assertOwner(userId,isCurrentUser);
  let result;
  try{result=await supabase.auth.getUser()}catch{throw new PersonalDataExportError('session')}
  assertOwner(userId,isCurrentUser);
  if(result?.error||result?.data?.user?.id!==userId)
    throw new PersonalDataExportError('session');
}
async function loadRows({supabase,userId,isCurrentUser},config){
  const rows=[];
  for(let start=0;start<=MAX_ROWS_PER_SECTION;start+=PAGE_SIZE){
    assertOwner(userId,isCurrentUser);
    let query=supabase.from(config.table).select(config.fields);
    if(config.owner)query=query.eq(config.owner,userId);
    if(config.excludeDraft)query=query.neq('status','draft');
    let result;
    try{
      result=await query.order('id',{ascending:true}).range(start,start+PAGE_SIZE-1);
    }catch{throw new PersonalDataExportError('network')}
    assertOwner(userId,isCurrentUser);
    if(result?.error||!Array.isArray(result?.data))
      throw new PersonalDataExportError('network');
    if(result.data.some(row=>!row||(config.owner&&row[config.owner]!==userId)))
      throw new PersonalDataExportError('network');
    // Cuando devuelve una página completa, comprobar la página siguiente;
    // nunca generar un fichero que se presente como íntegro pero truncado.
    if(rows.length+result.data.length>MAX_ROWS_PER_SECTION)
      throw new PersonalDataExportError('size');
    rows.push(...result.data);
    if(result.data.length<PAGE_SIZE)return rows;
  }
  throw new PersonalDataExportError('size');
}
export async function buildPersonalDataExport({supabase,userId,isCurrentUser,generatedAt=new Date()}){
  if(!supabase||typeof isCurrentUser!=='function')
    throw new PersonalDataExportError('session');
  await serverOwner(supabase,userId,isCurrentUser);
  let profile;
  try{
    const result=await supabase.from('profiles')
      .select('id,full_name,phone,role,created_at').eq('id',userId).maybeSingle();
    profile=result?.error?null:result?.data;
  }catch{throw new PersonalDataExportError('network')}
  assertOwner(userId,isCurrentUser);
  if(!profile||profile.id!==userId)throw new PersonalDataExportError('network');
  // Un administrador ve incidencias de otros usuarios por RLS. Esta exportación
  // es exclusiva de clientes para evitar incluir datos de terceros.
  if(profile.role!=='customer')throw new PersonalDataExportError('session');
  const records={perfil:profile};
  for(const section of sections)
    records[section.label]=await loadRows({supabase,userId,isCurrentUser},section);
  // La solicitud de eliminación es como máximo una fila y su RLS es por cuenta.
  try{
    // user_id no tiene permiso de lectura; RLS limita a la única fila propia.
    const {data,error}=await supabase.from('account_deletion_requests')
      .select('id,status,requested_at,completed_at').maybeSingle();
    if(error)throw error;
    records.solicitud_eliminacion=data||null;
  }catch{throw new PersonalDataExportError('network')}
  await serverOwner(supabase,userId,isCurrentUser);
  if(!(generatedAt instanceof Date)||!Number.isFinite(generatedAt.getTime()))
    throw new PersonalDataExportError('network');
  return {
    aplicacion:'REPARADO',
    tipo:'Copia informativa de los datos propios visibles',
    generado_el:generatedAt.toISOString(),
    usuario_id:userId,
    advertencia:'Este archivo contiene datos personales. Guárdalo en un lugar privado. No es una factura ni una copia completa de todos los archivos de la plataforma.',
    no_incluye:'Fotografías, archivos adjuntos, reseñas pendientes de moderación, datos internos y otros registros no exportables desde esta pantalla. Puedes solicitar acceso adicional mediante soporte.',
    datos:records
  };
}
export function personalDataFilename(date=new Date()){
  if(!(date instanceof Date)||!Number.isFinite(date.getTime()))
    throw new PersonalDataExportError('network');
  return 'REPARADO-mis-datos-'+date.toISOString().slice(0,10)+'.json';
}
export function downloadPersonalDataExport(snapshot){
  if(snapshot?.aplicacion!=='REPARADO'||snapshot?.tipo!=='Copia informativa de los datos propios visibles')
    throw new PersonalDataExportError('network');
  const contents=JSON.stringify(snapshot,null,2);
  const file=new Blob([contents],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(file);
  try{
    const link=document.createElement('a');
    link.href=url;
    link.download=personalDataFilename(new Date(snapshot.generado_el));
    link.style.display='none';
    document.body.appendChild(link);
    try{link.click()}finally{link.remove()}
  }finally{
    // WKWebView/Safari podrían necesitar el enlace temporalmente.
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
}
