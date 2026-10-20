import {localRequestBackup} from './local-document.js';
import {validLocalDate} from './local-data.js';

// Copias de solicitudes guardadas exclusivamente en el dispositivo.
// No sincroniza información, no interpreta confirmaciones y no permite
// sobreescribir registros ya existentes al importar.
const textFields={
 id:100,category:100,service:200,street:120,address:80,postal_code:5,
 city:90,phone:25,description:2000,date:10,period:80,status:50,
 created_at:35,updated_at:35
};
export const localBackupLimit=500000;
export function makeLocalCollection(requests,exportedAt=new Date().toISOString()){
 if(!Array.isArray(requests)||requests.length>250)throw new Error('Demasiadas solicitudes para esta copia.');
 const backup={
  format:'reparado-local-collection',version:1,exported_at:exportedAt,
  sent_to_company:false,appointment_confirmed:false,
  requests:requests.map(r=>localRequestBackup(r,exportedAt).request)
 };
 // Evita descargar una copia que la propia función de importación no admita.
 if(JSON.stringify(backup).length>localBackupLimit)
   throw new Error('La copia completa supera el tamaño permitido. Descarga las solicitudes por separado.');
 return backup;
}
function parseBackup(input){
 if(typeof input!=='string'||input.length>localBackupLimit)
   throw new Error('La copia es demasiado grande o no es un archivo JSON válido.');
 let document;
 try{document=JSON.parse(input)}
 catch{throw new Error('El archivo no contiene JSON válido.')}
 if(!document||typeof document!=='object'||Array.isArray(document)||document.version!==1)
   throw new Error('Versión de copia no admitida.');
 const list=document.format==='reparado-local-collection'?document.requests:
   document.format==='reparado-local-request'?[document.request]:null;
 if(!Array.isArray(list)||list.length>250)
   throw new Error('Formato de copia no reconocido o supera 250 solicitudes.');
 return list;
}
export function restoreLocalCollection(content,existing=[]){
 const rows=parseBackup(content);
 const current=Array.isArray(existing)?existing:[];
 if(current.length>250)throw new Error('Ya hay demasiadas solicitudes almacenadas.');
 const oldIds=new Set(current.map(x=>String(x?.id??'')));
 const importedIds=new Set();
 const imported=[];
 let duplicates=0;
 // Se valida TODO antes de ofrecer el guardado; no hay importación parcial.
 for(const [idx,source] of rows.entries()){
  if(!source||typeof source!=='object'||Array.isArray(source))
    throw new Error('Solicitud '+(idx+1)+': contenido incorrecto.');
  const clean={};
  for(const [field,max] of Object.entries(textFields)){
   const value=source[field];
   if(value===undefined||value===null)continue;
   if(typeof value!=='string'&&typeof value!=='number')
     throw new Error('Solicitud '+(idx+1)+': campo '+field+' inválido.');
   const str=String(value);
   if(str.length>max)throw new Error('Solicitud '+(idx+1)+': campo '+field+' demasiado largo.');
   clean[field]=str;
  }
  const id=String(clean.id||'').trim();
  if(!id||!clean.service||!clean.category||!/[a-zA-Z0-9]/.test(id))
    throw new Error('Solicitud '+(idx+1)+': faltan datos de identificación.');
  if(clean.date&&!validLocalDate(clean.date))
    throw new Error('Solicitud '+(idx+1)+': fecha inválida.');
  if(clean.postal_code&&!/^[0-9]{5}$/.test(clean.postal_code))
    throw new Error('Solicitud '+(idx+1)+': código postal inválido.');
  if(source.price!==undefined&&source.price!==null){
    if(typeof source.price!=='number'||!Number.isFinite(source.price)||source.price<0||source.price>999999)
      throw new Error('Solicitud '+(idx+1)+': precio inválido.');
    clean.price=source.price;
  }
  clean.status='Pendiente (local)';
  if(source.history!==undefined){
   if(!Array.isArray(source.history)||source.history.length>30)
     throw new Error('Solicitud '+(idx+1)+': historial no válido.');
   clean.history=source.history.map(event=>{
     if(!event||!['created','preferences_changed'].includes(event.type)||!Number.isFinite(Date.parse(event.at||'')))
       throw new Error('Solicitud '+(idx+1)+': historial incorrecto.');
     return {type:event.type,at:event.at};
   });
  }
  if(oldIds.has(id)||importedIds.has(id)){duplicates++;continue}
  importedIds.add(id);imported.push(clean);
 }
 if(current.length+imported.length>250)throw new Error('La copia supera el límite de solicitudes en este dispositivo.');
 return {requests:[...current,...imported],added:imported.length,duplicates};
}
