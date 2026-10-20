import './style.css'
import { supabase, isConfigured } from './supabase.js'

const services=[
['Fontanería','Desatasco de lavabo o fregadero',89],['Fontanería','Cambio de sifón',79],
['Fontanería','Reparación de fuga',115],['Fontanería','Sustitución de grifo',105],
['Fontanería','Mecanismo de cisterna',119],['Fontanería','Cambio de llave de paso',99],
['Albañilería','Reposición de azulejos',95],['Albañilería','Alicatado',42,'m²'],
['Albañilería','Solado de gres',45,'m²'],['Albañilería','Rejuntado',32,'m²'],
['Albañilería','Tabique de Pladur',58,'m²'],['Albañilería','Trasdosado de Pladur',52,'m²'],
['Albañilería','Techo de Pladur',55,'m²'],['Parquet','Instalación de parquet/laminado',34,'m²'],
['Parquet','Reparación de tablas',110],['Parquet','Acuchillado/lijado',38,'m²'],
['Parquet','Barnizado',31,'m²'],['Parquet','Retirada de pavimento',17,'m²'],
['Reformas integrales','Reforma integral de baño',0],['Reformas integrales','Reforma integral de cocina',0]
]
const app=document.querySelector('#app')
if (!isConfigured) {
  const demoServices = services
  const saved = () => { try { return JSON.parse(localStorage.getItem('reparado-demo-requests') || '[]') } catch { return [] } }
  const persist = items => localStorage.setItem('reparado-demo-requests', JSON.stringify(items))
  app.innerHTML = `<div class="shell"><header><div class="logo">🛠️</div><div><b>Reparado</b><small>Servicios de reparación</small></div><span class="demo-tag">Vista de demostración</span></header><main id="main"></main><footer>© AMS · Empresa propietaria del software</footer></div>`
  const main = app.querySelector('#main')
  const iconFor = c => c==='Fontanería'?'🚰':c==='Albañilería'?'🧱':c==='Parquet'?'🪵':'🏠'
  function home(){ main.innerHTML = `<section class="hero"><h1>Reparado, a tu servicio 👋</h1><p>Solicita una reparación de forma sencilla.</p></section><section class="grid">${demoServices.map((s,i)=>`<article class="card service"><div class="ico">${iconFor(s[0])}</div><div><small>${s[0]}</small><h3>${s[1]}</h3><b>${s[2]?s[2].toFixed(2)+' €'+(s[3]?' / '+s[3]:''):'Por presupuesto'}</b><span>${s[2]?'IVA incluido':'Presupuesto'}</span></div><button data-service="${i}">Solicitar</button></article>`).join('')}</section><nav class="bottom"><button id="requests">📋 Mis solicitudes</button><button id="agenda">📅 Agenda</button></nav>`; main.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>form(demoServices[+b.dataset.service])); main.querySelector('#requests').onclick=requests; main.querySelector('#agenda').onclick=()=>requests(true) }
  function form(s){ main.innerHTML=`<section class="card"><button class="back" id="back">← Volver</button><h2>Solicitar: ${s[1]}</h2><p>Precio orientativo: <b>${s[2]?s[2].toFixed(2)+' €'+(s[3]?' / '+s[3]:''):'Por presupuesto'}</b></p><form id="demoForm"><input name="street" placeholder="Calle" required><input name="address" placeholder="Número / piso / puerta" required><div class="row"><input name="zip" placeholder="Código postal" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" required><input name="city" value="Barcelona" placeholder="Municipio" required></div><input name="phone" type="tel" placeholder="Teléfono" required><input name="date" type="date"><textarea name="description" maxlength="2000" placeholder="Describe el trabajo" required></textarea><button>Guardar solicitud de prueba</button></form><p class="notice">Modo demostración: los datos se guardan en este navegador, no se envían a un técnico.</p></section>`; main.querySelector('#back').onclick=home; main.querySelector('#demoForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);const items=saved();items.unshift({service:s[1],category:s[0],price:s[2],street:f.get('street'),address:f.get('address'),zip:f.get('zip'),city:f.get('city'),phone:f.get('phone'),date:f.get('date'),description:f.get('description'),status:'Pendiente'});persist(items);main.innerHTML='<section class="card"><h2>Solicitud guardada</h2><p>Se ha guardado en este navegador en modo demostración.</p><button id="home">Volver al inicio</button></section>';main.querySelector('#home').onclick=home} }
  const demoEsc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function requests(agenda=false){const items=saved();main.innerHTML=`<section class="card"><button class="back" id="back">← Volver</button><h2>${agenda?'Agenda':'Mis solicitudes'}</h2>${items.length?items.map(x=>`<article class="request"><b>${demoEsc(x.service)}</b><span>${demoEsc(x.status)}</span><p>${demoEsc(x.street)}, ${demoEsc(x.address)} · ${demoEsc(x.city)}</p><small>${demoEsc(x.date)||'Sin fecha seleccionada'}</small></article>`).join(''):'<p>No tienes solicitudes guardadas.</p>'}</section>`;main.querySelector('#back').onclick=home} home()
 } else {
  import('./connected.js').then(({ mountConnected }) => {
    mountConnected({ app, services, supabase })
  }).catch(error => {
    console.error('Reparado: no se pudo iniciar modo conectado', error)
    app.innerHTML = '<div class="shell"><section class="card"><h1>Reparado</h1><p>No se ha podido iniciar la aplicación. Comprueba la conexión y recarga la página.</p><button onclick="location.reload()">Reintentar</button></section></div>'
  })
}
