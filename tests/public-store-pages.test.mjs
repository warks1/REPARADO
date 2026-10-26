import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contactLinksMarkup} from '../contact-emails.js';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');

test('centro de ayuda de REPARADO es público, accesible y usa los dos buzones correctos',()=>{
 const html=read('soporte.html');
 assert.ok(html.includes('<!doctype html>'));
 assert.ok(html.includes('lang="es"'));
 assert.ok(html.includes('name="viewport"'));
 assert.ok(html.includes('reparado_soporte@outlook.es'));
 assert.ok(html.includes('reparado_clientes@outlook.es'));
 assert.ok(html.includes('mailto:'));
 assert.ok(html.includes('abrir el correo no significa que el mensaje se haya enviado')); // Envío manual
});
test('recurso web de eliminación de cuenta funciona sin login ni JavaScript',()=>{
 const html=read('eliminar-cuenta.html');
 assert.ok(html.includes('lang="es"'));
 assert.ok(html.includes('REPARADO'));
 assert.ok(html.includes('Solicitar eliminación por correo'));
 assert.ok(html.includes('mailto:reparado_soporte@outlook.es'));
 assert.ok(html.includes('Mi perfil'));
 assert.ok(html.includes('No necesitas volver a instalar REPARADO'));
 assert.ok(!html.includes('<script'));
 assert.ok(!html.includes('type="password"'));
 assert.ok(html.includes('facturas'));
});
test('footer y perfiles enlazan al centro de ayuda y a la eliminación',()=>{
 const html=contactLinksMarkup();
 assert.ok(html.includes('href="./soporte.html"'));
 assert.ok(html.includes('href="./eliminar-cuenta.html"'));
 assert.ok(html.includes('mailto:reparado_soporte@outlook.es'));
 assert.ok(html.includes('mailto:reparado_clientes@outlook.es'));
});
