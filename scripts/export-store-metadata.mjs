// REPARADO · exportador de fichas de tiendas, sin acceso a Apple/Google.
// Archivo fuente: store-metadata/es-ES.json. No subir credenciales ni publicar tiendas.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const listingFile='store-metadata/es-ES.json';
const entries=[
 ['fastlane/metadata/android/es-ES/title.txt','google_play','name',30],
 ['fastlane/metadata/android/es-ES/short_description.txt','google_play','short_description',80],
 ['fastlane/metadata/android/es-ES/full_description.txt','google_play','full_description',4000],
 ['fastlane/metadata/ios/es-ES/name.txt','app_store','name',30],
 ['fastlane/metadata/ios/es-ES/subtitle.txt','app_store','subtitle',30],
 ['fastlane/metadata/ios/es-ES/description.txt','app_store','description',4000],
 ['fastlane/metadata/ios/es-ES/promotional_text.txt','app_store','promotional_text',170],
 ['fastlane/metadata/ios/es-ES/keywords.txt','app_store','keywords',100]
];

export function fastlaneFiles(listing){
  if(listing?.locale!=='es-ES')throw new Error('Idioma de publicación no admitido.');
  const files={};
  for(const [path,platform,key,max] of entries){
    const value=listing.platforms?.[platform]?.[key];
    if(typeof value!=='string'||!value.trim()||value.trim()!==value)
      throw new Error('Texto de tienda ausente o con espacios sobrantes: '+platform+'.'+key);
    const size=key==='keywords'?Buffer.byteLength(value,'utf8'):Array.from(value).length;
    if(size>max)throw new Error('Texto supera el límite '+max+': '+platform+'.'+key);
    if(/<\/?[a-z][^>]*>/i.test(value))
      throw new Error('HTML no permitido en texto de tienda: '+platform+'.'+key);
    files[path]=value+'\n';
  }
  if(listing.platforms.app_store.description!==listing.platforms.google_play.full_description)
    throw new Error('Las descripciones completas de Apple y Google se han desincronizado.');
  return files;
}

export function exportStoreMetadata(root,{check=false}={}){
  const listing=JSON.parse(readFileSync(join(root,listingFile),'utf8'));
  const files=fastlaneFiles(listing);
  const mismatches=[];
  for(const [relative,body] of Object.entries(files)){
    const target=join(root,relative);
    if(check){
      if(!existsSync(target)||readFileSync(target,'utf8')!==body)mismatches.push(relative);
    }else{
      mkdirSync(dirname(target),{recursive:true});
      writeFileSync(target,body,{encoding:'utf8'});
    }
  }
  return mismatches;
}

const self=fileURLToPath(import.meta.url);
if(process.argv[1]&&resolve(process.argv[1])===self){
  if(!process.argv.includes('--check')&&!process.argv.includes('--write')){
    console.error('Uso: node scripts/export-store-metadata.mjs --check | --write');
    process.exitCode=2;
  }else{
    const root=resolve(dirname(self),'..');
    const check=process.argv.includes('--check');
    const mismatches=exportStoreMetadata(root,{check});
    if(mismatches.length){
      console.error('Metadatos desactualizados:\n'+mismatches.join('\n'));
      process.exitCode=1;
    }else console.log(check?'Fichas de tiendas verificadas y sincronizadas.':'Fichas de tiendas exportadas.');
  }
}
