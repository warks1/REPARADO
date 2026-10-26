import { mountReviewModeration } from './review-moderation.js';
import { mountReviews } from './reviews.js';
import {appHeader,bottomNavigation,setActiveNav,renderLanding,renderCategory,serviceFormHeader,formPeriodPicker,serviceRow,matchServices,featuredServices,showAllCategories} from './customer-ui.js'
import { operatorMaySetStatus } from './rules.js'
import {jobFilters,filterJobs,jobCounters,vatIncluded,sameOperatorSlot,staffVisitGapMinutes,validateAdminJobUpdate} from './staff-workflows.js'
import {staffProgressMarkup,staffDocument} from './staff-documents.js'
import {calculateQuoteLines} from './quote-calculator.js'
import { renderInvoices } from './invoices.js'
import { renderNotifications } from './notifications.js'
import {publicRegistrationEnabled} from './auth-mode.js'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

export function mountConnected({app, services, supabase, authLinkIntent=null}) {
  const money = value => value===null || value===undefined ? 'Por presupuesto' : `${Number(value).toFixed(2)} €`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
  const iconFor = name => ({'Fontanería':'🚰','Albañilería':'🧱','Parquet':'🪵','Reformas integrales':'🏠'})[name] || '🛠️';
  const statusLabels = {new:'Nueva', quoted:'Presupuesto',accepted:'Aceptada',scheduled:'Programada',in_progress:'En curso',completed:'Terminada',cancelled:'Cancelada'};
  const validStatus = Object.keys(statusLabels);
  let session=null, profile=null, pushReady=false, currentView='home', adminFilter='all', lastCategory=null, pendingService=null, pendingView=null;
  let passwordSetupPending=authLinkIntent==='invite'||authLinkIntent==='recovery';
  app.innerHTML = `<div class="shell">${appHeader()}<main id="main"></main><footer>© Reparado · Servicios para tu hogar <button type="button" id="logout" class="hidden" hidden>Cerrar sesión</button></footer></div>${bottomNavigation()}`;
  const main=app.querySelector('#main');
  const message = (text, error=false) => {
    const node=main.querySelector('[data-feedback]');
    if(node){node.textContent=text;node.className=error?'feedback error':'feedback'}
  };
  const backButton = `<button type="button" class="back" data-back>← Volver</button>`;
  const safeTime = raw => raw ? new Date(raw).toLocaleString('es-ES') : 'Sin fecha';
  const userIsStaff = () => profile && ['admin','operator'].includes(profile.role);
  // UI privada de forma predeterminada. No sustituye cerrar registros en Supabase Auth.
  const openRegistration=publicRegistrationEnabled(import.meta.env?.VITE_REPARADO_ALLOW_PUBLIC_REGISTRATION);
  app.addEventListener('click', event => {
    const expand=event.target.closest('[data-expand-services]');
    if(expand){
      const opened=expand.getAttribute('aria-expanded')==='true';
      main.querySelectorAll('.category-services .service-extra').forEach(btn=>{btn.hidden=opened});
      expand.setAttribute('aria-expanded',String(!opened));
      expand.innerHTML=opened?'Ver todos los servicios →':'Mostrar menos servicios ↑';
      return;
    }
    if(event.target.closest('[data-review-login]')){pendingService=null;pendingView='home';showLogin();return;}
    const filterButton=event.target.closest('[data-toggle-filters]');
    if(filterButton){
      const panel=main.querySelector('#category-quick-filters');
      if(panel){panel.hidden=!panel.hidden;filterButton.setAttribute('aria-expanded',String(!panel.hidden))}
      return;
    }
    if(event.target.closest('[data-back]')){if(currentView==='new-request' && lastCategory)renderCategoryPage(lastCategory);else renderHome();return}
    const categoryButton=event.target.closest('[data-category-open]');
    if(categoryButton){renderCategoryPage(categoryButton.dataset.categoryOpen);return}
    const customButton=event.target.closest('[data-custom-request]');
    if(customButton){lastCategory=customButton.dataset.customRequest;requestForm([lastCategory,'Consulta personalizada',0]);return}
    if(event.target.closest('[data-show-all]')){showAllCategories(main);return}
    if(event.target.closest('[data-logout]')){app.querySelector('#logout').click();return}
    const s=event.target.closest('[data-service]');
    if(s){requestForm(services[Number(s.dataset.service)]);return}
    const menu=event.target.closest('[data-view]');
    if(menu){
      const view=menu.dataset.view;
      if(view==='home'){pendingService=null;pendingView=null;renderHome();return}
      if(!session){pendingService=null;pendingView=view;showLogin();return}
      if(view==='requests')loadRequests();
      else if(view==='agenda')loadAgenda();
      else if(view==='chat')loadChat();
      else if(view==='profile')loadProfile();
      else if(view==='notifications')loadNotifications();
      else if(view==='admin')renderAdmin();
      else if(view==='review-moderation')openReviewModeration();
      else renderHome();
    }
  });
  app.querySelector('#logout').addEventListener('click', async () => {
    const {error}=await supabase.auth.signOut();
    if(error){message(error.message,true);return}
    session=null;profile=null;pendingService=null;pendingView=null;renderHome();
  });
  function showLogin(){
    currentView='login';setActiveNav(app,'profile');session=null;profile=null;
    app.querySelector('#logout').classList.add('hidden');
    const pendingNotice=pendingService?`<p class="auth-pending">Continuar con: <strong>${esc(pendingService[1])}</strong></p>`:'';
    const registerMarkup=openRegistration?`<button id="register" class="link" type="button">Crear una cuenta</button><form id="register-form" class="hidden"><label>Nombre y apellidos<input name="full_name" autocomplete="name" maxlength="100" required></label><label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label><label>Contraseña<input name="password" type="password" autocomplete="new-password" minlength="12" required></label><label>Repetir contraseña<input name="password_confirm" type="password" autocomplete="new-password" minlength="12" required></label><button type="submit">Crear cuenta de cliente</button></form>`
      :'<p class="auth-invite-notice" role="note">Acceso privado: solicita una invitación al equipo de Reparado. Si ya tienes cuenta, inicia sesión.</p>';
    main.innerHTML=`<section class="auth card"><div class="heroicon"><img src="./icon.svg" width="44" height="44" alt=""></div><h1>Reparado</h1><p>Accede a tus servicios de reparación.</p>${pendingNotice}<form id="login"><input name="email" type="email" autocomplete="email" placeholder="Correo electrónico" required><input name="password" type="password" autocomplete="current-password" placeholder="Contraseña" required><button>Entrar</button></form><button id="forgot-password" type="button" class="link">¿Has olvidado tu contraseña?</button><form id="reset-form" class="hidden"><label>Correo de tu cuenta<input name="email" type="email" autocomplete="email" placeholder="Correo electrónico" required></label><button type="submit">Recibir enlace de recuperación</button></form>${registerMarkup}<p data-feedback class="feedback" role="status"></p></section>`;
    main.querySelector('#login').addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const button=form.querySelector('[type=submit]');
      if(button.disabled)return;
      const data=new FormData(form);
      button.disabled=true;
      try{
        const {error}=await supabase.auth.signInWithPassword({
          email:String(data.get('email')).trim(),password:String(data.get('password'))
        });
        // No mostrar la respuesta del servidor: podría revelar detalles de cuentas.
        if(error){message('No se pudo iniciar sesión. Comprueba tus datos o recupera la contraseña.',true);return}
        message('Acceso correcto. Cargando tu solicitud…');
      }catch{
        message('No se pudo conectar. Inténtalo de nuevo más tarde.',true);
      }finally{button.disabled=false}
    });
    main.querySelector('#forgot-password').addEventListener('click',()=>{
      const form=main.querySelector('#reset-form');
      const opened=form.classList.toggle('hidden')===false;
      main.querySelector('#login').classList.toggle('hidden',opened);
      main.querySelector('#forgot-password').textContent=opened?'Volver a entrar':'¿Has olvidado tu contraseña?';
      message('');
    });
    main.querySelector('#reset-form').addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const email=String(new FormData(form).get('email')||'').trim();
      if(!email)return message('Introduce tu correo electrónico.',true);
      const submit=form.querySelector('[type=submit]');submit.disabled=true;
      // Solo el origen/ruta de la propia app. Debe estar permitido en
      // Authentication -> URL Configuration del proyecto de pruebas.
      const redirectTo=window.location.origin+window.location.pathname;
      const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
      submit.disabled=false;
      message(error?'No se pudo enviar el enlace. Prueba de nuevo o contacta con Reparado.':
        'Si la cuenta existe, recibirás un enlace para restablecer tu contraseña.',Boolean(error));
    });
    if(!openRegistration)return;
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
      if(password.length<12)return message('La contraseña debe tener al menos 12 caracteres.',true);
      const submit=form.querySelector('[type=submit]');submit.disabled=true;
      const {error}=await supabase.auth.signUp({
        email,password,options:{data:{full_name:String(fields.get('full_name')||'').trim()}}
      });
      submit.disabled=false;
      message(error?error.message:'Cuenta registrada. Revisa tu correo electrónico si necesitas confirmar el acceso.',Boolean(error));
      if(!error)form.reset();
    });
  }
  function showPasswordSetup(){
    if(!session){showLogin();return}
    currentView='password-setup';
    setActiveNav(app,'profile');
    const invited=authLinkIntent==='invite';
    main.innerHTML=`<section class="auth card"><h2>${invited?'Completar invitación':'Restablecer contraseña'}</h2><p>Establece una contraseña nueva para entrar en REPARADO desde cualquier dispositivo.</p><form id="password-setup-form"><label>Nueva contraseña<input name="password" type="password" autocomplete="new-password" minlength="12" required></label><label>Repetir contraseña<input name="confirm" type="password" autocomplete="new-password" minlength="12" required></label><button type="submit">Guardar contraseña</button></form><button type="button" class="link" id="password-setup-logout">Cerrar sesión</button><p data-feedback class="feedback" role="status"></p></section>`;
    main.querySelector('#password-setup-logout').addEventListener('click',async()=>{
      const {error}=await supabase.auth.signOut();
      if(error)message('No se pudo cerrar sesión: '+error.message,true);
    });
    main.querySelector('#password-setup-form').addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const data=new FormData(form);
      const password=String(data.get('password')||'');
      if(password.length<12)return message('Usa al menos 12 caracteres.',true);
      if(password!==data.get('confirm'))return message('Las contraseñas no coinciden.',true);
      const submit=form.querySelector('[type=submit]');submit.disabled=true;
      const {error}=await supabase.auth.updateUser({password});
      submit.disabled=false;
      if(error)return message('No se pudo guardar la contraseña: '+error.message,true);
      passwordSetupPending=false;
      authLinkIntent=null;
      // Nunca añadir contraseñas o tokens a enlaces, registros o mensajes.
      await boot();
    });
  }
  async function boot(){
    const {data,error}=await supabase.auth.getSession();
    if(error || !data?.session){session=null;profile=null;renderHome();return}
    session=data.session;
    if(passwordSetupPending){showPasswordSetup();return}
    const result=await supabase.from('profiles').select('id,full_name,phone,role').eq('id',session.user.id).maybeSingle();
    profile=result.data || {role:'customer',full_name:''};
    app.querySelector('#logout').classList.add('hidden');
    const avatar=app.querySelector('.round-profile');
    if(avatar && profile?.full_name)avatar.textContent=profile.full_name.trim().slice(0,1).toUpperCase();
    const selected=pendingService;
    const destination=pendingView;
    pendingService=null;pendingView=null;
    if(selected)requestForm(selected);
    else if(destination==='requests')loadRequests();
    else if(destination==='agenda')loadAgenda();
    else if(destination==='chat')loadChat();
    else if(destination==='profile')loadProfile();
    else renderHome();
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
  function renderHome(selectedReviewRequestId=null){
    currentView='home';lastCategory=null;setActiveNav(app,'home');
    main.innerHTML=renderLanding(services);
    mountReviews(main,{supabase,session,selectedRequestId:selectedReviewRequestId}); // Solo servicios finalizados.
    if(selectedReviewRequestId){
      const panel=main.querySelector('#reparado-reviews');
      panel?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    }
    const search=main.querySelector('#category-search');
    search?.addEventListener('input',()=>{
      const term=search.value.trim().toLocaleLowerCase('es-ES');
      const matches=matchServices(services,term);
      main.querySelector('.popular-list').innerHTML=(!term?featuredServices(services):matches)
        .map(({s,i})=>serviceRow(s,i)).join('');
      let visible=0;
      main.querySelectorAll('.category-tile').forEach(tile=>{
        const id=tile.dataset.categoryOpen;
        const hasMatch=matches.some(({s})=>s[0]===id);
        tile.hidden=!hasMatch;if(hasMatch)visible++;
      });
      main.querySelector('.no-results').hidden=Boolean(visible || matches.length);
    });
  }
  function renderCategoryPage(id){
    lastCategory=id;currentView='category';setActiveNav(app,'home');
    main.innerHTML=renderCategory(services,id);
  }
  function requestForm(service){
    if(!service)return renderHome();
    if(!session){pendingService=service;pendingView=null;showLogin();return}
    currentView='new-request';setActiveNav(app,'requests');
    main.innerHTML='<div class="request-screen"><button type="button" class="screen-back" data-back>← Volver</button>'+
      '<section class="card"><h2>Nueva solicitud</h2>'+serviceFormHeader(service)+
      '<form id="new-request">'+
      '<label>Dirección del servicio<input name="street" placeholder="Calle o avenida" required maxlength="120" autocomplete="street-address"></label>'+
      '<label>Número, piso y puerta<input name="address_number" required maxlength="80"></label>'+
      '<div class="row"><label>Código postal<input name="postal_code" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" required></label>'+
      '<label>Municipio<input name="city" value="Barcelona" maxlength="90" required></label></div>'+
      '<label>Teléfono de contacto<input name="phone" type="tel" maxlength="25" required value="'+esc(profile?.phone||'')+'"></label>'+
      '<label>Descripción del problema<textarea name="description" maxlength="1800" placeholder="Explícanos lo que necesitas reparar..." required></textarea></label>'+
      '<label>Fotos (opcional, máximo 4)<input name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple></label>'+
      '<div class="photo-preview" aria-live="polite"></div>'+
      '<label>Fecha preferida<input name="preferred_date" type="date"></label>'+formPeriodPicker()+
      '<button type="submit">Enviar solicitud →</button></form>'+
      '<p class="notice">Precio orientativo, IVA incluido cuando se indica. Los trabajos especiales se valoran mediante presupuesto.</p>'+
      '<p data-feedback class="feedback" role="status"></p></section></div>';
    const photos=main.querySelector('[name="photos"]');
    let photoUrls=[];
    photos.addEventListener('change',()=>{
      photoUrls.forEach(URL.revokeObjectURL);photoUrls=[];
      const wrap=main.querySelector('.photo-preview');wrap.replaceChildren();
      for(const file of Array.from(photos.files||[]).slice(0,4)){
        const url=URL.createObjectURL(file);photoUrls.push(url);
        const img=document.createElement('img');img.src=url;img.alt='Foto seleccionada';wrap.append(img);
      }
    });
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
        preferred_date:fields.get('preferred_date')||null,description:String(fields.get('description')).trim()+'\nHorario preferido: '+String(fields.get('preferred_period')||'Indiferente')
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
      main.querySelector('.request-screen .card').insertAdjacentHTML('beforeend','<div class="request-confirm"><h2>Solicitud recibida</h2><p>Hemos registrado tu solicitud. Puedes consultar su estado en Mis solicitudes.</p><button type="button" class="primary-cta" data-view="requests">Ver mis solicitudes →</button></div>');
      message(failures?`La solicitud se registró, pero ${failures} foto(s) no se pudieron subir.`:'Solicitud enviada correctamente.',Boolean(failures));
    });
  }
  async function loadRequests(){
    setActiveNav(app,'requests');
    currentView='requests';main.innerHTML=`<section class="card">${backButton}<h2>Mis solicitudes</h2><p>Cargando…</p></section>`;
    const {data,error}=await supabase.from('service_requests').select('id,service_name,status,price,street,address_number,city,preferred_date,scheduled_at,operator_name').eq('customer_id',session.user.id).order('created_at',{ascending:false});
    if(currentView!=='requests')return;
    if(error){main.innerHTML=`<section class="card">${backButton}<h2>Mis solicitudes</h2><p>${esc(error.message)}</p></section>`;return}
    main.innerHTML=`<section class="card">${backButton}<h2>Mis solicitudes</h2><p data-feedback class="feedback" role="status"></p>${data?.length?data.map(r=>`<article class="request"><strong>${esc(r.service_name)}</strong><span>${esc(statusLabels[r.status]||r.status)}</span><p>${esc(r.street)}, ${esc(r.address_number)} · ${esc(r.city)}</p>${staffProgressMarkup(r.status)}${r.price!=null?`<p>Importe confirmado: <b>${money(r.price)}</b> (IVA incluido)</p>`:''}<small>${r.scheduled_at?'Visita: '+esc(safeTime(r.scheduled_at)):'Fecha preferida: '+esc(r.preferred_date||'No indicada')}</small><div class="flex-actions"><button type="button" data-customer-photos="${esc(r.id)}">📷 Mis fotos</button></div>${r.status==="completed"?`<div class="flex-actions"><button type="button" class="customer-review-action" data-rate-request="${esc(r.id)}" aria-label="Valorar ${esc(r.service_name)}">⭐ Valorar este trabajo</button></div>`:""}<div class="photo-links" data-customer-photo-output="${esc(r.id)}"></div>${r.status==="quoted" && r.price!==null ? `<div class="flex-actions"><p class="quote-acceptance-summary">Presupuesto: ${money(r.price)} IVA incluido (21 %). Base: ${money(vatIncluded(r.price).base)} · IVA: ${money(vatIncluded(r.price).vat)}. Revisa el importe antes de aceptarlo.</p><button type="button" data-accept-quote="${esc(r.id)}" data-accept-total="${esc(r.price)}">Aceptar presupuesto de ${money(r.price)}</button></div>` : ""}</article>`).join(''):'<p>Todavía no tienes solicitudes.</p>'}</section>`;
    main.querySelectorAll('[data-rate-request]').forEach(button=>button.addEventListener('click',()=>{
      const requestId=button.dataset.rateRequest;
      if(data.some(row=>row.id===requestId && row.status==='completed'))renderHome(requestId);
    }));
    main.querySelectorAll('[data-customer-photos]').forEach(button=>button.addEventListener('click',async()=>{
      const requestId=button.dataset.customerPhotos;
      const out=main.querySelector('[data-customer-photo-output="'+requestId+'"]');
      if(!out)return;
      button.disabled=true;out.textContent='Cargando imágenes…';
      const folder=session.user.id+'/'+requestId;
      const {data,error}=await supabase.storage.from('request-photos').list(folder,{limit:30});
      out.replaceChildren();button.disabled=false;
      if(error){out.textContent='No se pudieron obtener las fotos: '+error.message;return}
      if(!data?.length){out.textContent='No hay fotografías adjuntas.';return}
      for(const photo of data){
        if(!photo.name || photo.name.startsWith('.'))continue;
        const {data:signed,error:signError}=await supabase.storage.from('request-photos').createSignedUrl(folder+'/'+photo.name,120);
        if(signError || !signed?.signedUrl)continue;
        const link=document.createElement('a');link.href=signed.signedUrl;link.target='_blank';
        link.rel='noopener noreferrer';link.textContent='📷 Abrir fotografía';out.append(link);
      }
      if(!out.children.length)out.textContent='No hay fotos disponibles.';
    }));
    main.querySelectorAll('[data-accept-quote]').forEach(button=>button.addEventListener('click',async()=>{
      const total=Number(button.dataset.acceptTotal);
      const valid=vatIncluded(total);
      if(!valid){message('No se pudo verificar el importe. Actualiza la solicitud.',true);return;}
      const confirmed=window.confirm('¿Confirmas que aceptas el presupuesto de '+money(valid.total)+
        ' (IVA del 21 % incluido) para esta reparación? Esta acción se registrará en Reparado.');
      if(!confirmed)return;
      button.disabled=true;
      const {data:accepted,error}=await supabase.rpc('accept_reparado_quote',{p_request_id:button.dataset.acceptQuote});
      if(error){message('No se pudo aceptar el presupuesto: '+error.message,true);button.disabled=false;return}
      if(!accepted){message('Este presupuesto ya no está disponible. Actualiza la solicitud.',true);button.disabled=false;return}
      await loadRequests();
      message('Presupuesto aceptado. Reparado podrá programar la visita.');
    }));
  }
  async function loadAgenda(){
    setActiveNav(app,'agenda');
    currentView='agenda';main.innerHTML=`<section class="card">${backButton}<h2>Mi agenda</h2><p>Cargando…</p></section>`;
    const {data,error}=await supabase.from('service_requests').select('service_name,scheduled_at,status,operator_name').eq('customer_id',session.user.id).in('status',['scheduled','in_progress']).order('scheduled_at');
    if(currentView!=='agenda')return;
    main.innerHTML=`<section class="card">${backButton}<h2>Mi agenda</h2>${error?`<p>${esc(error.message)}</p>`:data?.length?data.map(r=>`<article class="request"><b>${esc(r.service_name)}</b><p>${esc(safeTime(r.scheduled_at))}</p><small>${esc(statusLabels[r.status])} · Operario: ${esc(r.operator_name||'Por asignar')}</small></article>`).join(''):'<p>No hay visitas programadas.</p>'}</section>`;
  }
  async function loadChat(){
    setActiveNav(app,'chat');
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
    setActiveNav(app,'profile');
    currentView='notifications';
    await renderNotifications({main,supabase,session,backButton,onRefresh:()=>currentView==='notifications',isStaff:userIsStaff()});
  }
  async function loadInvoices(){
    setActiveNav(app,'profile');
    currentView='invoices';
    await renderInvoices({main,supabase,session,onRefresh:()=>currentView==='invoices'});
  }
  function loadProfile(){
    setActiveNav(app,'profile');
    if(!session){showLogin();return}
    currentView='profile';
    main.innerHTML=`<section class="card">${backButton}<h2>Mi perfil</h2><p>${esc(session.user.email)}</p><p>Tipo de cuenta: ${esc(profile?.role||'customer')}</p>
      <form id="profile-form"><label>Nombre completo<input name="full_name" autocomplete="name" maxlength="100" value="${esc(profile?.full_name||'')}"></label><label>Teléfono<input name="phone" type="tel" autocomplete="tel" maxlength="25" value="${esc(profile?.phone||'')}"></label><button type="submit">Guardar perfil</button></form><div class="flex-actions"><button type="button" data-logout>Cerrar sesión</button><button type="button" id="view-invoices">🧾 Mis facturas</button>${userIsStaff()?'<button type="button" data-view="admin">🧰 Gestión interna</button>':''}${profile?.role==='admin'?'<button type="button" data-view="review-moderation">⭐ Moderar reseñas</button>':''}</div>
      <section class="account-deletion">
        <h3>Privacidad de la cuenta</h3>
        <p>Puedes solicitar la eliminación de tu cuenta y de tus datos personales, salvo aquellos que debamos conservar por obligación legal.</p>
        <button type="button" id="request-account-deletion">Solicitar eliminación de mi cuenta</button>
        <p id="account-deletion-status" role="status" aria-live="polite"></p>
      </section>
      <p data-feedback class="feedback" role="status"></p></section>`;
    main.querySelector('#view-invoices').addEventListener('click',loadInvoices);
    const deletionButton=main.querySelector('#request-account-deletion');
    const deletionStatus=main.querySelector('#account-deletion-status');
    const renderDeletionStatus=async()=>{
      if(!session)return;
      const expected=session.user.id;
      const {data,error}=await supabase.from('account_deletion_requests')
        .select('id,status,requested_at').eq('user_id',expected).maybeSingle();
      if(!deletionStatus.isConnected || !session || session.user.id!==expected)return;
      if(error){
        deletionStatus.textContent='No se puede consultar el estado de eliminación en este momento.';
      }else if(data){
        deletionButton.disabled=true;
        deletionStatus.textContent='Solicitud registrada. Estado: '+(
          data.status==='in_review'?'En revisión':data.status==='completed'?'Completada':'Recibida'
        )+'.';
      }
    };
    deletionButton.addEventListener('click',async()=>{
      if(!session || deletionButton.disabled)return;
      if(!window.confirm('¿Solicitar la eliminación de tu cuenta y tus datos personales? Algunos documentos fiscales deben conservarse por ley. La tramitación no es inmediata.'))return;
      const userId=session.user.id;
      deletionButton.disabled=true;
      deletionStatus.textContent='Registrando tu solicitud…';
      try{
        const {error}=await supabase.from('account_deletion_requests').insert({user_id:userId});
        if(error && error.code!=='23505')throw error;
        deletionStatus.textContent='Solicitud recibida. El equipo revisará la eliminación y te comunicará su finalización.';
      }catch{
        deletionButton.disabled=false;
        deletionStatus.textContent='No se pudo registrar la solicitud. Inténtalo de nuevo.';
      }
    });
    renderDeletionStatus().catch(()=>{
      if(deletionStatus.isConnected)deletionStatus.textContent='No se puede consultar el estado en este momento.';
    });
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

  async function openReviewModeration(){
    if(!session || profile?.role!=='admin'){
      if(!session)showLogin();
      else renderHome();
      return;
    }
    currentView='review-moderation';
    setActiveNav(app,'profile');
    await mountReviewModeration({
      main,supabase,
      isActive:()=>currentView==='review-moderation' && Boolean(session) && profile?.role==='admin',
      onBack:()=>renderAdmin(adminFilter)
    });
  }

  async function renderAdmin(filter=adminFilter){
    setActiveNav(app,'profile');
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
    if(admin && team.error){
      main.innerHTML=`<section class="card">${backButton}<h2>Panel interno</h2><p>No se pudo consultar el personal. No se permiten asignaciones hasta recuperar la lista de operarios.</p><p>${esc(team.error.message)}</p><button type="button" data-reload-staff>Reintentar</button></section>`;
      main.querySelector('[data-reload-staff]')?.addEventListener('click',()=>renderAdmin(filter));
      return;
    }
    const all=jobs.data||[], operators=team.data||[];
    const counts=jobCounters(all);
    const chosen=filterJobs(all,filter);
    const statuses=validStatus.map(x=>({id:x,label:statusLabels[x]}));
    main.innerHTML=`<section class="card">${backButton}<h2>Panel interno · Reparado</h2><p class="notice">${admin?'Panel de administración':'Solicitudes asignadas a tu cuenta'}. Máximo 150 recientes.</p>
    <div class="staff-summary">
      <div><strong>${counts.all}</strong><small>Trabajos recientes</small></div>
      <div><strong>${counts.pending}</strong><small>Pendientes</small></div>
      <div><strong>${counts.agenda}</strong><small>Programados / en curso</small></div>
      <div><strong>${counts.unassigned}</strong><small>Sin operario</small></div>
    </div>
    <div class="staff-filters" role="group" aria-label="Filtrar trabajos">${jobFilters.filter(f=>admin||f.id!=='unassigned').map(f=>`<button type="button" data-admin-filter="${f.id}" aria-pressed="${filter===f.id}">${esc(f.label)} (${counts[f.id]})</button>`).join('')}</div>
    ${admin?'<button type="button" class="review-moderation-entry" data-view="review-moderation">⭐ Revisar reseñas de clientes</button>':''}
    <p class="notice">Los precios indicados incluyen el 21 % de IVA. Este panel no emite facturas fiscales.</p>
    ${admin?'<p class="notice">Agenda: se aplica un margen preventivo de '+staffVisitGapMinutes+' minutos entre comienzos de visita para cada operario. Confirma la duración real del servicio y el desplazamiento antes de programar.</p>':''}
    <p data-feedback class="feedback" role="status"></p></section>
    ${chosen.map(job=>`<article class="card job-card"><div class="staff-job-title"><h3>${esc(job.service_name)}</h3><span class="staff-status">${esc(statusLabels[job.status]||job.status)}</span></div><p>${esc(job.street)} ${esc(job.address_number)}, ${esc(job.city)}</p><p>Tel.: ${esc(job.phone)} · ${money(job.price)}</p><p class="notice">Operario: ${esc(job.operator_name||'Sin asignar')} · Visita: ${esc(safeTime(job.scheduled_at))}</p><p class="notice">${esc(job.description)}</p>${staffProgressMarkup(job.status)}
      <a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(`${job.street} ${job.address_number}, ${job.city}`)}">📍 Abrir Google Maps</a>
      <form data-job-id="${esc(job.id)}">
        <label>Estado<select name="status">${statuses.map(s=>`<option value="${s.id}" ${job.status===s.id?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label>
        <label>Precio confirmado (€ IVA incluido)<input type="number" name="price" min="0" max="999999" step="0.01" value="${job.price==null?'':esc(job.price)}" placeholder="Pendiente de presupuesto"></label><p class="staff-vat" data-vat-preview>${job.price==null?'Indica un importe para ver base e IVA.':(()=>{const breakdown=vatIncluded(job.price);return breakdown?'Base '+money(breakdown.base)+' · IVA 21 % '+money(breakdown.vat):'Precio no válido';})()}</p>
        ${admin?'<button type="button" class="quote-toggle" data-quote-toggle aria-expanded="false">Desglosar presupuesto</button><div class="quote-builder" hidden><p class="notice">Calculadora interna. Las partidas no se envían ni se guardan en Supabase. Utiliza «Aplicar total» y después «Guardar cambios» para guardar únicamente el precio total.</p><div data-quote-lines></div><div class="quote-actions"><button type="button" data-quote-add>Añadir partida</button><button type="button" data-quote-apply>Aplicar total al formulario</button></div><p data-quote-summary role="status">Añade una partida para calcular el presupuesto.</p></div>':''}
        <label>Operario<select name="operator_id"><option value="">Sin asignar</option>${operators.map(op=>`<option value="${esc(op.id)}" ${job.operator_id===op.id?'selected':''}>${esc(op.full_name||'Operario')}</option>`).join('')}</select></label>
        <label>Fecha y hora<input type="datetime-local" name="scheduled_at" value="${job.scheduled_at?new Date(job.scheduled_at).toLocaleString('sv-SE').replace(' ','T').slice(0,16):''}"></label>
        <div class="flex-actions"><button type="submit">Guardar cambios</button><button type="button" data-photos="${esc(job.id)}" data-owner="${esc(job.customer_id)}">Ver fotos</button><button type="button" data-staff-chat="${esc(job.customer_id)}" data-chat-service="${esc(job.service_name)}">💬 Chat</button></div>
      </form><div class="staff-documents-toolbar">
        <button type="button" data-doc-kind="order" data-doc-job="${esc(job.id)}">Orden de trabajo</button>
        ${admin?'<button type="button" data-doc-kind="quote" data-doc-job="'+esc(job.id)+'">Vista de presupuesto</button>':''}
      </div><div class="staff-document-host" data-document-host="${esc(job.id)}"></div>
      <div class="photo-links" data-photo-output="${esc(job.id)}"></div>
    </article>`).join('')||'<section class="card"><p>No hay solicitudes en esta vista.</p></section>'}`;
    main.querySelectorAll('[data-admin-filter]').forEach(btn=>btn.addEventListener('click',()=>renderAdmin(btn.dataset.adminFilter)));
    if(!admin){
      main.querySelectorAll('form[data-job-id]').forEach(form=>{
        const job=all.find(j=>j.id===form.dataset.jobId);
        if(!job)return;
        for(const field of ['price','operator_id','scheduled_at']){
          form.querySelector('[name="'+field+'"]')?.closest('label')?.remove();
        }
        form.querySelector('[data-vat-preview]')?.remove();
        form.querySelectorAll('select[name="status"] option').forEach(opt=>{
          if(!operatorMaySetStatus(job.status,opt.value))opt.remove();
        });
      });
    }
    if(admin){
      main.querySelectorAll('form[data-job-id]').forEach(form=>{
        const price=form.querySelector('[name="price"]'), preview=form.querySelector('[data-vat-preview]');
        const builder=form.querySelector('.quote-builder'), toggle=form.querySelector('[data-quote-toggle]');
        const lines=builder?.querySelector('[data-quote-lines]'), result=builder?.querySelector('[data-quote-summary]');
        const readLines=()=>[...lines.querySelectorAll('.quote-line')].map(row=>({
          name:row.querySelector('[data-quote-name]').value,
          quantity:row.querySelector('[data-quote-qty]').value,
          unitPrice:row.querySelector('[data-quote-unit]').value
        }));
        const calculate=()=>{
          try {
            const q=calculateQuoteLines(readLines());
            result.textContent='Base '+money(q.base)+' · IVA incluido (21 %) '+money(q.vat)+' · TOTAL '+money(q.total)+
              (Math.round(Number(price.value)*100)===Math.round(q.total*100)?' · Coincide con el formulario':' · Pendiente de aplicar al formulario');
            return q;
          } catch(err){result.textContent=err.message;return null;}
        };
        const addLine=(name='',quantity='1',unitPrice='')=>{
          if(lines.children.length>=12){result.textContent='Máximo 12 partidas por presupuesto.';return}
          const div=document.createElement('div');
          div.className='quote-line';
          div.innerHTML='<label>Concepto<input type="text" data-quote-name maxlength="120" value="'+esc(name)+'" placeholder="Mano de obra, materiales…"></label>'+
            '<label>Cantidad<input type="number" data-quote-qty step="0.01" min="0.01" max="9999" value="'+esc(quantity)+'"></label>'+
            '<label>Precio unitario IVA incluido<input type="number" data-quote-unit step="0.01" min="0" max="999999" value="'+esc(unitPrice)+'"></label>'+
            '<button type="button" data-quote-remove aria-label="Eliminar partida">Quitar</button>';
          lines.append(div);
          calculate();
        };
        form.__quotePreview=()=>builder&&!builder.hidden?readLines():null;
        toggle?.addEventListener('click',()=>{
          builder.hidden=!builder.hidden;
          toggle.setAttribute('aria-expanded',String(!builder.hidden));
          if(!builder.hidden&&!lines.children.length)addLine('Mano de obra','1',price.value);
        });
        builder?.addEventListener('click',e=>{
          if(e.target.closest('[data-quote-add]'))return addLine();
          if(e.target.closest('[data-quote-remove]')){
            e.target.closest('.quote-line')?.remove();
            calculate();return;
          }
          if(e.target.closest('[data-quote-apply]')){
            const q=calculate();
            if(!q)return;
            price.value=q.total.toFixed(2);
            price.dispatchEvent(new Event('input',{bubbles:true}));
            result.textContent='Total '+money(q.total)+' aplicado al formulario. Pulsa «Guardar cambios» para guardarlo en la solicitud.';
          }
        });
        builder?.addEventListener('input',calculate);
        price?.addEventListener('input',()=>{
          const parts=vatIncluded(price.value);
          preview.textContent=parts?'Base '+money(parts.base)+' · IVA 21 % '+money(parts.vat)+' · Total '+money(parts.total):'Sin importe confirmado';
          if(builder&&!builder.hidden)calculate();
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
        const allowed=operatorMaySetStatus(original.status,status);
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
      const itemLines=form.__quotePreview?.();
      if(itemLines!==null&&itemLines!==undefined){
        let quote;
        try {quote=calculateQuoteLines(itemLines)}
        catch(err){return message('Revisa el desglose: '+err.message,true)}
        if(quotedPrice===null||Math.round(quotedPrice*100)!==Math.round(quote.total*100))
          return message('El total no coincide con las partidas. Pulsa «Aplicar total al formulario» antes de guardar.',true);
      }
      const stamp=date?new Date(date):null;
      if(stamp&&!Number.isFinite(stamp.getTime()))return message('Fecha y hora no válidas.',true);
      const validation=validateAdminJobUpdate({status,operatorId:operator_id,scheduledAt:stamp?stamp.toISOString():null,price:quotedPrice});
      if(validation)return message(validation,true);
      if(operator_id&&!operators.some(op=>op.id===operator_id))return message('Operario no encontrado en el personal autorizado.',true);
      if(['scheduled','in_progress'].includes(status)&&stamp){
        // Refrescar el horario del operario desde Supabase. La lista del
        // panel se limita a 150 solicitudes y podría estar desactualizada.
        const gap=staffVisitGapMinutes*60000;
        const start=new Date(stamp.getTime()-gap).toISOString();
        const end=new Date(stamp.getTime()+gap).toISOString();
        const appointments=await supabase.from('service_requests')
          .select('id,operator_id,scheduled_at,status')
          .eq('operator_id',operator_id)
          .in('status',['scheduled','in_progress'])
          .gte('scheduled_at',start)
          .lt('scheduled_at',end);
        if(appointments.error)
          return message('No se pudo comprobar la agenda del operario. No se ha guardado la programación: '+appointments.error.message,true);
        const existing=sameOperatorSlot(appointments.data,{
          requestId:form.dataset.jobId,operatorId:operator_id,scheduledAt:stamp.toISOString()
        });
        if(existing.length)
          return message('El operario ya tiene una visita a menos de '+staffVisitGapMinutes+' minutos. Selecciona otra hora u otro operario.',true);
      }
      const operator=operators.find(op=>op.id===operator_id);
      const {error}=await supabase.from('service_requests').update({
        status,price:quotedPrice,operator_id,operator_name:operator?.full_name||null,scheduled_at:stamp?stamp.toISOString():null
      }).eq('id',form.dataset.jobId);
      if(error){
        // Postgres V7: error transaccional, incluso con dos administradores
        // guardando en paralelo. No anunciar cambios cuando el servidor falla.
        if(error.code==='23P01'||error.message?.includes('REPARADO_SCHEDULE_CONFLICT'))
          return message('No se ha programado: otro administrador acaba de reservar una visita de ese operario a menos de 60 minutos. Actualiza el panel y elige otra hora.',true);
        if(error.message?.includes('REPARADO_SCHEDULE_OPERATOR_REQUIRED')||
           error.message?.includes('REPARADO_SCHEDULE_INVALID_OPERATOR'))
          return message('No se ha guardado: revisa el operario y la fecha de la visita.',true);
        return message('No se han guardado los cambios: '+error.message,true);
      }
      await renderAdmin(filter);
      message('Solicitud actualizada.');
    }));
    // Los documentos se generan solo a partir de los trabajos consultados con
    // los permisos actuales. No se envían, firman ni insertan en facturación.
    main.querySelectorAll('[data-doc-kind]').forEach(button=>button.addEventListener('click',()=>{
      if(currentView!=='admin'||!userIsStaff())return;
      const job=all.find(x=>String(x.id)===button.dataset.docJob);
      const host=button.closest('.job-card')?.querySelector('[data-document-host]');
      if(!job||!host)return;
      const kind=button.dataset.docKind;
      if(kind==='quote'&&!admin)return;
      try {
        const form=host.closest('.job-card')?.querySelector('form[data-job-id]');
        const typedPrice=form?.querySelector('[name="price"]')?.value;
        const price=kind==='quote'?typedPrice:job.price;
        const items=kind==='quote'?form?.__quotePreview?.():null;
        const html=staffDocument(job,{kind,price,items});
        main.querySelectorAll('[data-document-host]').forEach(other=>{if(other!==host)other.replaceChildren()});
        host.innerHTML='<div class="staff-documents-toolbar"><button type="button" data-print-staff>Imprimir / guardar PDF</button><button type="button" data-close-staff-document>Cerrar</button></div>'+html;
        host.querySelector('[data-print-staff]').addEventListener('click',()=>{
          if(typeof window.print==='function')window.print();
          else message('Este navegador no permite imprimir.',true);
        });
        host.querySelector('[data-close-staff-document]').addEventListener('click',()=>host.replaceChildren());
      }catch(error){
        message(error.message||'No se pudo preparar el documento.',true);
      }
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
    if(event==='SIGNED_OUT'){
      session=null;profile=null;passwordSetupPending=false;
      pendingService=null;pendingView=null;renderHome();
    }else if(event==='PASSWORD_RECOVERY'){
      passwordSetupPending=true;
      queueMicrotask(()=>boot());
    }else if(event==='SIGNED_IN')queueMicrotask(()=>boot());
  });
  // Mostrar la portada inmediatamente, incluso si la sesión tarda o no hay red.
  renderHome();
  boot().catch(error=>{
    console.error('Reparado: error de sesión',error);
    renderHome();
    const note=document.createElement('p');
    note.className='notice';
    note.textContent='No se pudo conectar con el servicio. Puedes consultar el catálogo y volver a intentarlo más tarde.';
    main.prepend(note);
  });
}
