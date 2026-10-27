// REPARADO V53 · Guardar o compartir constancia de presupuesto aceptado.
// Nunca convertir este documento informativo en factura ni inventar firmas.
// Fuente de datos: solicitud autenticada, con RLS en Supabase.
import {Capacitor} from '@capacitor/core';
import {
  quoteAcceptanceSummary,downloadQuoteAcceptanceSummary
} from './quote-acceptance-summary.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error=()=>new Error('No se pudo preparar el resumen privado del presupuesto.');

export async function shareAcceptedQuote(record,{
  userId,isSessionCurrent,
  isNative=()=>Capacitor.isNativePlatform(),
  webDownload=downloadQuoteAcceptanceSummary,
  randomId=()=>globalThis.crypto?.randomUUID?.(),
  getNativeApis=async()=>{
    const [storage,share]=await Promise.all([
      import('@capacitor/filesystem'),import('@capacitor/share')
    ]);
    return {
      Filesystem:storage.Filesystem,Directory:storage.Directory,
      Encoding:storage.Encoding,Share:share.Share
    };
  },
  scheduleCleanup=(callback,ms)=>setTimeout(callback,ms)
}={}){
  const current=()=>UUID.test(String(userId||''))&&
    typeof isSessionCurrent==='function'&&isSessionCurrent(userId);
  if(!current())throw error();
  // La función de presupuesto original verifica formato, importe y fecha.
  const contents=quoteAcceptanceSummary(record);
  if(!current())throw error();
  if(!isNative()){
    webDownload(record);
    return {mode:'browser'};
  }
  const nonce=randomId();
  if(!UUID.test(String(nonce||'')))throw error();
  // El nombre no incluye ID de cliente, dirección ni servicio.
  const path='REPARADO-aceptacion-'+nonce.toLowerCase()+'.html';
  const apis=await getNativeApis();
  if(!current())throw error();
  const {Filesystem,Directory,Encoding,Share}=apis||{};
  if(!Filesystem?.writeFile||!Filesystem?.deleteFile||!Filesystem?.getUri||
     !Directory?.Cache||!Encoding?.UTF8||!Share?.share||!Share?.canShare)throw error();
  const canShare=await Share.canShare();
  if(!current()||canShare?.value!==true)throw error();

  const location={directory:Directory.Cache,path};
  let written=false;
  try{
    await Filesystem.writeFile({...location,data:contents,encoding:Encoding.UTF8});
    written=true;
    if(!current())throw error();
    const {uri}=await Filesystem.getUri(location);
    if(!current()||!/^file:\/\//i.test(String(uri||'')))throw error();
    await Share.share({
      files:[uri],title:'REPARADO · Presupuesto aceptado',
      dialogTitle:'Guardar o compartir el resumen informativo'
    });
    // Dar tiempo al programa receptor para abrir el adjunto temporal.
    scheduleCleanup(()=>{Filesystem.deleteFile(location).catch(()=>{})},90000);
    return {mode:'native'};
  }catch{
    if(written){try{await Filesystem.deleteFile(location)}catch{}}
    throw error();
  }
}
