// REPARADO V49 · Descarga/compartición de una copia personal JSON.
// Exige una acción explícita y una sesión vigente; no envía archivos por red.
// El adjunto contiene datos sensibles. Solo se ofrece a cuentas cliente.
import {Capacitor} from '@capacitor/core';
import {downloadPersonalDataExport} from './customer-data-export.js';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const failed=()=>new Error('No se pudo compartir la copia privada. Revisa la sesión y vuelve a intentarlo.');

export async function sharePrivateDataExport(snapshot,{
  userId,
  isSessionCurrent,
  isNative=()=>Capacitor.isNativePlatform(),
  webDownload=downloadPersonalDataExport,
  randomId=()=>globalThis.crypto?.randomUUID?.(),
  getNativeApis=async()=>{
    const [store,share]=await Promise.all([
      import('@capacitor/filesystem'),import('@capacitor/share')
    ]);
    return {
      Filesystem:store.Filesystem,
      Directory:store.Directory,
      Encoding:store.Encoding,
      Share:share.Share
    };
  },
  scheduleCleanup=(fn,ms)=>setTimeout(fn,ms)
}={}){
  const own=()=>typeof isSessionCurrent==='function'&&
    UUID.test(String(userId||''))&&isSessionCurrent(userId);
  if(!own()||snapshot?.aplicacion!=='REPARADO'||
     snapshot?.tipo!=='Copia informativa de los datos propios visibles'||
     snapshot?.usuario_id!==userId)throw failed();
  if(!isNative()){
    // La descarga web es síncrona y conserva el comportamiento existente.
    webDownload(snapshot);
    return {mode:'browser'};
  }
  let text;
  try{text=JSON.stringify(snapshot,null,2)}catch{throw failed()}
  if(!text||!own())throw failed();

  const nonce=randomId();
  if(typeof nonce!=='string'||!UUID.test(nonce))throw failed();
  const filename='REPARADO-datos-privados-'+nonce.toLowerCase()+'.json';
  const api=await getNativeApis();
  if(!own())throw failed();
  const {Filesystem,Directory,Encoding,Share}=api||{};
  if(!Filesystem?.writeFile||!Filesystem?.getUri||!Filesystem?.deleteFile||
     !Directory?.Cache||!Encoding?.UTF8||!Share?.share||!Share?.canShare)throw failed();
  const possible=await Share.canShare();
  if(!own()||possible?.value!==true)throw failed();

  const opts={directory:Directory.Cache,path:filename};
  let saved=false;
  try{
    // No utilizar Documentos o carpeta externa: el JSON contiene PII.
    await Filesystem.writeFile({...opts,data:text,encoding:Encoding.UTF8});
    saved=true;
    if(!own())throw failed();
    const file=await Filesystem.getUri(opts);
    if(!own()||!/^file:\/\//i.test(String(file?.uri||'')))throw failed();
    await Share.share({
      files:[file.uri],
      title:'REPARADO · Mis datos personales',
      dialogTitle:'Guardar o compartir esta copia privada'
    });
    // Permitir al destinatario terminar de leer, pero eliminar pronto.
    scheduleCleanup(()=>{Filesystem.deleteFile(opts).catch(()=>{})},90000);
    return {mode:'native'};
  }catch{
    if(saved){try{await Filesystem.deleteFile(opts)}catch{}}
    throw failed();
  }
}
