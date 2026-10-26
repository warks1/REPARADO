import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../connected.js',import.meta.url),'utf8');

function between(a,b){
  const start=source.indexOf(a);
  const end=source.indexOf(b,start+a.length);
  assert.ok(start>=0 && end>start,'No se encontró sección '+a);
  return source.slice(start,end);
}
test('V26: los eventos de autenticación invalidan cargas privadas anteriores',()=>{
  const boot=between('async function boot(){','function registerNativePush(){');
  assert.match(boot,/const epoch=\+\+authEpoch/);
  assert.match(boot,/if\(epoch!==authEpoch\)return/);
  assert.match(boot,/if\(epoch!==authEpoch \|\| !isCurrentUser\(userId\)\)return/);
  const listener=between("supabase.auth.onAuthStateChange((event)=>{","// Mostrar la portada inmediatamente");
  assert.match(listener,/if\(event==='SIGNED_OUT'\)\{\s*authEpoch\+\+/);
  assert.match(listener,/else if\(event==='SIGNED_IN'\)\{\s*authEpoch\+\+/);
});
test('V26: solicitudes, agenda y chat comprueban identidad y vista antes de pintar resultados',()=>{
  const next={loadRequests:'loadAgenda',loadAgenda:'loadChat',loadChat:'loadNotifications'};
  for(const [start,end] of Object.entries(next)){
    const body=between('async function '+start+'(){','async function '+end+'(){');
    assert.match(body,/const userId=session\?\.user\?\.id, ?loadingScreen=main\.firstElementChild/);
    assert.match(body,/!isCurrentUser\(userId\)/);
    assert.match(body,/main\.firstElementChild!==loadingScreen/);
  }
});
test('V26: el panel del personal y su chat no reponen datos de otra sesión',()=>{
  const admin=between('async function renderAdmin(','// Los documentos se generan solo');
  assert.match(admin,/staffUserId=session\.user\.id, loadingScreen=main\.firstElementChild/);
  assert.match(admin,/main\.firstElementChild!==loadingScreen/);
  assert.match(admin,/const staffSaves=new Set\(\)/);
  assert.match(admin,/staffSaves\.has\(jobId\)/);
  assert.match(admin,/finally\s*\{\s*staffSaves\.delete\(jobId\)/);
  assert.match(admin,/!isCurrentUser\(staffUserId\)\|\|currentView!=='admin'\|\|!form\.isConnected/);
  const chat=between('async function loadStaffChat(','async function loadSupportReports(){');
  assert.match(chat,/!isCurrentUser\(staffUserId\)\|\|!box\.isConnected/);
  assert.match(chat,/if\(!body\|\|!isCurrentUser\(staffUserId\)\|\|send\.disabled\)return/);
  assert.match(chat,/finally\{send\.disabled=false\}/);
});
test('V26: cambios de perfil y fotos privadas restablecen botones y no muestran errores del servidor',()=>{
  const profile=between("main.querySelector('#profile-form').addEventListener('submit'","async function loadStaffChat(");
  assert.match(profile,/const profileForm=event\.currentTarget/);
  assert.match(profile,/profileForm\.isConnected/);
  assert.match(profile,/finally\{button\.disabled=false\}/);
  const photos=between("main.querySelectorAll('[data-photos]')","supabase.auth.onAuthStateChange");
  assert.match(photos,/isCurrentUser\(staffUserId\)/);
  assert.match(photos,/catch\s*\{/);
  assert.match(photos,/finally\{button\.disabled=false\}/);
});
test('V26: la app no confirma presupuestos ni fotos de otro usuario en pantalla',()=>{
  const customer=between('async function loadRequests(){','async function loadAgenda(){');
  assert.match(customer,/isCurrentUser\(quoteUserId\)/);
  assert.match(customer,/!isCurrentUser\(uid\)/);
  assert.match(customer,/!isCurrentUser\(staffUserId\)|!isCurrentUser\(userId\)/);
  const req=between('function requestForm(service){','async function loadRequests(){');
  assert.match(req,/!isCurrentUser\(payload\.customer_id\)/);
});
