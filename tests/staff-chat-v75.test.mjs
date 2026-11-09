import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {customerChatPageSize,customerChatCanReadOlder} from '../customer-chat-page.js';

const code=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
const start=code.indexOf('async function loadStaffChat(');
const end=code.indexOf('async function loadSupportReports(){',start);
const staff=code.slice(start,end);

test('V75: chat del personal empieza por los últimos mensajes y permite leer antiguos',()=>{
 assert.ok(start>0&&end>start);
 assert.equal(customerChatPageSize,50);
 assert.ok(staff.includes('fetchCustomerChatPage(supabase,customerId,requestedPage)'));
 assert.ok(staff.includes('Páginas del chat del personal'));
 assert.ok(staff.includes('customerChatPageCount(result.count)'));
 assert.ok(staff.includes('customerChatCanReadOlder(requestedPage,result.count)'));
 assert.ok(staff.includes("older.textContent='Anteriores →'"));
 assert.ok(staff.includes("newer.textContent='← Más recientes'"));
 assert.ok(staff.includes("refresh.textContent='Actualizar conversación'"));
 assert.ok(!staff.includes(".order('created_at',{ascending:true}).limit(300)"));
 assert.equal(customerChatCanReadOlder(0,101),true);
 assert.equal(customerChatCanReadOlder(2,101),false);
});

test('V75: solo personal autorizado consulta mensajes y se descarta una sesión obsoleta',()=>{
 assert.ok(staff.includes('if(!userIsStaff() || !session)return renderHome()'));
 assert.ok(staff.includes('const staffUserId=session.user.id'));
 assert.ok(staff.includes('const chatEpoch=authEpoch'));
 assert.ok(staff.includes("currentView!=='staff-chat'||!isCurrentUser(staffUserId)||!box.isConnected||authEpoch!==chatEpoch"));
 assert.ok(staff.includes("if(!body||!isCurrentUser(staffUserId)||send.disabled)return"));
 assert.ok(staff.includes("customer_id:customerId,sender_id:staffUserId,body"));
 assert.ok(staff.includes("await loadStaffChat(customerId,serviceName,0,returnView)"));
 assert.ok(staff.includes("p.textContent=row.body"));
 assert.ok(staff.includes("finally{send.disabled=false}"));
});

test('V75: error de red no se presenta como chat vacío ni bloquea recuperación',()=>{
 assert.ok(staff.includes("if(result.error){"));
 assert.ok(staff.includes("No se pudieron cargar los mensajes. Comprueba la conexión."));
 assert.ok(staff.includes("retry.addEventListener('click',()=>loadStaffChat(customerId,serviceName,requestedPage,returnView))"));
 assert.ok(staff.includes("result.count>0&&requestedPage>=customerChatPageCount(result.count)"));
 assert.ok(staff.includes("return loadStaffChat(customerId,serviceName,0,returnView)"));
});
