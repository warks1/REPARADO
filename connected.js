import { renderInvoices } from './invoices.js'
import { renderNotifications } from './notifications.js'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

export function mountConnected({app, services, supabase}) {
  const money = value => value===null || value===undefined ? 'Por presupuesto' : `${Number(value).toFixed(2)} €`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
  const iconFor = name => ({'Fontanería':'🚰','Albañilería':'🧱','Parquet':'🪵','Reformas integrales':'🏠'})[name] || '🛠️';
  const statusLabels = {new:'Nueva', quoted:'Presupuesto',accepted:'Aceptada',scheduled:'Programada',in_progress:'En curso',completed:'Terminada',cancelled:'Cancelada'};
  const validStatus = Object.keys(statusLabels);
  let session=null, profile=null, pushReady=false, currentView='home', adminFilter='all';
  app.innerHTML = `<div class="shell"><header><div class="logo">🛠️</div><div><b>Reparado</b><small>Servicios de reparación</small></div><button id="logout" class="ghost hidden">Cerrar sesión</button></header><main id="main"></main><footer>© AMS · Empresa propietaria del software</footer></div>`;
  const main=app.querySelector('#main');
  const message = (text, error=false) => {
    const node=main.querySelector('[data-feedback]');
    if(node){node.textContent=text;node.className=error?'feedback error':'feedback'}
  };
  const backButton = `<button type="button" class="back" data-back>← Volver</button>`;
  const safeTime = raw => raw ? new Date(raw).toLocaleString('es-ES') : 'Sin fecha';
  const userIsStaff = () => profile && ['admin','operator'].includes(profile.role);
  app.addEventListener('click', event => {
    if(event.target.closest('[data-back]')){renderHome();return}
    const s=event.target.closest('[data-service]');
    if(s){requestForm(services[Number(s.dataset.service)]);return}
    const menu=event.target.closest('[data-view]');
    if(menu){
      const view=menu.dataset.view;
      if(view==='requests')loadRequests();
      else if(view==='agenda')loadAgenda();
      else if(view==='chat')loadChat();
      else if(view==='profile')loadProfile();
      else if(view==='notifications')loadNotifications();
      else if(view==='admin')renderAdmin();
      else renderHome();
    }
  });
  app.querySelector('#logout').addEventListener('click', async () => {
    const {error}=await supabase.auth.signOut();
    if(error){message(error.message,true);return}
    session=null;profile=null;showLogin();
  });
  function showLogin(){
    currentView='login';session=null;profile=null;
    app.querySelector('#logout').classList.add('hidden');
    main.innerHTML=`<section class="auth card"><div class="heroicon">🛠️</div><h1>Reparado</h1><p>Accede a tus servicios de reparación.</p><form id="login"><input name="email" type="email" autocomplete="email" placeholder="Correo electrónico" required><input name="password" type="password" autocomplete="current-password" placeholder="Contraseña" required><button>Entrar</button></form><button id="register" class="link" type="button">Crear una cuenta</button><form id="register-form" class="hidden"><label>Nombre y apellidos<input name="full_name" autocomplete="name" maxlength="100" required></label><label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label><label>Contraseña<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Repetir contraseña<input name="password_confirm" type="password" autocomplete="new-password" minlength="8" required></label><button type="submit">Crear cuenta de cliente</button></form><p data-feedback class="feedback" role="status"></p></section>`;
    main.querySelector('#login').addEventListener('submit',async event=>{
      event.preventDefault();
      const data=new FormData(event.currentTarget);
      const {error}=await supabase.auth.signInWithPassword({email:String(data.get('email')).trim(),password:String(data.get('password'))});
      if(error){message(error.message,true);return}
      await boot();
    });
    main.querySelector('#register').addEventListener('click',()=>{
      const registerForm=main.querySelector('#register-form');
      const creating=registerForm.classList.contains('hidden');
      registerForm.classList.toggle('hidden',!creating);
      main.querySelector('#login').classList.toggle('hidden',creating);
      main.querySelector('#register').textContent=creating?'Ya tengo cuenta':'Crear una cuenta';
      message('');
    });
    main.querySelector('#register-form').addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const fields=new FormData(form);
      const email=String(fields.get('email')||'').trim();
      const password=String(fields.get('password')||'');
      if(password!==fields.get('password_confirm'))return message('Las contraseñas no coinciden.',true);
      if(password.length<8)return message('La contraseña debe tener al menos 8 caracteres.',true);
      const submit=form.querySelector('[type=submit]');submit.disabled=true;
      const {error}=await supabase.auth.signUp({
        email,password,options:{data:{full_name:String(fields.get('full_name')||'').trim()}}
      });
      submit.disabled=false;
      message(error?error.message:'Cuenta registrada. Revisa tu correo electrónico si necesitas confirmar el acceso.',Boolean(error));
      if(!error)form.reset();
    });
  }
  async function boot(){
    const {data,error}=await supabase.auth.getSession();
    if(error || !data?.session){showLogin();return}
    session=data.session;
    const result=await supabase.from('profiles').select('id,full_name,phone,role').eq('id',session.user.id).maybeSingle();
    profile=result.data || {role:'customer',full_name:''};
    app.querySelector('#logout').classList.remove('hidden');
    renderHome();
    registerNativePush();
  }
  async function registerNativePush(){
    if(pushReady || !Capacitor.isNativePlatform() || !session)return;
    try {
      const permission=await PushNotifications.requestPermissions();
      if(permission.receive!=='granted')return;
      pushReady=true;
      await PushNotifications.addListener('registration',async({value})=>{
        if(session)await supabase.from('device_tokens').upsert({user_id:session.user.id,token:value,platform:Capacitor.getPlatform()},{onConflict:'token'});
      });
      await PushNotifications.register();
    }catch(error){console.warn('Push nativo no disponible:',error)}
  }
  function renderHome(){
    if(!session){showLogin();return}
    currentView='home';
    const name=profile?.full_name?` ${esc(profile.full_name)}`:'';
    main.innerHTML=`<section class="hero"><h1>Hola${name} 👋</h1><p>¿Qué necesitas reparar?</p><p class="notice">Precios orientativos con 21 % de IVA incluido. Materiales y trabajos especiales sujetos a presupuesto.</p></section>
    <section class="filters card"><label>Buscar reparación<input id="service-search" type="search" placeholder="Ej. grifo, parquet, pladur"></label><label>Tipo de servicio<select id="service-category"><option value="">Todos los servicios</option><option>Fontanería</option><option>Albañilería</option><option>Parquet</option><option>Reformas integrales</option></select></label></section><section class="grid">${services.map((item,i)=>`<article class="card service" data-category="${esc(item[0])}" data-service-name="${esc(item[1])}"><div class="ico">${iconFor(item[0])}</div><div><small>${esc(item[0])}</small><h3>${esc(item[1])}</h3><b>${item[2]?money(item[2])+(item[3]?' / '+item[3]:''):'Por presupuesto'}</b><span>${item[2]?'IVA incluido':'Se valorará con presupuesto'}</span></div><button type="button" data-service="${i}">Solicitar</button></article>`).join('')}</section>
    <nav class="bottom" aria-label="Menú de Reparado"><button data-view="requests">📋 Solicitudes</button><button data-view="chat">💬 Chat</button><button data-view="agenda">📅 Agenda</button><button data-view="profile">👤 Perfil</button><button data-view="notifications">🔔 Avisos</button>${userIsStaff()?'<button data-view="admin">🧰 Gestión</button>':''}</nav>`;
    const search=main.querySelector('#service-search');
    const category=main.querySelector('#service-category');
    const applyFilters=()=>{
      const term=search.value.trim().toLocaleLowerCase('es-ES');
      const selected=category.value;
      for(const card of main.querySelectorAll('.service')){
        const title=card.dataset.serviceName.toLocaleLowerCase('es-ES');
        card.hidden=Boolean((selected && card.dataset.category!==selected) ||
          (term && !title.includes(term) && !card.dataset.category.toLocaleLowerCase('es-ES').includes(term)));
      }
    };
    search.addEventListener('input',applyFilters);
    category.addEventListener('change',applyFilters);
  }
  function requestForm(service){
    if(!service || !session)return renderHome();
    currentView='new-request';
    main.innerHTML=`<section class="card">${backButton}<h2>${esc(service[1])}</h2><p>Precio orientativo: <strong>${service[2]?money(service[2])+(service[3]?' / '+service[3]:''):'Por presupuesto'}</strong> ${service[2]?'(IVA incluido)':''}</p>
      <form id="new-request">
      <label>Calle<input name="street" required maxlength="120" autocomplete="street-address"></label>
      <label>Número, piso y puerta<input name="address_number" required maxlength="80"></label>
      <div class="row"><label>Código postal<input name="postal_code" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" required></label><label>Municipio<input name="city" value="Barcelona" required maxlength="90"></label></div>
      <label>Teléfono<input name="phone" type="tel" required maxlength="25"></label>
      <label>Fecha preferida<input name="preferred_date" type="date"></label>
      <label>Descripción<textarea name="description" required maxlength="2000"></textarea></label>
      <label>Fotografías opcionales (hasta 4, máximo 8 MB cada una)<input name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple></label>
      <button type="submit">Enviar solicitud</button></form><p class="notice">Las fotos requieren que el almacenamiento privado de Supabase esté configurado. Si fallan, tu solicitud seguirá registrada y te avisaremos en pantalla.</p>
      <p data-feedback class="feedback" role="status"></p></section>`;
    const form=main.querySelector('#new-request');
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=form.querySelector('[type=submit]');
      button.disabled=true;
      const fields=new FormData(form);
      const images=[...(form.elements.photos.files||[])];
      if(images.length>4 || images.some(f=>f.size>8388608 || !['image/jpeg','image/png','image/webp','image/heic'].includes(f.type))){
        message('Selecciona hasta 4 imágenes JPG, PNG, WEBP o HEIC de 8 MB como máximo.',true);button.disabled=false;return;
      }
      const payload={
        customer_id:session.user.id,service_name:service[1],category:service[0],
        street:String(fields.get('street')).trim(),
        address_number:String(fields.get('address_number')).trim(),postal_code:String(fields.get('postal_code')).trim(),
        city:String(fields.get('city')).trim(),phone:String(fields.get('phone')).trim(),
        preferred_date:fields.get('preferred_date')||null,description:String(fields.get('description')).trim()
      };
      const {data,error}=await supabase.from('service_requests').insert(payload).select('id').single();
      if(error){message('No se pudo guardar la solicitud: '+error.message,true);button.disabled=false;return}
      let failures=0;
      for(const file of images){
        const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic'})[file.type];
        const path=`${session.user.id}/${data.id}/${crypto.randomUUID()}.${ext}`;
        const uploaded=await supabase.storage.from('request-photos').upload(path,file,{contentType:file.type,upsert:false});
        if(uploaded.error)failures++;
      }
      form.remove();
      message(failures?`Solicitud registrada, pero ${failures} foto(s) no se pudieron subir. Comunícalo por el chat.`:'Solicitud enviada correctamente. Puedes seguirla desde Mis solicitudes.',Boolean(failures));
    });
  }
  async function loadRequests(){
    currentView='requests';main.innerHTML=`<section class="card">${backButton}<h2>Mis solicitudes</h2><p>Cargando…</p></section>`;
    const {data,error}=await supabase.from('service_requests').select('id,service_name,status,price,street,address_number,city,preferred_date,scheduled_at,operator_name').eq('customer_id',session.user.id).order('created_at',{ascending:false});
    if(currentView!=='requests')return;
    if(error){main.innerHTML=`<section class="card">${backButton}<h2>Mis solicitudes</h2><p>${esc(error.message)}</p></section>`;return}
    main.innerHTML=`<section class="card">${backButton}<h2>Mis solicitudes</h2>${data?.length?data.map(r=>`<article class="request"><strong>${esc(r.service_name)}</strong><span>${esc(statusLabels[r.status]||r.status)}</span><p>${esc(r.street)}, ${esc(r.address_number)} · ${esc(r.city)}</p>${r.price!=null?`<p>Importe confirmado: <b>${money(r.price)}</b> (IVA incluido)</p>`:''}<small>${r.scheduled_at?'Visita: '+esc(safeTime(r.scheduled_at)):'Fecha preferida: '+esc(r.preferred_date||'No indicada')}</small>${r.status==="quoted" && r.price!==null ? `<div class="flex-actions"><button type="button" data-accept-quote="${esc(r.id)}">Aceptar presupuesto de ${money(r.price)}</button></div>` : ""}</article>`).join(''):'<p>Todavía no tienes solicitudes.</p>'}</section>`;
    main.querySelectorAll('[data-accept-quote]').forEach(button=>button.addEventListener('click',async()=>{
      button.disabled=true;
      const {data:accepted,error}=await supabase.rpc('accept_reparado_quote',{p_request_id:button.dataset.acceptQuote});
      if(error){message('No se pudo aceptar el presupuesto: '+error.message,true);button.disabled=false;return}
      if(!accepted){message('Este presupuesto ya no está disponible. Actualiza la solicitud.',true);button.disabled=false;return}
      await loadRequests();
      message('Presupuesto aceptado. Reparado podrá programar la visita.');
    }));
  }
  async function loadAgenda(){
    currentView='agenda';main.innerHTML=`<section class="card">${backButton}<h2>Mi agenda</h2><p>Cargando…</p></section>`;
    const {data,error}=await supabase.from('service_requests').select('service_name,scheduled_at,status').eq('customer_id',session.user.id).in('status',['scheduled','in_progress']).order('scheduled_at');
    if(currentView!=='agenda')return;
    main.innerHTML=`<section class="card">${backButton}<h2>Mi agenda</h2>${error?`<p>${esc(error.message)}</p>`:data?.length?data.map(r=>`<article class="request"><b>${esc(r.service_name)}</b><p>${esc(safeTime(r.scheduled_at))}</p><small>${esc(statusLabels[r.status])}</small></article>`).join(''):'<p>No hay visitas programadas.</p>'}</section>`;
  }
  async function loadChat(){
    currentView='chat';main.innerHTML=`<section class="card">${backButton}<h2>Chat con Reparado</h2><p>Cargando…</p></section>`;
    const {data,error}=await supabase.from('messages').select('sender_id,body,created_at').eq('customer_id',session.user.id).order('created_at');
    if(currentView!=='chat')return;
    main.innerHTML=`<section class="card">${backButton}<h2>Chat con Reparado</h2>${error?`<p>${esc(error.message)}</p>`:`<div id="messages">${(data||[]).map(r=>`<p class="${r.sender_id===session.user.id?'me':''}">${esc(r.body)}</p>`).join('')||'<p>Sin mensajes todavía.</p>'}</div><form id="chat-form"><label>Mensaje<input name="body" maxlength="2000" required placeholder="Escribe aquí…"></label><button type="submit">Enviar</button></form><p data-feedback role="status"></p>`}</section>`;
    const form=main.querySelector('#chat-form');
    if(form)form.addEventListener('submit',async e=>{
      e.preventDefault();
      const body=String(new FormData(form).get('body')||'').trim();
      if(!body)return;
      const {error}=await supabase.from('messages').insert({customer_id:session.user.id,sender_id:session.user.id,body});
      if(error){message(error.message,true);return}
      await loadChat();
    });
  }
  async function loadNotifications(){
    currentView='notifications';
    await renderNotifications({main,supabase,session,backButton,onRefresh:()=>currentView==='notifications'});
  }
  async function loadInvoices(){
    currentView='invoices';
    await renderInvoices({main,supabase,session,onRefresh:()=>currentView==='invoices'});
  }
  function loadProfile(){
    currentView='profile';
    main.innerHTML=`<section class="card">${backButton}<h2>Mi perfil</h2><p>${esc(session.user.email)}</p><p>Tipo de cuenta: ${esc(profile?.role||'customer')}</p>
      <form id="profile-form"><label>Nombre completo<input name="full_name" autocomplete="name" maxlength="100" value="${esc(profile?.full_name||'')}"></label><label>Teléfono<input name="phone" type="tel" autocomplete="tel" maxlength="25" value="${esc(profile?.phone||'')}"></label><button type="submit">Guardar perfil</button></form><div class="flex-actions"><button type="button" id="view-invoices">🧾 Mis facturas</button></div>
      <p data-feedback class="feedback" role="status"></p></section>`;
    main.querySelector('#view-invoices').addEventListener('click',loadInvoices);
    main.querySelector('#profile-form').addEventListener('submit',async event=>{
      event.preventDefault();
      const fields=new FormData(event.currentTarget);
      const full_name=String(fields.get('full_name')||'').trim();
      const phone=String(fields.get('phone')||'').trim();
      if(full_name.length>100 || phone.length>25)return message('Los datos son demasiado largos.',true);
      const {error}=await supabase.from('profiles').update({full_name,phone}).eq('id',session.user.id);
      if(error){message('No se pudo guardar: '+error.message,true);return;}
      profile={...profile,full_name,phone};message('Perfil actualizado.');
    });
  }

  async function loadStaffChat(customerId, serviceName){
    if(!userIsStaff() || !session)return renderHome();
    currentView='staff-chat';
    const box=document.createElement('section');
    box.className='card';
    const back=document.createElement('button');
    back.className='back';back.type='button';back.textContent='← Panel interno';
    back.addEventListener('click',()=>renderAdmin());
    const heading=document.createElement('h2');
    heading.textContent='Chat: '+serviceName;
    const history=document.createElement('div');
    history.id='messages';
    history.textContent='Cargando mensajes…';
    box.append(back,heading,history);
    main.replaceChildren(box);
    const result=await supabase.from('messages').select('sender_id,body,created_at')
      .eq('customer_id',customerId).order('created_at',{ascending:true}).limit(300);
    if(currentView!=='staff-chat')return;
    history.replaceChildren();
    if(result.error){
      history.textContent='No se pudieron cargar los mensajes: '+result.error.message;
      return;
    }
    for(const row of result.data||[]){
      const p=document.createElement('p');
      p.className=row.sender_id===session.user.id?'me':'';
      p.textContent=row.body;
      history.append(p);
    }
    if(!history.childNodes.length)history.textContent='No hay mensajes todavía.';
    history.scrollTop=history.scrollHeight;
    const form=document.createElement('form');
    const label=document.createElement('label');
    label.textContent='Responder al cliente';
    const input=document.createElement('input');
    input.name='body';input.required=true;input.maxLength=2000;
    input.placeholder='Escribe tu mensaje…';
    label.append(input);
    const send=document.createElement('button');
    send.type='submit';send.textContent='Enviar respuesta';
    const feedback=document.createElement('p');
    feedback.setAttribute('role','status');
    form.append(label,send,feedback);
    box.append(form);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const body=input.value.trim();
      if(!body || !session)return;
      send.disabled=true;
      const {error}=await supabase.from('messages').insert({
        customer_id:customerId,sender_id:session.user.id,body
      });
      if(error){feedback.textContent='No se pudo enviar: '+error.message;send.disabled=false;return}
      await loadStaffChat(customerId,serviceName);
    });
  }

  async function renderAdmin(filter=adminFilter){
    if(!userIsStaff()){renderHome();return}
    currentView='admin';adminFilter=filter;
    main.innerHTML=`<section class="card">${backButton}<h2>Panel interno</h2><p>Cargando solicitudes…</p></section>`;
    const admin=profile?.role==='admin';
    const baseJobs=supabase.from('service_requests')
      .select('id,customer_id,service_name,street,address_number,city,phone,description,status,scheduled_at,operator_id,operator_name,price')
      .order('created_at',{ascending:false}).limit(150);
    const [jobs,team]=await Promise.all([
      admin ? baseJobs : baseJobs.eq('operator_id',session.user.id),
      admin ? supabase.from('profiles').select('id,full_name,role').eq('role','operator') : Promise.resolve({data:[],error:null})
    ]);
    if(currentView!=='admin')return;
    if(jobs.error){main.innerHTML=`<section class="card">${backButton}<h2>Panel interno</h2><p>${esc(jobs.error.message)}</p></section>`;return}
    const all=jobs.data||[], operators=team.data||[];
    const chosen=filter==='agenda'?all.filter(j=>['scheduled','in_progress'].includes(j.status)):all;
    const statuses=validStatus.map(x=>({id:x,label:statusLabels[x]}));
    main.innerHTML=`<section class="card">${backButton}<h2>Panel interno · Reparado</h2><p class="notice">${admin?'Panel de administración':'Solicitudes asignadas a tu cuenta'}. Máximo 150 recientes.</p>
    <div class="flex-actions"><button type="button" data-admin-filter="all">Todas (${all.length})</button><button type="button" data-admin-filter="agenda">Agenda (${all.filter(j=>['scheduled','in_progress'].includes(j.status)).length})</button></div>
    <p data-feedback class="feedback" role="status"></p></section>
    ${chosen.map(job=>`<article class="card job-card"><h3>${esc(job.service_name)}</h3><p>${esc(job.street)} ${esc(job.address_number)}, ${esc(job.city)}</p><p>Tel.: ${esc(job.phone)} · ${money(job.price)}</p><p class="notice">${esc(job.description)}</p>
      <a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(`${job.street} ${job.address_number}, ${job.city}`)}">📍 Abrir Google Maps</a>
      <form data-job-id="${esc(job.id)}">
        <label>Estado<select name="status">${statuses.map(s=>`<option value="${s.id}" ${job.status===s.id?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label>
        <label>Precio confirmado (€ IVA incluido)<input type="number" name="price" min="0" max="999999" step="0.01" value="${job.price==null?'':esc(job.price)}" placeholder="Pendiente de presupuesto"></label><label>Operario<select name="operator_id"><option value="">Sin asignar</option>${operators.map(op=>`<option value="${esc(op.id)}" ${job.operator_id===op.id?'selected':''}>${esc(op.full_name||'Operario')}</option>`).join('')}</select></label>
        <label>Fecha y hora<input type="datetime-local" name="scheduled_at" value="${job.scheduled_at?new Date(job.scheduled_at).toLocaleString('sv-SE').replace(' ','T').slice(0,16):''}"></label>
        <div class="flex-actions"><button type="submit">Guardar cambios</button><button type="button" data-photos="${esc(job.id)}" data-owner="${esc(job.customer_id)}">Ver fotos</button><button type="button" data-staff-chat="${esc(job.customer_id)}" data-chat-service="${esc(job.service_name)}">💬 Chat</button></div>
      </form><div class="photo-links" data-photo-output="${esc(job.id)}"></div>
    </article>`).join('')||'<section class="card"><p>No hay solicitudes en esta vista.</p></section>'}`;
    main.querySelectorAll('[data-admin-filter]').forEach(btn=>btn.addEventListener('click',()=>renderAdmin(btn.dataset.adminFilter)));
    if(!admin){
      main.querySelectorAll('form[data-job-id]').forEach(form=>{
        const job=all.find(j=>j.id===form.dataset.jobId);
        if(!job)return;
        for(const field of ['price','operator_id','scheduled_at']){
          form.querySelector('[name="'+field+'"]')?.closest('label')?.remove();
        }
        form.querySelectorAll('select[name="status"] option').forEach(opt=>{
          if(opt.value!==job.status &&
             !(job.status==='scheduled' && opt.value==='in_progress') &&
             !(job.status==='in_progress' && opt.value==='completed'))opt.remove();
        });
      });
    }
    main.querySelectorAll('form[data-job-id]').forEach(form=>form.addEventListener('submit',async e=>{
      e.preventDefault();
      const fields=new FormData(form);
      const status=String(fields.get('status'));
      if(!admin){
        const original=all.find(j=>j.id===form.dataset.jobId);
        if(!original)return message('Solicitud no encontrada.',true);
        const allowed=status===original.status
          || (original.status==='scheduled' && status==='in_progress')
          || (original.status==='in_progress' && status==='completed');
        if(!allowed)return message('El operario no puede realizar esta transición.',true);
        const {error}=await supabase.from('service_requests').update({status}).eq('id',form.dataset.jobId);
        if(error)message('No se pudo actualizar: '+error.message,true);
        else {await renderAdmin(filter);message('Estado del trabajo actualizado.');}
        return;
      }
      const operator_id=String(fields.get('operator_id'))||null;
      const date=String(fields.get('scheduled_at'));
      const rawPrice=String(fields.get('price')??'').trim();
      const quotedPrice=rawPrice===''?null:Number(rawPrice);
      if(quotedPrice!==null && (!Number.isFinite(quotedPrice) || quotedPrice<0 || quotedPrice>999999))return message('Importe no válido.',true);
      if(!validStatus.includes(status))return message('Estado inválido.',true);
      if(status==='quoted' && quotedPrice===null)return message('Indica el precio del presupuesto antes de enviarlo.',true);
      if(status==='scheduled' && (!operator_id || !date))return message('Para programar, selecciona operario y fecha.',true);
      const operator=operators.find(op=>op.id===operator_id);
      const stamp=date?new Date(date):null;
      if(stamp && Number.isNaN(stamp.getTime()))return message('Fecha no válida.',true);
      const {error}=await supabase.from('service_requests').update({
        status,price:quotedPrice,operator_id,operator_name:operator?.full_name||null,scheduled_at:stamp?stamp.toISOString():null
      }).eq('id',form.dataset.jobId);
      if(error)message('No se han guardado los cambios: '+error.message,true);
      else {await renderAdmin(filter);message('Solicitud actualizada.')}
    }));
    main.querySelectorAll('[data-staff-chat]').forEach(button=>button.addEventListener('click',()=>loadStaffChat(button.dataset.staffChat,button.dataset.chatService)));
    main.querySelectorAll('[data-photos]').forEach(button=>button.addEventListener('click',async()=>{
      const out=main.querySelector(`[data-photo-output="${button.dataset.photos}"]`);
      if(!out)return;
      out.textContent='Buscando fotografías…';
      const folder=`${button.dataset.owner}/${button.dataset.photos}`;
      const {data,error}=await supabase.storage.from('request-photos').list(folder,{limit:50});
      if(error){out.textContent='No se pudieron consultar las fotos: '+error.message;return}
      out.replaceChildren();
      if(!data?.length){out.textContent='Sin fotos disponibles.';return}
      for(const photo of data){
        if(!photo.name || photo.name.startsWith('.'))continue;
        const signed=await supabase.storage.from('request-photos').createSignedUrl(`${folder}/${photo.name}`,120);
        if(signed.error)continue;
        const a=document.createElement('a');a.href=signed.data.signedUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='📷 Ver fotografía';out.append(a);
      }
      if(!out.children.length)out.textContent='No hay fotos accesibles.';
    }));
  }
  supabase.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT'){session=null;profile=null;showLogin()}
    else if(event==='SIGNED_IN')queueMicrotask(()=>boot());
  });
  boot().catch(error=>{console.error(error);main.innerHTML=`<section class="card"><h2>Error al conectar</h2><p>Comprueba la configuración de Supabase y vuelve a cargar.</p></section>`});
}
