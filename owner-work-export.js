import {Capacitor} from '@capacitor/core';
import {madridLocalDateTimeToIso} from './staff-timezone.js';
// REPARADO V97 · Informe de trabajo interno CSV, NO una factura.
// Solo el titular con sesión admin verificada puede preparar la descarga.
// La selección y exportación respetan RLS; nunca usa service_role en el cliente.
export const ownerExportPageSize=200;
export const ownerExportMaxRows=10000;
export const ownerExportStatuses=Object.freeze([
  'all','new','quoted','accepted','scheduled','in_progress','completed','cancelled'
]);
export const ownerExportColumns=
  'id,service_name,category,status,city,price,operator_name,created_at,scheduled_at';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// Los filtros corresponden a días naturales en Cataluña, no al huso del móvil.
function checkedExportDate(value){
  if(value===''||value===null||value===undefined)return '';
  if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(value))
    throw new OwnerExportError('date');
  const [year,month,day]=value.split('-').map(Number);
  if(new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)!==value)
    throw new OwnerExportError('date');
  return value;
}
export function ownerExportDateRange(fromDate='',toDate=''){
  const from=checkedExportDate(fromDate),to=checkedExportDate(toDate);
  if(from&&to&&from>to)throw new OwnerExportError('date');
  const startIso=from?madridLocalDateTimeToIso(from+'T00:00').iso:null;
  let endExclusiveIso=null;
  if(to){
    const [year,month,day]=to.split('-').map(Number);
    const next=new Date(Date.UTC(year,month-1,day+1)).toISOString().slice(0,10);
    endExclusiveIso=madridLocalDateTimeToIso(next+'T00:00').iso;
  }
  if((from&&!startIso)||(to&&!endExclusiveIso))
    throw new OwnerExportError('date');
  return {fromDate:from,toDate:to,startIso,endExclusiveIso};
}

export class OwnerExportError extends Error{
  constructor(code){
    super(code==='session'?
      'La sesión del propietario no es válida. Inicia sesión de nuevo.':
      code==='limit'?
      'El historial supera 10.000 trabajos. Acota el informe por estado o solicita una exportación especializada.':
      code==='changed'?
      'El historial cambió durante la exportación. Vuelve a generar la copia para evitar registros incompletos.':
      code==='date'?
      'Revisa el intervalo: utiliza fechas válidas de 2000 a 2099 y Desde no posterior a Hasta.':
      'No se pudo generar la copia privada. Comprueba la conexión e inténtalo de nuevo.');
    this.code=code;this.name='OwnerExportError';
  }
}

function verifySession(ownerId,isActive){
  if(!UUID.test(String(ownerId||''))||typeof isActive!=='function'||!isActive())
    throw new OwnerExportError('session');
}

async function verifyServerOwner(supabase,ownerId,isActive){
  verifySession(ownerId,isActive);
  if(!supabase?.auth?.getUser||!supabase?.from)throw new OwnerExportError('session');
  let auth;
  try{auth=await supabase.auth.getUser()}catch{throw new OwnerExportError('session')}
  verifySession(ownerId,isActive);
  if(auth?.error||auth?.data?.user?.id!==ownerId)throw new OwnerExportError('session');
  let profile;
  try{
    profile=await supabase.from('profiles').select('id,role')
      .eq('id',ownerId).maybeSingle();
  }catch{throw new OwnerExportError('session')}
  verifySession(ownerId,isActive);
  if(profile?.error||profile?.data?.id!==ownerId||profile.data.role!=='admin')
    throw new OwnerExportError('session');
}

