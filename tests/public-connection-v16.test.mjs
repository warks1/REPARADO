import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPublicConfig} from '../scripts/check-public-config.mjs';

const validHost='https://reparado-cliente-ejemplo.supabase.co';
const validKey='sb_publishable_PUBLIC_EXAMPLE_ONLY';
test('Pages sin credenciales se publica expresamente como demo local',()=>{
 assert.equal(checkPublicConfig('', ''),null);
});
test('no publicar medias configuraciones que caen silenciosamente a modo local',()=>{
 assert.match(checkPublicConfig(validHost,''),/incompleta/);
 assert.match(checkPublicConfig('',validKey),/incompleta/);
});
test('REPARADO Test permanece separado de la web pública',()=>{
 assert.match(checkPublicConfig('https://kpmmlzjvespenogqtujo.supabase.co',validKey),/privado/);
});
test('nunca incluir claves secretas de servidor en un cliente Vite',()=>{
 assert.match(checkPublicConfig(validHost,'sb_secret_PRIVADO_NO_VALIDO'),/secreta/);
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const jwt=[encode({alg:'HS256',typ:'JWT'}),encode({role:'service_role'}),'signature'].join('.');
 assert.match(checkPublicConfig(validHost,jwt),/servidor/);
});
test('solo URL HTTPS y clave publicable o anon JWT',()=>{
 assert.equal(checkPublicConfig(validHost,validKey),null);
 assert.match(checkPublicConfig('http://reparado-cliente-ejemplo.supabase.co',validKey),/HTTPS/);
 assert.match(checkPublicConfig(validHost,'clave-invalida'),/Formato/);
});
