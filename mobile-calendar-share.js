// REPARADO V46: compartir un archivo .ics mediante el selector nativo
// de iOS/Android; la web conserva la descarga estándar del navegador.
// No pide acceso ni escribe en el calendario del usuario.
import {Capacitor} from '@capacitor/core';
import {visitCalendarText,visitCalendarFilename,downloadVisitCalendar} from './visit-calendar.js';

export async function shareVisitCalendar(visit,{
  isNative=()=>Capacitor.isNativePlatform(),
  webDownload=downloadVisitCalendar,
  getNativeApis=async()=>{
    const [storage,share]=await Promise.all([
      import('@capacitor/filesystem'),import('@capacitor/share')
    ]);
    return {
      Filesystem:storage.Filesystem,
      Directory:storage.Directory,
      Encoding:storage.Encoding,
      Share:share.Share
    };
  },
  scheduleCleanup=(callback,delay)=>setTimeout(callback,delay)
}={}){
  // Validar íntegramente el evento ANTES de solicitar permisos o escribir ficheros.
  const content=visitCalendarText(visit);
  const filename=visitCalendarFilename(visit);
  if(!isNative()){
    webDownload(visit);
    return {mode:'browser'};
  }

  const {Filesystem,Directory,Encoding,Share}=await getNativeApis();
  if(!Filesystem?.writeFile||!Filesystem?.getUri||!Filesystem?.deleteFile||
     !Directory?.Cache||!Encoding?.UTF8||!Share?.share||!Share?.canShare)
    throw new Error('El sistema no dispone de los plugins nativos de calendario.');
  const ability=await Share.canShare();
  if(ability?.value!==true)
    throw new Error('No se puede compartir el calendario desde este dispositivo.');

  const options={path:filename,directory:Directory.Cache};
  let written=false;
  try{
    await Filesystem.writeFile({...options,data:content,encoding:Encoding.UTF8});
    written=true;
    const result=await Filesystem.getUri(options);
    if(!result?.uri || !/^file:\/\//i.test(result.uri))
      throw new Error('No se pudo obtener el archivo temporal de calendario.');

    // Usar files en lugar de URL de texto: preserva el adjunto .ics y el tipo.
    // Android admite compartir ficheros cache por defecto (FileProvider).
    await Share.share({
      files:[result.uri],
      title:'Visita REPARADO',
      dialogTitle:'Abrir visita en el calendario'
    });
    // El destinatario puede necesitar leer el adjunto después de cerrar el
    // diálogo de compartir: no borrar el fichero de forma inmediata.
    scheduleCleanup(()=>{
      Filesystem.deleteFile(options).catch(()=>{});
    },120000);
    return {mode:'native'};
  }catch(error){
    if(written){
      try{await Filesystem.deleteFile(options)}catch{}
    }
    throw error;
  }
}
