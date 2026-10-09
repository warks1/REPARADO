import './style.css'
import { supabase, isConfigured } from './supabase.js'
import { PushNotifications } from '@capacitor/push-notifications'

const services=[
['Fontanería','Desatasco de lavabo o fregadero',89],['Fontanería','Cambio de sifón',79],
['Fontanería','Reparación de fuga',115],['Fontanería','Sustitución de grifo',105],
['Fontanería','Mecanismo de cisterna',119],['Fontanería','Cambio de llave de paso',99],
['Albañilería','Reposición de azulejos',95],['Albañilería','Alicatado',42],
['Albañilería','Solado de gres',45],['Albañilería','Rejuntado',32],
['Albañilería','Tabique de Pladur',58],['Albañilería','Trasdosado de Pladur',52],
['Albañilería','Techo de Pladur',55],['Parquet','Instalación de parquet/laminado',34],
['Parquet','Reparación de tablas',110],['Parquet','Acuchillado/lijado',38],
['Parquet','Barnizado',31],['Parquet','Retirada de pavimento',17],
['Reformas integrales','Reforma integral de baño',0],['Reformas integrales','Reforma integral de cocina',0]
]
let session=null, profile=null

const app=document.querySelector('#app')
if (!isConfigured) {
  const demoServices = services
  const saved = () => { try { return JSON.parse(localStorage.getItem('reparado-demo-requests') || '[]') } catch { return [] } }
  const persist = items => localStorage.setItem('reparado-demo-requests', JSON.stringify(items))
  app.innerHTML = `<div class="shell"><header><div class="logo">🛠️</div><div><b>Reparado</b><small>Servicios de reparación</small></div><span class="demo-tag">Vista de demostración</span></header><main id="main"></main><footer>© AMS · Empresa propietaria del software</footer></div>`
  const main = app.querySelector('#main')
  const iconFor = c => c==='Fontanería'?'🚰':c==='Albañilería'?'🧱':c==='Parquet'?'🪵':'🏠'
  function home(){ main.innerHTML = `<section class="hero"><h1>Reparado, a tu servicio 👋</h1><p>Solicita una reparación de forma sencilla.</p></section><section class="grid">${demoServices.map((s,i)=>`<article class="card service"><div class="ico">${iconFor(s[0])}</div><div><small>${s[0]}</small><h3>${s[1]}</h3><b>${s[2]?s[2].toFixed(2)+' €':'Por presupuesto'}</b><span>${s[2]?'IVA incluido':'Presupuesto'}</span></div><button data-service="${i}">Solicitar</button></article>`).join('')}</section><nav class="bottom"><button id="requests">📋 Mis solicitudes</button><button id="agenda">📅 Agenda</button></nav>`; main.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>form(demoServices[+b.dataset.service])); main.querySelector('#requests').onclick=requests; main.querySelector('#agenda').onclick=()=>requests(true) }
  function form(s){ main.innerHTML=`<section class="card"><button class="back" id="back">← Volver</button><h2>Solicitar: ${s[1]}</h2><p>Precio orientativo: <b>${s[2]?s[2].toFixed(2)+' €':'Por presupuesto'}</b></p><form id="demoForm"><input name="street" placeholder="Calle" required><input name="address" placeholder="Número / piso / puerta" required><div class="row"><input name="zip" placeholder="Código postal" required><input name="city" value="Barcelona" placeholder="Municipio" required></div><input name="phone" placeholder="Teléfono" required><input name="date" type="date"><textarea name="description" placeholder="Describe el trabajo" required></textarea><button>Guardar solicitud de prueba</button></form><p class="notice">Modo demostración: los datos se guardan en este navegador, no se envían a un técnico.</p></section>`; main.querySelector('#back').onclick=home; main.querySelector('#demoForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);const items=saved();items.unshift({service:s[1],category:s[0],price:s[2],street:f.get('street'),address:f.get('address'),zip:f.get('zip'),city:f.get('city'),phone:f.get('phone'),date:f.get('date'),description:f.get('description'),status:'Pendiente'});persist(items);main.innerHTML='<section class="card"><h2>Solicitud guardada</h2><p>Se ha guardado en este navegador en modo demostración.</p><button id="home">Volver al inicio</button></section>';main.querySelector('#home').onclick=home} }
  function requests(agenda=false){const items=saved();main.innerHTML=`<section class="card"><button class="back" id="back">← Volver</button><h2>${agenda?'Agenda':'Mis solicitudes'}</h2>${items.length?items.map(x=>`<article class="request"><b>${x.service}</b><span>${x.status}</span><p>${x.street}, ${x.address} · ${x.city}</p><small>${x.date||'Sin fecha seleccionada'}</small></article>`).join(''):'<p>No tienes solicitudes guardadas.</p>'}</section>`;main.querySelector('#back').onclick=home} home()
} else {
app.innerHTML=`<div class="shell"><header><div class="logo">🛠️</div><div><b>Reparado</b><small>Servicios de reparación</small></div><button id="logout" class="ghost hidden">Cerrar sesión</button></header><main id="main"></main><footer>© AMS · Empresa propietaria del software</footer></div>`

function escape(s=''){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function money(n){return n?`${Number(n).toFixed(2)} €`:'Por presupuesto'}
function showLogin(){
 document.querySelector('#logout').classList.add('hidden')
 main.innerHTML=`<section class="auth card"><div class="heroicon">🛠️</div><h1>Reparado</h1><p>Tu servicio de reparación, ahora conectado.</p><form id="login"><input id="email" type="email" placeholder="Correo electrónico" required><input id="pass" type="password" placeholder="Contraseña" required><button>Entrar</button></form><button id="register" class="link">Crear una cuenta</button><div id="msg"></div></section>`
 login.onsubmit=async e=>{e.preventDefault();let r=await supabase.auth.signInWithPassword({email:email.value,password:pass.value});if(r.error)msg.textContent=r.error.message;else await boot()}
 register.onclick=async()=>{let em=prompt('Correo electrónico'),pw=prompt('Contraseña (mínimo 6 caracteres)');if(!em||!pw)return;let r=await supabase.auth.signUp({email:em,password:pw});msg.textContent=r.error?r.error.message:'Cuenta creada. Revisa tu correo si se solicita confirmación.'}
}
async function boot(){
 let a=await supabase.auth.getSession();session=a.data.session
 if(!session)return showLogin()
 document.querySelector('#logout').classList.remove('hidden')
 let p=await supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle();profile=p.data
 renderHome()
}
async function renderHome(){
 main.innerHTML=`<section class="hero"><h1>Hola${profile?.full_name?' '+escape(profile.full_name):''} 👋</h1><p>¿Qué necesitas reparar?</p></section>
 <section class="grid">${services.map((s,i)=>`<article class="card service"><div class="ico">${s[0]=='Fontanería'?'🚰':s[0]=='Albañilería'?'🧱':s[0]=='Parquet'?'🪵':'🏠'}</div><div><small>${s[0]}</small><h3>${s[1]}</h3><b>${money(s[2])}</b><span>${s[2]?'IVA incluido':'Presupuesto'}</span></div><button data-service="${i}">Solicitar</button></article>`).join('')}</section>
 <nav class="bottom"><button id="requests">📋 Mis solicitudes</button><button id="chat">💬 Chat</button><button id="agenda">📅 Agenda</button><button id="profile">👤 Perfil</button></nav>`
 document.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>requestForm(services[+b.dataset.service]))
 requests.onclick=loadRequests;chat.onclick=loadChat;agenda.onclick=loadAgenda;profile.onclick=loadProfile
}
async function requestForm(s){
 main.innerHTML=`<section class="card"><button class="back" onclick="renderHome()">← Volver</button><h2>Solicitar: ${escape(s[1])}</h2><p>Precio orientativo: <b>${money(s[2])}</b> · IVA incluido</p><form id="request"><input id="street" placeholder="Calle" required><input id="number" placeholder="Número / piso / puerta" required><div class="row"><input id="zip" placeholder="Código postal" required><input id="city" value="Barcelona" placeholder="Municipio" required></div><input id="phone" placeholder="Teléfono" required><input id="date" type="date"><textarea id="description" placeholder="Describe el trabajo" required></textarea><input id="photos" type="file" accept="image/*" multiple><button>Enviar solicitud</button></form><div id="msg"></div></section>`
 request.onsubmit=async e=>{e.preventDefault();let r=await supabase.from('service_requests').insert({customer_id:session.user.id,service_name:s[1],category:s[0],price:s[2]||null,street:street.value,address_number:number.value,postal_code:zip.value,city:city.value,phone:phone.value,preferred_date:date.value||null,description:description.value,status:'new'}).select().single();if(r.error){msg.textContent=r.error.message;return}await supabase.from('notifications').insert({user_id:session.user.id,title:'Solicitud recibida',body:`Hemos recibido tu solicitud de ${s[1]}.`});msg.textContent='Solicitud enviada correctamente.';setTimeout(renderHome,900)}
}
async function loadRequests(){
 let r=await supabase.from('service_requests').select('*').eq('customer_id',session.user.id).order('created_at',{ascending:false})
 main.innerHTML=`<section class="card"><button class="back" onclick="renderHome()">← Volver</button><h2>Mis solicitudes</h2>${(r.data||[]).map(x=>`<article class="request"><b>${escape(x.service_name)}</b><span>${escape(x.status)}</span><p>${escape(x.street)}, ${escape(x.address_number)} · ${escape(x.city)}</p><small>${x.operator_name?'Operario: '+escape(x.operator_name):'Pendiente de asignación'}</small></article>`).join('')||'<p>No tienes solicitudes todavía.</p>'}</section>`
}
async function loadChat(){
 let r=await supabase.from('messages').select('*').eq('customer_id',session.user.id).order('created_at')
 main.innerHTML=`<section class="card"><button class="back" onclick="renderHome()">← Volver</button><h2>Chat con Reparado</h2><div id="messages">${(r.data||[]).map(x=>`<p class="${x.sender_id==session.user.id?'me':''}">${escape(x.body)}</p>`).join('')}</div><form id="chatForm"><input id="body" placeholder="Escribe un mensaje..." required><button>Enviar</button></form></section>`
 chatForm.onsubmit=async e=>{e.preventDefault();await supabase.from('messages').insert({customer_id:session.user.id,sender_id:session.user.id,body:body.value});loadChat()}
}
async function loadAgenda(){
 let r=await supabase.from('service_requests').select('*').eq('customer_id',session.user.id).eq('status','scheduled').order('scheduled_at')
 main.innerHTML=`<section class="card"><button class="back" onclick="renderHome()">← Volver</button><h2>Mi agenda</h2>${(r.data||[]).map(x=>`<article class="request"><b>${escape(x.service_name)}</b><p>${new Date(x.scheduled_at).toLocaleString('es-ES')}</p><small>Operario: ${escape(x.operator_name||'Pendiente')}</small></article>`).join('')||'<p>No tienes servicios programados.</p>'}</section>`
}
async function loadProfile(){
 main.innerHTML=`<section class="card"><button class="back" onclick="renderHome()">← Volver</button><h2>Mi perfil</h2><p>${escape(session.user.email)}</p><p>Rol: ${escape(profile?.role||'customer')}</p></section>`
}
document.querySelector('#logout').onclick=async()=>{await supabase.auth.signOut();session=null;showLogin()}
supabase.auth.onAuthStateChange((_e,s)=>{session=s;if(s)boot();else showLogin()})
boot()

// Push: registration is safe to run on native platforms; web fallback remains usable.
async function registerPush(){
 try{
  const perm=await PushNotifications.requestPermissions()
  if(perm.receive!=='granted')return
  await PushNotifications.register()
  PushNotifications.addListener('registration',async token=>{
    if(session) await supabase.from('device_tokens').upsert({user_id:session.user.id,token:token.value,platform:'native'})
  })
  PushNotifications.addListener('pushNotificationReceived',n=>alert(n.title||'Reparado'))
 }catch(e){/* browser mode */}
}
setTimeout(registerPush,1500)

}
