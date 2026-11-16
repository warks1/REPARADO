// REPARADO V113: activa FCM en el proyecto Android generado por Capacitor.
// Ejecutar DESPUÉS de 'npx cap add android'. Con --require, una compilación
// de tienda falla si falta google-services.json (sin él no hay push y el
// registro puede cerrar la app). Nunca imprime ni guarda el contenido.
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';

export const PACKAGE='com.ams.reparado';
export function parseGoogleServices(base64){
 let data;
 try{data=JSON.parse(Buffer.from(String(base64||''),'base64').toString('utf8'));}
 catch{throw Error('REPARADO_GOOGLE_SERVICES_JSON_BASE64 no es un JSON válido en base64.');}
 const clients=Array.isArray(data?.client)?data.client:[];
 const match=clients.find(c=>c?.client_info?.android_client_info?.package_name===PACKAGE);
 if(!match)throw Error('google-services.json no contiene la app Android '+PACKAGE+'.');
 if(!data.project_info?.project_id)throw Error('google-services.json sin project_id.');
 return data;
}
export function withNotificationPermission(manifest){
 if(manifest.includes('android.permission.POST_NOTIFICATIONS'))return manifest;
 return manifest.replace(/<manifest([^>]*)>/,m=>m+'\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const required=process.argv.includes('--require');
 const value=process.env.REPARADO_GOOGLE_SERVICES_JSON_BASE64||'';
 const manifestPath='android/app/src/main/AndroidManifest.xml';
 if(!existsSync(manifestPath))throw Error('Falta el proyecto Android generado.');
 writeFileSync(manifestPath,withNotificationPermission(readFileSync(manifestPath,'utf8')));
 if(!value){
  if(required)throw Error('Falta REPARADO_GOOGLE_SERVICES_JSON_BASE64: sin él las notificaciones push no funcionan en Android.');
  console.warn('Sin google-services.json: compilación sin notificaciones push (solo pruebas).');
 }else{
  const data=parseGoogleServices(value);
  mkdirSync('android/app',{recursive:true});
  writeFileSync('android/app/google-services.json',JSON.stringify(data));
  console.log('google-services.json instalado para',PACKAGE);
 }
}
