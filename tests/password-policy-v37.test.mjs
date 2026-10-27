import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateNewPassword,MIN_NEW_PASSWORD_LENGTH,MAX_NEW_PASSWORD_LENGTH} from '../password-policy.js';

const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');

test('V37: contraseñas nuevas tienen al menos 15 caracteres Unicode y hasta 128',()=>{
  assert.equal(MIN_NEW_PASSWORD_LENGTH,15);
  assert.equal(MAX_NEW_PASSWORD_LENGTH,128);
  assert.match(validateNewPassword('frase demasia'),/15 caracteres/);
  assert.equal(validateNewPassword('Mi frase segura con espacios y acentos áéí'),null);
  assert.equal(validateNewPassword('🧩'.repeat(15)),null); // codepoints, no UTF-16
  assert.equal(validateNewPassword('🧩'.repeat(129))!==null,true);
  assert.equal(validateNewPassword('una contraseña muy larga '.repeat(5)),null);
});

test('V37: sin obligación de mayúsculas, cifras ni símbolos',()=>{
  assert.equal(validateNewPassword('cafetera sabana bosque'),null);
  assert.equal(validateNewPassword('Unas palabras separadas por espacios'),null);
  assert.equal(validateNewPassword('123456789012345')!==null,true);
});

test('V37: bloquea algunos ejemplos de contraseñas previsibles, sin fingir filtraciones reales',()=>{
  for(const weak of ['passwordpassword','REPARADO20262026','adminadminadmin','qwertyuiopasdfgh','aaaaaaaaaaaaaaaaaaaa']){
    assert.match(validateNewPassword(weak),/previsible/);
  }
  assert.equal(validateNewPassword(undefined)!=null,true);
});

test('V37: registro e invitación/recuperación validan antes de enviar a Auth',()=>{
  assert.equal((connected.match(/autocomplete="new-password" minlength="15" maxlength="128" required/g)||[]).length,4);
  assert.equal((connected.match(/const passwordError=validateNewPassword\(password\);/g)||[]).length,2);
  assert.match(connected,/signUp\(/);
  assert.match(connected,/auth\.updateUser\(\{password\}\)/);
  assert.match(connected,/signInWithPassword\(/);
  const login=connected.slice(connected.indexOf("main.querySelector('#login').addEventListener"),connected.indexOf("main.querySelector('#forgot-password').addEventListener"));
  assert.doesNotMatch(login,/validateNewPassword/); // cuentas existentes siguen entrando
});
