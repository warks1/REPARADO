// Se ejecuta únicamente después de 'npx cap add android' en el CI seguro.
// NO escribe secretos en el repositorio: Gradle los consulta al firmar.
import {readFileSync,appendFileSync} from 'node:fs';

export function androidApiLevel(source){
 const match=String(source).match(/\btargetSdkVersion\s*=\s*(\d+)\b/);
 return match?Number(match[1]):null;
}
export function signingGradle(){
 return `
android {
  signingConfigs {
    reparadoStore {
      storeFile file(System.getenv('REPARADO_ANDROID_KEYSTORE_PATH'))
      storePassword System.getenv('REPARADO_ANDROID_KEYSTORE_PASSWORD')
      keyAlias System.getenv('REPARADO_ANDROID_KEY_ALIAS')
      keyPassword System.getenv('REPARADO_ANDROID_KEY_PASSWORD')
    }
  }
  defaultConfig {
    versionCode Integer.parseInt(System.getenv('REPARADO_BUILD_NUMBER'))
    versionName System.getenv('REPARADO_VERSION_NAME')
  }
  buildTypes {
    release {
      signingConfig signingConfigs.reparadoStore
    }
  }
}
`;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const gradlePath='android/app/build.gradle';
 const variablesPath='android/variables.gradle';
 const level=androidApiLevel(readFileSync(variablesPath,'utf8'));
 if(level===null || level<36)throw Error('Google Play exige targetSdkVersion 36 como mínimo; Android generado: '+String(level));
 const original=readFileSync(gradlePath,'utf8');
 if(original.includes('reparadoStore'))throw Error('Configuración de firma duplicada.');
 appendFileSync(gradlePath,'\n// Release firmado por GitHub Actions; secrets solo en entorno.\n'+signingGradle());
 console.log('Gradle preparado para generar AAB firmado; API objetivo '+level);
}