export function ownerCsvCell(value){
  // El CSV puede abrirse como hoja de cálculo. Bloquear fórmulas maliciosas
  // aunque el dato provenga de la BD y no de la pantalla actual.
  const raw=String(value??'').replace(/[\u0000-\u001f\u007f]+/g,' ').trim();
  const safe=/^[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/u.test(raw)?"'"+raw:raw;
  return '"'+safe.replace(/"/g,'""')+'"';
}

function csvAmount(price){
  if(price===null||price===undefined||price==='')return '';
  const value=Number(price);
  return Number.isFinite(value)&&value>=0?value.toFixed(2).replace('.',','):'';
}
export function ownerWorkCsv(rows){
  if(!Array.isArray(rows))throw new OwnerExportError('network');
  const header=['Referencia','Servicio','Categoría','Estado','Población',
    'Precio IVA incluido (€)','Operario','Fecha solicitud (UTC)','Visita (UTC)'];
  const lines=[header.map(ownerCsvCell).join(';')];
  for(const row of rows){
    if(!row||typeof row!=='object')throw new OwnerExportError('network');
    const data=[row.id,row.service_name,row.category,row.status,row.city,
      csvAmount(row.price),row.operator_name,row.created_at,row.scheduled_at];
    lines.push(data.map(ownerCsvCell).join(';'));
  }
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
export function ownerWorkFilename(now=new Date(),status='all',fromDate='',toDate=''){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime())||
     !ownerExportStatuses.includes(status))throw new OwnerExportError('network');
  const period=ownerExportDateRange(fromDate,toDate);
  const suffix=(period.fromDate?'-desde-'+period.fromDate:'')+
    (period.toDate?'-hasta-'+period.toDate:'');
  return 'REPARADO-trabajos-'+status+suffix+'-'+now.toISOString().slice(0,10)+'.csv';
}

export async function buildOwnerWorkCsv({supabase,ownerId,isActive,
  status='all',fromDate='',toDate='',onProgress=()=>{},now=new Date()}={}){
  if(!ownerExportStatuses.includes(status)||!supabase||
     !(now instanceof Date)||!Number.isFinite(now.getTime()))
    throw new OwnerExportError('network');
  const period=ownerExportDateRange(fromDate,toDate);
  await verifyServerOwner(supabase,ownerId,isActive);
  const rows=[],ids=new Set();
  let expected=null;
  for(let offset=0;offset<=ownerExportMaxRows;offset+=ownerExportPageSize){
    verifySession(ownerId,isActive);
    let query=supabase.from('service_requests')
      .select(ownerExportColumns,{count:'exact'});
    if(status!=='all')query=query.eq('status',status);
    if(period.startIso)query=query.gte('created_at',period.startIso);
    if(period.endExclusiveIso)query=query.lt('created_at',period.endExclusiveIso);
    let result;
    try{
      result=await query.order('created_at',{ascending:true})
        .order('id',{ascending:true})
        .range(offset,offset+ownerExportPageSize-1);
    }catch{throw new OwnerExportError('network')}
    verifySession(ownerId,isActive);
    if(result?.error||!Array.isArray(result?.data)||
       !Number.isSafeInteger(result.count)||result.count<0)
      throw new OwnerExportError('network');
    if(expected===null){
      expected=result.count;
      if(expected>ownerExportMaxRows)throw new OwnerExportError('limit');
    }else if(result.count!==expected)throw new OwnerExportError('changed');
    if(offset+result.data.length>ownerExportMaxRows)
      throw new OwnerExportError('limit');
    if(result.data.length!==Math.min(ownerExportPageSize,expected-offset))
      throw new OwnerExportError('changed');
    for(const row of result.data){
      if(!UUID.test(String(row?.id||''))||ids.has(row.id)||
         !ownerExportStatuses.includes(row.status)||row.status==='all')
        throw new OwnerExportError('changed');
      ids.add(row.id);rows.push(row);
    }
    onProgress(rows.length,expected);
    if(rows.length===expected)break;
  }
  if(rows.length!==expected)throw new OwnerExportError('changed');
  await verifyServerOwner(supabase,ownerId,isActive);
  return {
    type:'REPARADO_WORK_REPORT_CSV_V97',ownerId,
    filename:ownerWorkFilename(now,status,period.fromDate,period.toDate),
    count:rows.length,status,fromDate:period.fromDate,toDate:period.toDate,
    contents:ownerWorkCsv(rows)
  };
}

const exportFailure=()=>new OwnerExportError('network');
export async function shareOwnerWorkCsv(snapshot,{
  ownerId,isActive,
  isNative=()=>Capacitor.isNativePlatform(),
  webDownload=ownerWorkWebDownload,
  randomId=()=>globalThis.crypto?.randomUUID?.(),
  getNativeApis=async()=>{
    const [{Filesystem,Directory,Encoding},{Share}]=await Promise.all([
      import('@capacitor/filesystem'),import('@capacitor/share')
    ]);
    return {Filesystem,Directory,Encoding,Share};
  },
  scheduleCleanup=(callback,delay)=>setTimeout(callback,delay)
}={}){
  verifySession(ownerId,isActive);
  if(snapshot?.type!=='REPARADO_WORK_REPORT_CSV_V97'||
     snapshot.ownerId!==ownerId||!ownerExportStatuses.includes(snapshot.status)||
     typeof snapshot.contents!=='string'||!snapshot.contents.startsWith('\uFEFF')||
     !/^REPARADO-trabajos-(all|new|quoted|accepted|scheduled|in_progress|completed|cancelled)(?:-desde-\d{4}-\d{2}-\d{2})?(?:-hasta-\d{4}-\d{2}-\d{2})?-\d{4}-\d{2}-\d{2}\.csv$/.test(String(snapshot.filename)))
    throw exportFailure();
  if(!isNative()){
    webDownload(snapshot);
    return {mode:'browser'};
  }
  const nonce=randomId();
  if(!UUID.test(String(nonce||'')))throw exportFailure();
  const opts={directory:null,path:'reparado-informe-'+nonce.toLowerCase()+'.csv'};
  const {Filesystem,Directory,Encoding,Share}=await getNativeApis();
  verifySession(ownerId,isActive);
  if(!Filesystem?.writeFile||!Filesystem?.getUri||!Filesystem?.deleteFile||
     !Directory?.Cache||!Encoding?.UTF8||!Share?.share||!Share?.canShare)
    throw exportFailure();
  const can=await Share.canShare();
  verifySession(ownerId,isActive);
  if(can?.value!==true)throw exportFailure();
  opts.directory=Directory.Cache;
  let saved=false;
  try{
    await Filesystem.writeFile({...opts,data:snapshot.contents,encoding:Encoding.UTF8});
    saved=true;
    verifySession(ownerId,isActive);
    const {uri}=await Filesystem.getUri(opts);
    verifySession(ownerId,isActive);
    if(!/^file:\/\//i.test(String(uri||'')))throw exportFailure();
    await Share.share({
      files:[uri],title:'REPARADO · Informe privado de trabajos',
      dialogTitle:'Guardar el CSV en un lugar privado'
    });
    scheduleCleanup(()=>{Filesystem.deleteFile(opts).catch(()=>{})},90000);
    return {mode:'native'};
  }catch{
    if(saved){try{await Filesystem.deleteFile(opts)}catch{}}
    throw exportFailure();
  }
}

export function ownerWorkWebDownload(snapshot){
  if(snapshot?.type!=='REPARADO_WORK_REPORT_CSV_V97')
    throw exportFailure();
  const blob=new Blob([snapshot.contents],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  try{
    const link=document.createElement('a');
    link.href=url;link.download=snapshot.filename;
    link.style.display='none';
    document.body.appendChild(link);
    try{link.click()}finally{link.remove()}
  }finally{
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
}
