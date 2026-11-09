import {supportHistoryMarkup} from './support-ticket-ui.js';
import {fetchSupportHistoryPage,supportHistoryPageSize,supportHistoryPageCount,supportHistoryCanAdvance} from './customer-support-page.js';
import {submitSupportIssue,supportIssueFailureMessage} from './support-submission.js';
import {readOwnDeletionStatus,submitOwnDeletionRequest,ownDeletionLabel} from './account-deletion.js';
import {createPushSessionManager} from './push-session.js';
import {validateRequestPhotos} from './request-photos.js';
import {uploadPhotosWithRecovery} from './photo-retry.js';
import {submitRepairRequest} from './request-submission.js';
import {contactLinksMarkup} from './contact-emails.js';
import {manitasPricingNotice,manitasMaterialQuestionMarkup,manitasMaterialRequestNote} from './catalog-data.js';
import { mountReviewModeration } from './review-moderation.js';
import { mountReviews } from './reviews.js';
import {appHeader,bottomNavigation,setActiveNav,renderLanding,renderCategory,serviceFormHeader,formPeriodPicker,serviceRow,matchServices,featuredServices,showAllCategories} from './customer-ui.js'
import {unitQuantityMarkup,bindUnitQuantity,unitQuantityDescription} from './unit-pricing.js'
import {serviceAreaIssue,serviceAreaNoticeMarkup} from './service-area.js'
import {preferredDateField,preferredDateMinimum,preferredDateIssue} from './date-preference.js'
import {madridDateTimeInput,madridDateTimeText,madridVisitDateTimeToIso} from './staff-timezone.js'
import { operatorMaySetStatus } from './rules.js'
import {jobFilters,filterJobs,vatIncluded,sameOperatorSlot,staffVisitGapMinutes,validateAdminJobUpdate} from './staff-workflows.js'
import {fetchNewRequestsCount,fetchNewRequestsPage,newRequestsPageCount,canAdvanceNewRequests} from './staff-inbox.js'
import {fetchUnassignedRequestsCount,fetchUnassignedRequestsPage} from './staff-unassigned.js'
import {fetchStaffWorkPage,fetchStaffWorkCounts,staffWorkPageCount,staffWorkCanAdvance,staffWorkSearchTerm,staffWorkSearchFields} from './staff-work-pages.js'
import {fetchStaffSupportPage,staffSupportPageSize,staffSupportPageCount,staffSupportCanAdvance} from './staff-support-page.js'
import {fetchCustomerChatPage,customerChatPageSize,customerChatPageCount,customerChatCanReadOlder} from './customer-chat-page.js'
import {fetchCustomerRequestsPage,customerRequestsPageSize,customerRequestsPageCount,customerRequestsCanAdvance} from './customer-requests-page.js'
import {staffProgressMarkup,staffDocument} from './staff-documents.js'
import {shareAcceptedQuote} from './mobile-quote-share.js'
import {shareVisitCalendar} from './mobile-calendar-share.js'
import {checkRealBackendConnection} from './admin-connection-diagnostics.js'
import {buildPersonalDataExport} from './customer-data-export.js'
import {sharePrivateDataExport} from './mobile-private-export.js'
import {calculateQuoteLines} from './quote-calculator.js'
import {billingDraftFormMarkup,billingDraftDocument} from './billing-draft.js'
import {savePrivateBillingDraft,readPrivateBillingDraft} from './billing-draft-storage.js'
import { renderInvoices } from './invoices.js'
import { renderNotifications } from './notifications.js'
import {mountOwnerDashboard} from './owner-dashboard.js'
import {mountOwnerWorkExport} from './owner-export-view.js'
import {mountOwnerCalendar} from './owner-calendar.js'
import {mountOwnerMessages,ownerMailMarkup} from './owner-messages.js'
import {mountOwnerPeople} from './owner-people.js'
import {publicRegistrationEnabled} from './auth-mode.js'
import {validateNewPassword} from './password-policy.js'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

export function mountConnected({app, services, supabase, authLinkIntent=null}) {
  const money = value => value===null || value===undefined ? 'Por presupuesto' : `${Number(value).toFixed(2)} €`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
  const iconFor = name => ({'Fontanería':'🚰','Albañilería':'🧱','Parquet':'🪵','Reformas integrales':'🏠','Electricidad':'⚡'})[name] || '🛠️';
  const statusLabels = {new:'Nueva', quoted:'Presupuesto',accepted:'Aceptada',scheduled:'Programada',in_progress:'En curso',completed:'Terminada',cancelled:'Cancelada'};
  const validStatus = Object.keys(statusLabels);
  let session=null, profile=null, currentView='home', adminFilter='all', newRequestsPage=0, unassignedRequestsPage=0, staffWorkPage=0, staffWorkLastUser=null, staffSearchTerm='', staffSearchField='service_name', lastCategory=null, pendingService=null, pendingView=null;
  let customerRequestsPage=0;
  let customerChatPage=0;
  let passwordSetupPending=authLinkIntent==='invite'||authLinkIntent==='recovery';
  // Cada lectura asíncrona queda asociada a la sesión y a su pantalla original.
  let authEpoch=0;
  const isCurrentUser=(userId)=>Boolean(userId && session?.user?.id===userId);
  const pushManager=createPushSessionManager({
    supabase,Capacitor,PushNotifications,
    onError:()=>console.warn('REPARADO: registro seguro de notificaciones no disponible')
  });
  app.innerHTML = `<div class="shell">${appHeader()}<main id="main"></main><footer>© Reparado · Servicios para tu hogar ${contactLinksMarkup()} <button type="button" id="logout" class="hidden" hidden>Cerrar sesión</button></footer></div>${bottomNavigation()}`;
  // El acceso al propietario no se incluye en la navegación del cliente.
  // Se habilita únicamente después de verificar el perfil en Supabase.
  const ownerEntry=document.createElement('button');
  ownerEntry.type='button';
  ownerEntry.className='owner-header-launch';
  ownerEntry.dataset.view='owner';
  ownerEntry.textContent='⚙ Panel propietario';
  ownerEntry.hidden=true;
  app.querySelector('.header-actions')?.insertBefore(
    ownerEntry,app.querySelector('.round-profile')
  );
  const syncOwnerAccess=()=>{
    const allowed=Boolean(session&&profile?.role==='admin');
    ownerEntry.hidden=!allowed;
    app.querySelector('.customer-header')?.classList.toggle('owner-active',allowed);
  };
  const main=app.querySelector('#main');
  const message = (text, error=false) => {
    const node=main.querySelector('[data-feedback]');
    if(node){node.textContent=text;node.className=error?'feedback error':'feedback'}
  };
  const backButton = `<button type="button" class="back" data-back>← Volver</button>`;
  const safeTime = madridDateTimeText;
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
      if(view==='requests'){customerRequestsPage=0;loadRequests();}
      else if(view==='agenda')loadAgenda();
      else if(view==='chat'){customerChatPage=0;loadChat();}
      else if(view==='profile')loadProfile();
      else if(view==='notifications')loadNotifications();
      else if(view==='invoices')loadInvoices();
      else if(view==='admin')renderAdmin();
      else if(view==='owner')showOwnerDashboard();
      else if(view==='owner-calendar')showOwnerCalendar();
      else if(view==='owner-messages')showOwnerMessages();
      else if(view==='owner-customers')showOwnerPeople('customer');
      else if(view==='owner-operators')showOwnerPeople('operator');
      else if(view==='owner-mail')showOwnerMail();
      else if(view==='owner-export')showOwnerWorkExport();
      else if(view==='review-moderation')openReviewModeration();
      else if(view==='support-admin')loadSupportReports();
      else renderHome();
    }
  });
  let signOutPending=false;
  async function safeSignOut(){
    // Un doble toque no debe iniciar dos revocaciones ni dos salidas concurrentes.
    if(signOutPending)return false;
    signOutPending=true;
    const oldId=session?.user?.id;
    try{
      if(oldId && !await pushManager.deactivate(oldId)){
        message('No se pudo desconectar de forma segura este móvil. Comprueba la conexión e inténtalo otra vez.',true);
        return false;
      }
      // Supabase usa global por defecto: cerrar solo este dispositivo.
      const {error}=await supabase.auth.signOut({scope:'local'});
      if(error)throw error;
      session=null;profile=null;pendingService=null;pendingView=null;customerRequestsPage=0;customerChatPage=0;
      syncOwnerAccess();renderHome();
      return true;
    }catch{
      // Si Auth falla, recuperar el registro push del usuario original.
      if(oldId)void pushManager.activate(oldId);
      message('No se pudo cerrar la sesión. Vuelve a intentarlo.',true);
      return false;
    }finally{
      signOutPending=false;
    }
  }
  app.querySelector('#logout').addEventListener('click',safeSignOut);
  function showLogin(){
    currentView='login';setActiveNav(app,'profile');session=null;profile=null;syncOwnerAccess();
    app.querySelector('#logout').classList.add('hidden');
    const pendingNotice=pendingService?`<p class="auth-pending">Continuar con: <strong>${esc(pendingService[1])}</strong></p>`:'';
    const registerMarkup=openRegistration?`<button id="register" class="link" type="button">Crear una cuenta</button><form id="register-form" class="hidden"><label>Nombre y apellidos<input name="full_name" autocomplete="name" maxlength="100" required></label><label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label><label>Contraseña<input name="password" type="password" autocomplete="new-password" minlength="15" maxlength="128" required></label><label>Repetir contraseña<input name="password_confirm" type="password" autocomplete="new-password" minlength="15" maxlength="128" required></label><p class="auth-password-hint">Usa una frase única de 15 caracteres o más. Puedes incluir espacios y usar un gestor de contraseñas.</p><button type="submit">Crear cuenta de cliente</button></form>`
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
      const submit=form.querySelector('[type=submit]');
      if(submit.disabled)return;
      submit.disabled=true;
      try{
        // Solo el origen/ruta de la propia app, sin tokens ni parámetros.
        // Configurar URL permitida en Authentication -> URL Configuration.
        const redirectTo=window.location.origin+window.location.pathname;
        const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
        message(error?'No se pudo solicitar el enlace. Inténtalo más tarde o contacta con Reparado.':
          'Si la cuenta existe, recibirás un enlace para restablecer tu contraseña.',Boolean(error));
      }catch{
        message('No se pudo conectar para solicitar el enlace. Inténtalo de nuevo.',true);
      }finally{submit.disabled=false}
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
      const passwordError=validateNewPassword(password);
      if(passwordError)return message(passwordError,true);
      const submit=form.querySelector('[type=submit]');
      if(submit.disabled)return;
      submit.disabled=true;
      try{
        const {error}=await supabase.auth.signUp({
          email,password,options:{data:{full_name:String(fields.get('full_name')||'').trim()}}
        });
        // No mostrar mensajes del proveedor que podrían distinguir cuentas existentes.
        message(error?'No se pudo procesar el registro. Inténtalo más tarde o contacta con Reparado.':
          'Solicitud procesada. Revisa tu correo electrónico para continuar si procede.',Boolean(error));
        if(!error)form.reset();
      }catch{
        message('No se pudo conectar para registrar la cuenta. Inténtalo de nuevo.',true);
      }finally{submit.disabled=false}
    });
  }
  function showPasswordSetup(){
    if(!session){showLogin();return}
    currentView='password-setup';
    setActiveNav(app,'profile');
    const invited=authLinkIntent==='invite';
    main.innerHTML=`<section class="auth card"><h2>${invited?'Completar invitación':'Restablecer contraseña'}</h2><p>Establece una contraseña nueva para entrar en REPARADO desde cualquier dispositivo.</p><form id="password-setup-form"><label>Nueva contraseña<input name="password" type="password" autocomplete="new-password" minlength="15" maxlength="128" required></label><label>Repetir contraseña<input name="confirm" type="password" autocomplete="new-password" minlength="15" maxlength="128" required></label><p class="auth-password-hint">Usa una frase única de 15 caracteres o más. No es obligatorio mezclar números o símbolos.</p><button type="submit">Guardar contraseña</button></form><button type="button" class="link" id="password-setup-logout">Cerrar sesión</button><p data-feedback class="feedback" role="status"></p></section>`;
    main.querySelector('#password-setup-logout').addEventListener('click',safeSignOut);
    main.querySelector('#password-setup-form').addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget;
      const data=new FormData(form);
      const password=String(data.get('password')||'');
      const passwordError=validateNewPassword(password);
      if(passwordError)return message(passwordError,true);
      if(password!==data.get('confirm'))return message('Las contraseñas no coinciden.',true);
      const submit=form.querySelector('[type=submit]');
      if(submit.disabled)return;
      submit.disabled=true;
      try{
        const {error}=await supabase.auth.updateUser({password});
        if(error){
          message('No se pudo cambiar la contraseña. Revisa los requisitos e inténtalo de nuevo.',true);
          return;
        }
        passwordSetupPending=false;
        authLinkIntent=null;
        // Nunca añadir contraseñas o tokens a enlaces, registros o mensajes.
        await boot();
      }catch{
        message('No se pudo completar el cambio de contraseña. Inténtalo de nuevo.',true);
      }finally{submit.disabled=false}
    });
  }
  async function boot(){
    const epoch=++authEpoch;
    const {data,error}=await supabase.auth.getSession();
    if(epoch!==authEpoch)return;
    if(error || !data?.session){session=null;profile=null;syncOwnerAccess();customerChatPage=0;renderHome();return}
    const userId=data.session.user.id;
    if(session?.user?.id!==userId)customerChatPage=0;
    session=data.session;
    if(passwordSetupPending){showPasswordSetup();return}
    const result=await supabase.from('profiles').select('id,full_name,phone,role').eq('id',userId).maybeSingle();
    if(epoch!==authEpoch || !isCurrentUser(userId))return;
    if(result.error){
      profile=null;syncOwnerAccess();renderHome();
      const note=document.createElement('p');
      note.className='notice';
      note.textContent='No se pudo cargar tu perfil. Comprueba la conexión antes de utilizar las funciones privadas.';
      main.prepend(note);
      return;
    }
    profile=result.data || {role:'customer',full_name:''};
    syncOwnerAccess();
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
    else if(destination==='owner'&&profile?.role==='admin')showOwnerDashboard();
    else if(profile?.role==='admin'&&!destination)showOwnerDashboard();
    else renderHome();
    registerNativePush();
  }
  function registerNativePush(){
    if(!session)return;
    void pushManager.activate(session.user.id);
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
      '<label>Municipio<input name="city" placeholder="Ej. Barcelona, Girona..." maxlength="90" required></label></div>'+serviceAreaNoticeMarkup()+
      '<label>Teléfono de contacto<input name="phone" type="tel" maxlength="25" required value="'+esc(profile?.phone||'')+'"></label>'+
      '<label>Descripción del problema<textarea name="description" maxlength="1800" placeholder="Explícanos lo que necesitas reparar..." required></textarea></label>'+unitQuantityMarkup(service)+
      (service[0]==='Manitas'?manitasMaterialQuestionMarkup:'')+
      '<label>Fotos (opcional, máximo 4)<input name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple></label>'+
      '<div class="photo-preview" aria-live="polite"></div>'+
      preferredDateField()+formPeriodPicker()+
      '<button type="submit">Enviar solicitud →</button></form>'+
      '<p class="notice">'+(service[0]==='Manitas'?esc(manitasPricingNotice):'Precio orientativo «desde»: incluye material estándar indicado, mano de obra e IVA del 21 %. Extras y supuestos no estándar se confirman por presupuesto.')+'</p>'+
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
    const readUnitQuote=bindUnitQuantity(form,service);
    const submissionId=crypto.randomUUID();
    let firstAttemptPayload=null;
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const button=form.querySelector('[type=submit]');
      if(button.disabled)return;
      button.disabled=true;
      let recorded=false;
      const uploadEpoch=authEpoch;
      try{
        preferredDateMinimum(form.elements.preferred_date);
        const fields=new FormData(form);
        const preferredError=preferredDateIssue(fields.get('preferred_date'));
        if(preferredError){message(preferredError,true);return;}
        const areaError=serviceAreaIssue(fields.get('postal_code'),fields.get('city'));
        if(areaError){message(areaError,true);return;}
        const images=[...(form.elements.photos.files||[])];
        const photoError=images.length?validateRequestPhotos(images):null;
        if(photoError){message(photoError,true);return;}
        const areaQuote=readUnitQuote();
        if(['invalid','unavailable'].includes(areaQuote?.status)){
          message('La cantidad indicada no es válida. Corrígela o deja el campo vacío.',true);
          return;
        }
        const payload={
          customer_id:session.user.id,service_name:service[1],category:service[0],
          street:String(fields.get('street')).trim(),
          address_number:String(fields.get('address_number')).trim(),postal_code:String(fields.get('postal_code')).trim(),
          city:String(fields.get('city')).trim(),phone:String(fields.get('phone')).trim(),
          preferred_date:fields.get('preferred_date')||null,
          description:String(fields.get('description')).trim()+unitQuantityDescription(areaQuote)+manitasMaterialRequestNote(service,fields.get('manitas_material'))+'\nHorario preferido: '+String(fields.get('preferred_period')||'Indiferente')
        };
        // Si la conexión se corta, repetir la misma operación, no crear otra.
        // Impedir que un usuario cambie el formulario y reutilice una clave
        // de un envío previo que pudiera haberse registrado.
        const payloadText=JSON.stringify(payload);
        if(firstAttemptPayload!==null&&firstAttemptPayload!==payloadText){
          message('Has cambiado los datos después de un intento. Revisa Mis solicitudes antes de crear otra.',true);
          return;
        }
        firstAttemptPayload=payloadText;
        const created=await submitRepairRequest({supabase,payload,submissionId});
        if(created.error){
          // Solo un rechazo inequívoco del servidor permite editar y reintentar
          // con la misma clave. En caídas de red se conserva el intento anterior
          // para no producir solicitudes duplicadas.
          if(created.rejected)firstAttemptPayload=null;
          message(created.error,true);
          return;
        }
        recorded=true;
        if(!isCurrentUser(payload.customer_id)||main.querySelector('#new-request')!==form)return;
        const photosResult=images.length
          ?await uploadPhotosWithRecovery({
            supabase,userId:payload.customer_id,requestId:created.id,files:images,
            isSessionCurrent:id=>isCurrentUser(id)&&authEpoch===uploadEpoch&&
              main.querySelector('#new-request')===form
          })
          :{uploaded:0,recovered:0,alreadyPresent:0,failed:0,error:null};
        const failures=photosResult.failed;
        photoUrls.forEach(URL.revokeObjectURL);
        photoUrls=[];
        // Una respuesta de A no debe reescribir la pantalla de B.
        if(!isCurrentUser(payload.customer_id)||main.querySelector('#new-request')!==form)return;
        form.remove();
        main.querySelector('.request-screen .card').insertAdjacentHTML('beforeend',
          '<div class="request-confirm"><h2>Solicitud recibida</h2><p>Hemos registrado tu solicitud. Puedes consultar su estado en Mis solicitudes.</p><button type="button" class="primary-cta" data-view="requests">Ver mis solicitudes →</button></div>');
        message(photosResult.error?
          'La solicitud se ha registrado. No se pudieron comprobar las fotografías; entra en Mis solicitudes para completarlas.':
          failures?
          'La solicitud se ha registrado, pero '+failures+' fotografía(s) necesitan reintento desde Mis solicitudes.':
          created.recovered?
          'La solicitud ya estaba registrada. Fotografías recuperadas o adjuntadas sin duplicar las existentes.':
          'Solicitud enviada correctamente.',Boolean(failures||photosResult.error));
      }catch{
        message(recorded?
          'La solicitud puede estar registrada. Revisa Mis solicitudes antes de volver a enviarla.':
          'No se pudo confirmar la solicitud. Comprueba Mis solicitudes antes de reintentar.',true);
      }finally{
        if(button.isConnected)button.disabled=false;
      }
    });
  }
  async function loadRequests(){
    setActiveNav(app,'requests');
    currentView='requests';main.innerHTML=`<section class="card">${backButton}<h2>Mis solicitudes</h2><p>Cargando…</p></section>`;
    const userId=session?.user?.id, loadingScreen=main.firstElementChild;
    const viewEpoch=authEpoch;
    if(!userId)return showLogin();
    const requestedPage=Number.isSafeInteger(customerRequestsPage)&&customerRequestsPage>=0?customerRequestsPage:0;
    const {data,count,error}=await fetchCustomerRequestsPage(supabase,userId,
      'id,service_name,status,price,accepted_at,accepted_price,street,address_number,city,preferred_date,scheduled_at,operator_name',requestedPage);
    if(currentView!=='requests'||!isCurrentUser(userId)||authEpoch!==viewEpoch||main.firstElementChild!==loadingScreen)return;
    if(error){main.innerHTML=`<section class="card">${backButton}<h2>Mis solicitudes</h2><p>No se pudieron cargar tus solicitudes. Comprueba la conexión.</p><button type="button" data-view="requests">Reintentar</button></section>`;return}
    if(count>0 && requestedPage>=customerRequestsPageCount(count)){customerRequestsPage=0;return loadRequests();}
    const pager=count>customerRequestsPageSize?`<nav class="staff-new-pagination customer-requests-pagination" aria-label="Páginas de mis solicitudes"><span>Página ${requestedPage+1} de ${customerRequestsPageCount(count)} · ${count} solicitudes</span><div><button type="button" data-requests-page="prev" ${requestedPage===0?'disabled':''}>← Anterior</button><button type="button" data-requests-page="next" ${customerRequestsCanAdvance(requestedPage,count)?'':'disabled'}>Siguiente →</button></div></nav>`:'';
    main.innerHTML=`<section class="card">${backButton}<h2>Mis solicitudes</h2><p data-feedback class="feedback" role="status"></p>${data?.length?data.map(r=>`<article class="request"><strong>${esc(r.service_name)}</strong><span>${esc(statusLabels[r.status]||r.status)}</span><p>${esc(r.street)}, ${esc(r.address_number)} · ${esc(r.city)}</p>${staffProgressMarkup(r.status)}${r.price!=null?`<p>Importe confirmado: <b>${money(r.price)}</b> (IVA incluido)</p>`:''}${r.accepted_at&&r.accepted_price!=null?`<p class="quote-consent-proof"><strong>Presupuesto aceptado:</strong> ${money(r.accepted_price)} (IVA incluido) · ${esc(safeTime(r.accepted_at))}</p>`:''}${r.accepted_at&&r.accepted_price!=null?`<button type="button" data-download-accepted-quote="${esc(r.id)}">⬇ Descargar resumen de aceptación</button>`:''}<small>${r.scheduled_at?'Visita: '+esc(safeTime(r.scheduled_at)):'Fecha preferida: '+esc(r.preferred_date||'No indicada')}</small><div class="flex-actions"><button type="button" data-customer-photos="${esc(r.id)}">📷 Mis fotos</button></div><div class="request-photo-retry"><label>Añadir fotografías a esta solicitud (máximo 4 en total)<input type="file" data-upload-request-photos="${esc(r.id)}" accept="image/jpeg,image/png,image/webp,image/heic" multiple></label><p role="status" aria-live="polite" data-upload-photo-result="${esc(r.id)}"></p></div>${r.status==="completed"?`<div class="flex-actions"><button type="button" class="customer-review-action" data-rate-request="${esc(r.id)}" aria-label="Valorar ${esc(r.service_name)}">⭐ Valorar este trabajo</button></div>`:""}<div class="photo-links" data-customer-photo-output="${esc(r.id)}"></div>${r.status==="quoted" && r.price!==null ? `<div class="flex-actions"><p class="quote-acceptance-summary">Presupuesto: ${money(r.price)} IVA incluido (21 %). Base: ${money(vatIncluded(r.price).base)} · IVA: ${money(vatIncluded(r.price).vat)}. Revisa el importe antes de aceptarlo.</p><button type="button" data-accept-quote="${esc(r.id)}" data-accept-total="${esc(r.price)}">Aceptar presupuesto de ${money(r.price)}</button></div>` : ""}</article>`).join(''):'<p>Todavía no tienes solicitudes.</p>'}${pager}</section>`;
    main.querySelector('[data-requests-page="prev"]')?.addEventListener('click',()=>{if(requestedPage>0){customerRequestsPage=requestedPage-1;void loadRequests()}});
    main.querySelector('[data-requests-page="next"]')?.addEventListener('click',()=>{if(customerRequestsCanAdvance(requestedPage,count)){customerRequestsPage=requestedPage+1;void loadRequests()}});
    main.querySelectorAll('[data-download-accepted-quote]').forEach(button=>button.addEventListener('click',async()=>{
      if(button.disabled||currentView!=='requests'||!isCurrentUser(userId)||
         authEpoch!==viewEpoch||!button.isConnected)return;
      const record=data.find(item=>item.id===button.dataset.downloadAcceptedQuote);
      if(!record?.accepted_at||record.accepted_price==null)
        return message('Todavía no existe un registro de aceptación descargable.',true);
      button.disabled=true;
      const current=id=>isCurrentUser(id)&&authEpoch===viewEpoch&&
        currentView==='requests'&&button.isConnected;
      try{
        const result=await shareAcceptedQuote(record,{userId,isSessionCurrent:current});
        if(!current(userId))return;
        message(result.mode==='native'
          ?'Elige dónde guardar o compartir el resumen. No es una factura ni una firma electrónica.'
          :'Resumen preparado. Contiene información del presupuesto: guárdalo de forma privada.');
      }catch{
        if(current(userId))
          message('No se pudo compartir el resumen. Comprueba la fecha o prueba desde el navegador.',true);
      }finally{
        if(button.isConnected)button.disabled=false;
      }
    }));
    main.querySelectorAll('[data-rate-request]').forEach(button=>button.addEventListener('click',()=>{
      const requestId=button.dataset.rateRequest;
      if(data.some(row=>row.id===requestId && row.status==='completed'))renderHome(requestId);
    }));
    // Adjuntar fotos después de registrar el trabajo (p.ej. si se perdió la red).
    main.querySelectorAll('[data-upload-request-photos]').forEach(input=>input.addEventListener('change',async()=>{
      const requestId=input.dataset.uploadRequestPhotos;
      const feedback=main.querySelector('[data-upload-photo-result="'+requestId+'"]');
      const uid=session?.user?.id;
      const uploadEpoch=authEpoch;
      if(!feedback||!uid)return;
      const selected=Array.from(input.files||[]);
      if(!selected.length)return;
      input.disabled=true;
      feedback.textContent='Comprobando fotografías adjuntas…';
      try{
        feedback.textContent='Subiendo o recuperando fotografías…';
        const result=await uploadPhotosWithRecovery({
          supabase,userId:uid,requestId,files:selected,
          isSessionCurrent:id=>isCurrentUser(id)&&authEpoch===uploadEpoch&&
            currentView==='requests'&&input.isConnected
        });
        if(!input.isConnected||currentView!=='requests'||!isCurrentUser(uid)||authEpoch!==uploadEpoch)return;
        feedback.textContent=result.error||(
          result.failed?
            (result.uploaded+result.recovered)+' fotos guardadas o recuperadas; '+result.failed+
              ' no se pudieron subir. Comprueba la conexión e inténtalo de nuevo.':
            result.uploaded+' nuevas, '+result.recovered+' recuperadas, '+
              result.alreadyPresent+' ya adjuntas. Sin duplicados.'
        );
      }catch{
        if(input.isConnected && currentView==='requests' && isCurrentUser(uid))
          feedback.textContent='No se pudieron comprobar o adjuntar las fotografías. Revisa la conexión antes de reintentar.';
      }finally{input.value='';input.disabled=false}
    }));
    main.querySelectorAll('[data-customer-photos]').forEach(button=>button.addEventListener('click',async()=>{
      const requestId=button.dataset.customerPhotos;
      const out=main.querySelector('[data-customer-photo-output="'+requestId+'"]');
      const uid=session?.user?.id;
      if(!out||!uid||button.disabled)return;
      button.disabled=true;out.textContent='Cargando imágenes…';
      const folder=uid+'/'+requestId;
      try{
        const {data,error}=await supabase.storage.from('request-photos').list(folder,{limit:30});
        if(error)throw error;
        if(!out.isConnected||currentView!=='requests'||session?.user?.id!==uid)return;
        out.replaceChildren();
        if(!data?.length){out.textContent='No hay fotografías adjuntas.';return}
        for(const photo of data){
          if(!photo.name || photo.name.startsWith('.'))continue;
          const {data:signed,error:signError}=await supabase.storage.from('request-photos').createSignedUrl(folder+'/'+photo.name,120);
          if(!out.isConnected||currentView!=='requests'||session?.user?.id!==uid)return;
          if(signError || !signed?.signedUrl)continue;
          const link=document.createElement('a');link.href=signed.signedUrl;link.target='_blank';
          link.rel='noopener noreferrer';link.textContent='📷 Abrir fotografía';out.append(link);
        }
        if(!out.children.length)out.textContent='No hay fotos disponibles.';
      }catch{
        if(out.isConnected&&currentView==='requests'&&isCurrentUser(uid))
          out.textContent='No se pudieron consultar las fotos. Comprueba la conexión y vuelve a intentarlo.';
      }finally{button.disabled=false}
    }));
    main.querySelectorAll('[data-accept-quote]').forEach(button=>button.addEventListener('click',async()=>{
      if(button.disabled)return;
      const total=Number(button.dataset.acceptTotal);
      const valid=vatIncluded(total);
      if(!valid){message('No se pudo verificar el importe. Actualiza la solicitud.',true);return;}
      const quoteUserId=session?.user?.id;
      if(!quoteUserId)return;
      const confirmed=window.confirm('¿Confirmas que aceptas el presupuesto de '+money(valid.total)+
        ' (IVA del 21 % incluido) para esta reparación? Esta acción se registrará en Reparado.');
      if(!confirmed)return;
      button.disabled=true;
      try{
        const {data:accepted,error}=await supabase.rpc('accept_reparado_quote',{p_request_id:button.dataset.acceptQuote,p_expected_price:valid.total});
        if(!isCurrentUser(quoteUserId)||currentView!=='requests'||!button.isConnected)return;
        if(error)throw error;
        if(!accepted){message('Este presupuesto ya no está disponible. Actualiza la solicitud.',true);return}
        await loadRequests();
        message('Presupuesto aceptado. Reparado podrá programar la visita.');
      }catch{
        if(isCurrentUser(quoteUserId)&&currentView==='requests'&&button.isConnected)
          message('No se pudo confirmar la aceptación. Revisa Mis solicitudes antes de volver a intentarlo.',true);
      }finally{if(button.isConnected)button.disabled=false}
    }));
  }
  async function loadAgenda(){
    setActiveNav(app,'agenda');
    currentView='agenda';main.innerHTML=`<section class="card">${backButton}<h2>Mi agenda</h2><p>Cargando…</p></section>`;
    const userId=session?.user?.id,loadingScreen=main.firstElementChild;
    const epoch=authEpoch;
    if(!userId)return showLogin();
    let data,error;
    try{
      ({data,error}=await supabase.from('service_requests').select('id,service_name,scheduled_at,status,operator_name').eq('customer_id',userId).in('status',['scheduled','in_progress']).order('scheduled_at'));
    }catch{error=new Error('No se pudo cargar la agenda. Comprueba la conexión.');}
    if(currentView!=='agenda'||!isCurrentUser(userId)||authEpoch!==epoch||main.firstElementChild!==loadingScreen)return;
    main.innerHTML=`<section class="card">${backButton}<h2>Mi agenda</h2>${error?'<p>No se pudo consultar la agenda. Comprueba la conexión.</p><button type="button" data-view="agenda">Reintentar</button>':data?.length?data.map(r=>`<article class="request"><b>${esc(r.service_name)}</b><p>${esc(safeTime(r.scheduled_at))}</p><small>${esc(statusLabels[r.status])} · Operario: ${esc(r.operator_name||'Por asignar')}</small>${r.status==='scheduled'&&r.scheduled_at?`<p><button type="button" data-visit-calendar="${esc(r.id)}">📅 Añadir cita a mi calendario</button></p>`:''}</article>`).join(''):'<p>No hay visitas programadas.</p>'}<p data-feedback role="status" aria-live="polite"></p></section>`;
    main.querySelectorAll('[data-visit-calendar]').forEach(button=>button.addEventListener('click',async()=>{
      if(button.disabled||!button.isConnected||currentView!=='agenda'||!isCurrentUser(userId)||authEpoch!==epoch)return;
      const visit=data?.find(row=>row.id===button.dataset.visitCalendar&&row.status==='scheduled');
      if(!visit)return;
      button.disabled=true;
      try{
        const result=await shareVisitCalendar(visit);
        if(currentView!=='agenda'||!isCurrentUser(userId)||authEpoch!==epoch||!button.isConnected)return;
        message(result.mode==='native'?'Se ha abierto el menú para compartir la cita. Elige tu calendario y confirma. El bloque de una hora es orientativo.':
          'Archivo de calendario preparado. Ábrelo para añadir la cita. El bloque de una hora es orientativo.');
      }catch{
        if(currentView==='agenda'&&isCurrentUser(userId)&&authEpoch===epoch&&button.isConnected)
          message('No se pudo compartir la cita. Comprueba los permisos o prueba desde el navegador.',true);
      }finally{
        if(button.isConnected)button.disabled=false;
      }
    }));
  }
  async function loadChat(){
    setActiveNav(app,'chat');
    currentView='chat';main.innerHTML=`<section class="card">${backButton}<h2>Chat con Reparado</h2><p>Cargando…</p></section>`;
    const userId=session?.user?.id,loadingScreen=main.firstElementChild;
    const epoch=authEpoch;
    if(!userId)return showLogin();
    const requestedPage=Number.isSafeInteger(customerChatPage)&&customerChatPage>=0?customerChatPage:0;
    let data,error,count;
    try{
      ({data,error,count}=await fetchCustomerChatPage(supabase,userId,requestedPage));
    }catch{error=true;}
    if(currentView!=='chat'||!isCurrentUser(userId)||authEpoch!==epoch||main.firstElementChild!==loadingScreen)return;
    if(!error&&count>0&&requestedPage>=customerChatPageCount(count)){customerChatPage=0;return loadChat();}
    const pager=!error&&count>customerChatPageSize?`<nav class="staff-new-pagination customer-chat-pagination" aria-label="Páginas del chat"><span>Página ${requestedPage+1} de ${customerChatPageCount(count)} · ${count} mensajes</span><div><button type="button" data-chat-page="newer" ${requestedPage===0?'disabled':''}>← Más recientes</button><button type="button" data-chat-page="older" ${customerChatCanReadOlder(requestedPage,count)?'':'disabled'}>Anteriores →</button></div></nav>`:'';
    main.innerHTML=`<section class="card">${backButton}<h2>Chat con Reparado</h2>${error?'<p>No se pudo abrir el chat. Comprueba la conexión.</p><button type="button" data-view="chat">Reintentar</button>':`<div id="messages">${(data||[]).map(r=>`<p class="${r.sender_id===session.user.id?'me':''}">${esc(r.body)}</p>`).join('')||'<p>Sin mensajes todavía.</p>'}</div>${pager}<p><button type="button" data-refresh-chat>Actualizar conversación</button></p><form id="chat-form"><label>Mensaje<input name="body" maxlength="2000" required placeholder="Escribe aquí…"></label><button type="submit">Enviar</button></form><p data-feedback role="status"></p>`}</section>`;
    main.querySelector('[data-chat-page="newer"]')?.addEventListener('click',()=>{if(requestedPage>0){customerChatPage=requestedPage-1;void loadChat()}});
    main.querySelector('[data-chat-page="older"]')?.addEventListener('click',()=>{if(customerChatCanReadOlder(requestedPage,count)){customerChatPage=requestedPage+1;void loadChat()}});
    main.querySelector('[data-refresh-chat]')?.addEventListener('click',()=>{customerChatPage=0;void loadChat()});
    const form=main.querySelector('#chat-form');
    if(form)form.addEventListener('submit',async e=>{
      e.preventDefault();
      const body=String(new FormData(form).get('body')||'').trim();
      const authorId=session?.user?.id;
      if(!body||!authorId)return;
      const button=form.querySelector('[type=submit]');
      if(button.disabled)return;
      button.disabled=true;
      try{
        const {error}=await supabase.from('messages').insert({customer_id:authorId,sender_id:authorId,body});
        if(!isCurrentUser(authorId)||!form.isConnected||currentView!=='chat')return;
        if(error)throw error;
        customerChatPage=0;
        await loadChat();
      }catch{
        if(isCurrentUser(authorId)&&form.isConnected&&currentView==='chat')
          message('No se pudo confirmar el envío. Revisa el chat antes de reintentar.',true);
      }finally{button.disabled=false}
    });
  }
  async function loadNotifications(){
    setActiveNav(app,'profile');
    currentView='notifications';
    const userId=session?.user?.id;
    if(!userId)return showLogin();
    await renderNotifications({
      main,supabase,session,onRefresh:()=>currentView==='notifications'&&isCurrentUser(userId),
      isStaff:userIsStaff()
    });
  }
  async function loadInvoices(){
    setActiveNav(app,'profile');
    currentView='invoices';
    const userId=session?.user?.id;
    if(!userId)return showLogin();
    await renderInvoices({
      main,supabase,session,onRefresh:()=>currentView==='invoices'&&isCurrentUser(userId)
    });
  }
  function loadProfile(){
    setActiveNav(app,'profile');
    if(!session){showLogin();return}
    currentView='profile';
    main.innerHTML=`<section class="card">${backButton}<h2>Mi perfil</h2><p>${esc(session.user.email)}</p><p>Tipo de cuenta: ${esc(profile?.role||'customer')}</p>
      <form id="profile-form"><label>Nombre completo<input name="full_name" autocomplete="name" maxlength="100" value="${esc(profile?.full_name||'')}"></label><label>Teléfono<input name="phone" type="tel" autocomplete="tel" maxlength="25" value="${esc(profile?.phone||'')}"></label><button type="submit">Guardar perfil</button></form><div class="flex-actions"><button type="button" data-logout>Cerrar sesión</button><button type="button" data-view="notifications">🔔 Mis avisos</button><button type="button" id="view-invoices">🧾 Mis facturas</button>${userIsStaff()?'<button type="button" data-view="admin">🧰 Gestión interna</button>':''}${profile?.role==='admin'?'<button type="button" data-view="owner">⚙ Panel del propietario</button>':''}${profile?.role==='admin'?'<button type="button" data-view="review-moderation">⭐ Moderar reseñas</button><button type="button" data-view="support-admin">🐞 Incidencias de clientes</button>':''}</div>
      <section class="reparado-help" aria-label="Ayuda y atención al cliente"><h3>Atención y ayuda</h3>
        <form id="reparado-issue-report"><label>¿En qué parte de la app ha ocurrido?
          <select name="context" required>
            <option value="general">General</option>
            <option value="solicitud">Solicitudes</option>
            <option value="agenda">Agenda</option>
            <option value="chat">Chat</option>
            <option value="facturacion">Facturación</option>
            <option value="cuenta">Cuenta y acceso</option>
          </select></label>
          <label>Resumen del fallo<input name="subject" maxlength="140" minlength="5" required placeholder="¿Qué no funciona?"></label>
          <label>Descripción<textarea name="description" maxlength="2000" minlength="12" rows="4" required placeholder="¿Qué ocurrió y qué esperabas que sucediera? Evita incluir contraseñas o datos de otras personas."></textarea></label>
          <button type="submit">Enviar incidencia a soporte</button>
          <p data-issue-feedback role="status" aria-live="polite"></p>
        </form>
        <p>También puedes escribir directamente:</p>${contactLinksMarkup()}</section>
      ${!userIsStaff()?'<section class="reparado-help" id="customer-support-history" aria-label="Mis incidencias">'+
        '<div class="support-history-head"><h3>Mis incidencias</h3><button type="button" data-refresh-support>Actualizar estados</button></div>'+
        '<p data-support-history-status role="status" aria-live="polite">Consultando incidencias…</p>'+
        '<div data-support-history-list></div></section>':''}
      ${profile?.role==='admin'?'<section class="reparado-help" id="system-diagnostics"><h3>Diagnóstico de conexión</h3><p>Comprueba la sesión y los permisos de lectura, sin modificar solicitudes ni acceder a datos de otros clientes.</p><button type="button" id="check-system-connection">Comprobar conexión real</button><p data-system-diagnostics-status role="status" aria-live="polite"></p></section>':''}
      ${profile?.role==='customer'?`<section class="reparado-help" id="customer-data-export">
        <h3>Descargar mis datos</h3>
        <p>Puedes descargar un archivo JSON con tu perfil, solicitudes, mensajes, avisos, documentos visibles e incidencias. Las fotografías y las reseñas no forman parte de esta copia; si las necesitas, contacta con soporte.</p>
        <p>El archivo incluye información personal, como direcciones y teléfonos. Elige un destino seguro y no lo compartas con terceros.</p>
        <button type="button" id="download-my-data">Guardar o compartir mis datos visibles</button>
        <p data-export-feedback role="status" aria-live="polite"></p>
      </section>`:''}
      <section class="account-deletion">
        <h3>Privacidad de la cuenta</h3>
        <p>Puedes solicitar la eliminación de tu cuenta y de tus datos personales, salvo aquellos que debamos conservar por obligación legal.</p>
        <button type="button" id="request-account-deletion">Solicitar eliminación de mi cuenta</button>
        <button type="button" id="refresh-account-deletion-status">Consultar estado</button>
        <p id="account-deletion-status" role="status" aria-live="polite"></p>
      </section>
      <p data-feedback class="feedback" role="status"></p></section>`;
    main.querySelector('#view-invoices').addEventListener('click',loadInvoices);
    const personalDataButton=main.querySelector('#download-my-data');
    personalDataButton?.addEventListener('click',async()=>{
      const ownerId=session?.user?.id;
      const originalEpoch=authEpoch;
      const panel=main.querySelector('#customer-data-export');
      const feedback=panel?.querySelector('[data-export-feedback]');
      if(!ownerId||!panel||!feedback||personalDataButton.disabled||!isCurrentUser(ownerId))return;
      personalDataButton.disabled=true;
      feedback.textContent='Preparando una copia de los datos visibles de tu cuenta…';
      const stillOwner=uid=>isCurrentUser(uid)&&authEpoch===originalEpoch&&
        currentView==='profile'&&panel.isConnected;
      try{
        const snapshot=await buildPersonalDataExport({
          supabase,userId:ownerId,isCurrentUser:stillOwner
        });
        if(!stillOwner(ownerId))return;
        const result=await sharePrivateDataExport(snapshot,{
          userId:ownerId,isSessionCurrent:stillOwner
        });
        if(!stillOwner(ownerId))return;
        feedback.textContent=result.mode==='native'
          ?'Elige dónde guardar la copia en el menú del teléfono. Contiene datos privados; no la compartas con desconocidos.'
          :'Descarga solicitada. Revisa la carpeta de descargas y guarda el archivo en privado.';
      }catch{
        if(stillOwner(ownerId))
          feedback.textContent='No se pudo preparar la copia completa. Comprueba la conexión o consulta con soporte.';
      }finally{
        if(personalDataButton.isConnected)personalDataButton.disabled=false;
      }
    });

    const connectionButton=main.querySelector('#check-system-connection');
    connectionButton?.addEventListener('click',async()=>{
      const originId=session?.user?.id;
      const panel=main.querySelector('#system-diagnostics');
      const output=panel?.querySelector('[data-system-diagnostics-status]');
      if(!panel||!output||!isCurrentUser(originId)||profile?.role!=='admin'||connectionButton.disabled)return;
      connectionButton.disabled=true;
      output.textContent='Comprobando el servidor y permisos privados…';
      try{
        const report=await checkRealBackendConnection({supabase,userId:originId});
        if(!panel.isConnected||currentView!=='profile'||!isCurrentUser(originId)||profile?.role!=='admin')return;
        const details=report.checks.map(check=>(check.ok?'Correcto: ':'Error: ')+check.label).join(' · ');
        output.textContent=(report.ok?'Comprobación de conexión superada. ':'Hay comprobaciones sin superar. ')+details+
          '. Esta prueba no sustituye la auditoría de seguridad ni las pruebas en dispositivos reales.';
      }catch{
        if(panel.isConnected&&currentView==='profile'&&isCurrentUser(originId))
          output.textContent='No se pudo realizar la comprobación. Revisa la conexión y vuelve a intentarlo.';
      }finally{if(connectionButton.isConnected)connectionButton.disabled=false}
    });

    const historyPanel=main.querySelector('#customer-support-history');
    const supportOwnerId=session.user.id;
    let historyRequestSeq=0,supportHistoryPage=0;
    const historyPager=document.createElement('nav');
    historyPager.className='staff-new-pagination customer-support-pagination';
    historyPager.setAttribute('aria-label','Páginas de mis incidencias');
    historyPanel?.append(historyPager);
    const refreshSupportHistory=async()=>{
      if(!historyPanel||!isCurrentUser(supportOwnerId)||currentView!=='profile'||!historyPanel.isConnected)return;
      const uid=supportOwnerId,requestSeq=++historyRequestSeq;
      const list=historyPanel.querySelector('[data-support-history-list]');
      const note=historyPanel.querySelector('[data-support-history-status]');
      note.textContent='Consultando incidencias…';
      try{
        // La columna user_id es privada; el servidor aplica RLS al contar y paginar.
        const {data,count,error}=await fetchSupportHistoryPage(supabase,uid,supportHistoryPage);
        if(!historyPanel.isConnected||currentView!=='profile'||!isCurrentUser(uid)||requestSeq!==historyRequestSeq)return;
        if(error)throw new Error('No se pudo consultar el historial');
        if((count===0&&supportHistoryPage!==0)||
           (count>0&&supportHistoryPage>=supportHistoryPageCount(count))){
          supportHistoryPage=0;
          return refreshSupportHistory();
        }
        list.innerHTML=supportHistoryMarkup(data);
        note.textContent=count+' incidencias registradas en esta cuenta.';
        historyPager.replaceChildren();
        if(count>supportHistoryPageSize){
          const span=document.createElement('span');
          span.textContent='Página '+(supportHistoryPage+1)+' de '+supportHistoryPageCount(count);
          const actions=document.createElement('div');
          const prev=document.createElement('button');
          prev.type='button';prev.dataset.supportHistoryPage='prev';
          prev.textContent='← Anterior';prev.disabled=supportHistoryPage===0;
          const next=document.createElement('button');
          next.type='button';next.dataset.supportHistoryPage='next';
          next.textContent='Siguiente →';
          next.disabled=!supportHistoryCanAdvance(supportHistoryPage,count);
          actions.append(prev,next);historyPager.append(span,actions);
        }
      }catch{
        if(historyPanel.isConnected&&currentView==='profile'&&isCurrentUser(uid)&&requestSeq===historyRequestSeq){
          list.replaceChildren();
          historyPager.replaceChildren();
          note.textContent='No se pueden consultar las incidencias. Comprueba la conexión y pulsa Actualizar estados.';
        }
      }
    };
    historyPager.addEventListener('click',event=>{
      const button=event.target.closest('[data-support-history-page]');
      if(!button||button.disabled||!isCurrentUser(supportOwnerId)||
        currentView!=='profile'||!historyPanel.isConnected)return;
      const direction=button.dataset.supportHistoryPage;
      if(direction==='prev'&&supportHistoryPage>0)supportHistoryPage--;
      else if(direction==='next')supportHistoryPage++;
      else return;
      void refreshSupportHistory();
    });
    historyPanel?.querySelector('[data-refresh-support]')?.addEventListener('click',refreshSupportHistory);
    void refreshSupportHistory();
    const issueForm=main.querySelector('#reparado-issue-report');
    let issueReportId=crypto.randomUUID(),previousIssuePayload=null;
    issueForm.addEventListener('submit',async event=>{
      event.preventDefault();
      if(!session?.user?.id)return;
      const fields=new FormData(issueForm);
      const subject=String(fields.get('subject')||'').trim();
      const description=String(fields.get('description')||'').trim();
      const context=String(fields.get('context')||'').trim();
      const button=issueForm.querySelector('[type="submit"]');
      const feedback=issueForm.querySelector('[data-issue-feedback]');
      if(subject.length<5||subject.length>140||description.length<12||description.length>2000||!['general','solicitud','agenda','chat','facturacion','cuenta'].includes(context)){
        feedback.textContent='Revisa el asunto, la sección y la descripción del problema.';return;
      }
      if(button.disabled)return;
      const userId=session.user.id;
      if(!isCurrentUser(supportOwnerId))return;
      const payloadSnapshot=JSON.stringify({subject,description,context});
      if(previousIssuePayload!==null&&previousIssuePayload!==payloadSnapshot){
        feedback.textContent='Has modificado la incidencia después de un intento. Consulta Mis incidencias antes de enviar una nueva.';
        return;
      }
      previousIssuePayload=payloadSnapshot;
      button.disabled=true;
      feedback.textContent='Registrando tu incidencia…';
      try{
        const result=await submitSupportIssue({
          supabase,userId,subject,description,context,reportId:issueReportId
        });
        if(!feedback.isConnected||!isCurrentUser(userId)||currentView!=='profile')return;
        if(!result.ok){
          feedback.textContent=supportIssueFailureMessage(result.code);
          // Permitir corregir/redactar otra incidencia cuando es un límite confirmado.
          if(result.code==='limit'){previousIssuePayload=null;issueReportId=crypto.randomUUID();}
        }else{
          feedback.textContent=result.recovered?
            'La incidencia ya estaba registrada; la hemos recuperado. Consulta su estado en Mis incidencias.':
            'Incidencia registrada. El equipo podrá revisarla desde el panel privado.';
          issueForm.reset();
          previousIssuePayload=null;
          issueReportId=crypto.randomUUID();
          supportHistoryPage=0;
          void refreshSupportHistory();
        }
      }catch{
        if(feedback.isConnected&&isCurrentUser(userId)&&currentView==='profile')
          feedback.textContent='No se pudo confirmar el registro. Consulta Mis incidencias antes de reintentar.';
      }finally{if(button.isConnected)button.disabled=false;}
    });

    const deletionButton=main.querySelector('#request-account-deletion');
    const deletionRefresh=main.querySelector('#refresh-account-deletion-status');
    const deletionStatus=main.querySelector('#account-deletion-status');
    const deletionOwnerId=session.user.id;
    const ownDeletionScreen=()=>deletionStatus.isConnected&&
      currentView==='profile'&&isCurrentUser(deletionOwnerId);
    let deletionLoading=false,deletionSaving=false,deletionVerified=false,deletionExists=false;
    const refreshDeletionControls=()=>{
      if(!ownDeletionScreen())return;
      deletionRefresh.disabled=deletionLoading||deletionSaving;
      deletionButton.disabled=deletionLoading||deletionSaving||!deletionVerified||deletionExists;
    };
    const renderDeletionStatus=async()=>{
      if(!ownDeletionScreen()||deletionLoading||deletionSaving)return;
      deletionLoading=true;
      refreshDeletionControls();
      deletionStatus.textContent='Consultando estado de eliminación…';
      try{
        const result=await readOwnDeletionStatus(supabase);
        if(!ownDeletionScreen())return;
        deletionVerified=result.ok;
        deletionExists=Boolean(result.request);
        deletionStatus.textContent=result.ok?ownDeletionLabel(result.request):
          'No se pudo comprobar el estado. Comprueba la conexión y pulsa Consultar estado.';
      }finally{
        deletionLoading=false;
        refreshDeletionControls();
      }
    };
    deletionRefresh.addEventListener('click',renderDeletionStatus);
    deletionButton.addEventListener('click',async()=>{
      if(!ownDeletionScreen()||deletionButton.disabled||!deletionVerified||deletionExists)return;
      if(!window.confirm('¿Solicitar la eliminación de tu cuenta y tus datos personales? Algunos documentos fiscales deben conservarse por ley. La tramitación no es inmediata.'))return;
      deletionSaving=true;
      refreshDeletionControls();
      deletionStatus.textContent='Registrando tu solicitud…';
      try{
        const result=await submitOwnDeletionRequest(supabase,deletionOwnerId);
        if(!ownDeletionScreen())return;
        if(result.ok){
          deletionVerified=true;
          deletionExists=true;
          deletionStatus.textContent=ownDeletionLabel(result.request)+
            ' El equipo revisará la eliminación y te comunicará su finalización.';
        }else{
          // Si la respuesta se perdió, NO declarar registro confirmado.
          // Obligar a consultar el estado antes de otra solicitud.
          deletionVerified=false;
          deletionStatus.textContent='No se pudo confirmar el registro. Pulsa Consultar estado antes de volver a solicitarlo.';
        }
      }catch{
        if(ownDeletionScreen()){
          deletionVerified=false;
          deletionStatus.textContent='No se pudo comprobar el registro. Pulsa Consultar estado antes de reintentar.';
        }
      }finally{
        deletionSaving=false;
        refreshDeletionControls();
      }
    });
    refreshDeletionControls();
    void renderDeletionStatus();
    main.querySelector('#profile-form').addEventListener('submit',async event=>{
      event.preventDefault();
      const fields=new FormData(event.currentTarget);
      const full_name=String(fields.get('full_name')||'').trim();
      const phone=String(fields.get('phone')||'').trim();
      if(full_name.length>100 || phone.length>25)return message('Los datos son demasiado largos.',true);
      const userId=session?.user?.id;
      const profileForm=event.currentTarget;
      const button=profileForm.querySelector('[type=submit]');
      if(!userId||button.disabled)return;
      button.disabled=true;
      try{
        const {error}=await supabase.from('profiles').update({full_name,phone}).eq('id',userId);
        if(!isCurrentUser(userId)||!profileForm.isConnected||currentView!=='profile')return;
        if(error)throw error;
        profile={...profile,full_name,phone};message('Perfil actualizado.');
      }catch{
        if(isCurrentUser(userId)&&currentView==='profile')
          message('No se pudo guardar el perfil. Comprueba tu conexión e inténtalo de nuevo.',true);
      }finally{button.disabled=false}
    });
  }

  async function loadStaffChat(customerId, serviceName, page=0, returnView='admin'){
    if(!userIsStaff() || !session)return renderHome();
    currentView='staff-chat';
    const staffUserId=session.user.id;
    const chatEpoch=authEpoch;
    const requestedPage=Number.isSafeInteger(page)&&page>=0?page:0;
    const box=document.createElement('section');
    box.className='card';
    const back=document.createElement('button');
    back.className='back';back.type='button';back.textContent=returnView==='owner-messages'?'← Mensajes del propietario':
      returnView==='owner-customers'?'← Clientes':'← Panel interno';
    back.addEventListener('click',()=>returnView==='owner-messages'?showOwnerMessages():
      returnView==='owner-customers'?showOwnerPeople('customer'):renderAdmin());
    const heading=document.createElement('h2');
    heading.textContent='Chat: '+serviceName;
    const history=document.createElement('div');
    history.id='messages';
    history.textContent='Cargando mensajes…';
    box.append(back,heading,history);
    main.replaceChildren(box);
    let result;
    try{
      result=await fetchCustomerChatPage(supabase,customerId,requestedPage);
    }catch{result={error:true};}
    if(currentView!=='staff-chat'||!isCurrentUser(staffUserId)||!box.isConnected||authEpoch!==chatEpoch)return;
    history.replaceChildren();
    if(result.error){
      history.textContent='No se pudieron cargar los mensajes. Comprueba la conexión.';
      const retry=document.createElement('button');
      retry.type='button';retry.textContent='Reintentar';retry.addEventListener('click',()=>loadStaffChat(customerId,serviceName,requestedPage,returnView));
      box.append(retry);
      return;
    }
    if(result.count>0&&requestedPage>=customerChatPageCount(result.count))return loadStaffChat(customerId,serviceName,0,returnView);
    for(const row of result.data||[]){
      const p=document.createElement('p');
      p.className=row.sender_id===staffUserId?'me':'';
      p.textContent=row.body;
      history.append(p);
    }
    if(!history.childNodes.length)history.textContent='No hay mensajes todavía.';
    history.scrollTop=history.scrollHeight;
    // V91: solo marcar leída la última página REALMENTE cargada,
    // nunca toda la bandeja ni una conversación que haya fallado.
    if(returnView==='owner-messages'&&ownerOnly()&&requestedPage===0&&
      Array.isArray(result.data)&&result.data.length){
      const newest=result.data[result.data.length-1];
      if(newest?.id){
        const readFeedback=document.createElement('p');
        readFeedback.className='owner-read-feedback';
        readFeedback.setAttribute('role','status');
        readFeedback.setAttribute('aria-live','polite');
        box.append(readFeedback);
        void Promise.resolve().then(()=>supabase.rpc('reparado_mark_owner_chat_read',{
          p_customer_id:customerId,p_last_message_id:newest.id
        })).then(({data,error})=>{
          if(!box.isConnected||currentView!=='staff-chat'||
            !isCurrentUser(staffUserId)||authEpoch!==chatEpoch)return;
          if(error&&!['PGRST202','42883'].includes(error.code))
            readFeedback.textContent='El chat se ha mostrado, pero no se pudo guardar el estado de lectura.';
          else if(!error&&data!==true)
            readFeedback.textContent='No se pudo confirmar la lectura de la conversación.';
        }).catch(()=>{
          if(box.isConnected&&currentView==='staff-chat'&&
            isCurrentUser(staffUserId)&&authEpoch===chatEpoch)
            readFeedback.textContent='No se pudo actualizar el estado de lectura.';
        });
      }
    }
    if(result.count>customerChatPageSize){
      const nav=document.createElement('nav');
      nav.className='staff-new-pagination';
      nav.setAttribute('aria-label','Páginas del chat del personal');
      const summary=document.createElement('span');
      summary.textContent='Página '+(requestedPage+1)+' de '+customerChatPageCount(result.count)+' · '+result.count+' mensajes';
      const actions=document.createElement('div');
      const newer=document.createElement('button');
      newer.type='button';newer.textContent='← Más recientes';
      newer.disabled=requestedPage===0;
      newer.addEventListener('click',()=>loadStaffChat(customerId,serviceName,requestedPage-1,returnView));
      const older=document.createElement('button');
      older.type='button';older.textContent='Anteriores →';
      older.disabled=!customerChatCanReadOlder(requestedPage,result.count);
      older.addEventListener('click',()=>loadStaffChat(customerId,serviceName,requestedPage+1,returnView));
      actions.append(newer,older);
      nav.append(summary,actions);
      box.append(nav);
    }
    const refresh=document.createElement('button');
    refresh.type='button';refresh.textContent='Actualizar conversación';
    refresh.addEventListener('click',()=>loadStaffChat(customerId,serviceName,0,returnView));
    box.append(refresh);
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
      if(!body||!isCurrentUser(staffUserId)||send.disabled)return;
      send.disabled=true;
      try{
        const {error}=await supabase.from('messages').insert({
          customer_id:customerId,sender_id:staffUserId,body
        });
        if(!isCurrentUser(staffUserId)||!box.isConnected||currentView!=='staff-chat')return;
        if(error)throw error;
        await loadStaffChat(customerId,serviceName,0,returnView);
      }catch{
        if(isCurrentUser(staffUserId)&&box.isConnected)
          feedback.textContent='No se pudo confirmar el mensaje. Revisa el chat antes de reenviarlo.';
      }finally{send.disabled=false}
    });
  }

  async function loadSupportReports(){
    if(!session||profile?.role!=='admin'){if(!session)showLogin();else renderHome();return;}
    currentView='support-admin';setActiveNav(app,'profile');
    main.innerHTML='<section class="card" id="reparado-support-admin">'+backButton+
      '<h2>Incidencias de clientes</h2><p class="notice">Solo administración. Los detalles son privados; no los envíes por correo ni los compartas fuera del panel.</p>'+
      '<p data-issues-status role="status">Cargando…</p><div data-issues-list></div></section>';
    const root=main.querySelector('#reparado-support-admin'),status=root.querySelector('[data-issues-status]'),list=root.querySelector('[data-issues-list]');
    const pager=document.createElement('nav');
    pager.className='staff-new-pagination support-admin-pagination';
    pager.setAttribute('aria-label','Páginas de incidencias pendientes');
    root.append(pager);
    const adminUserId=session.user.id;
    const available=()=>root.isConnected&&currentView==='support-admin'&&isCurrentUser(adminUserId)&&profile?.role==='admin';
    let refreshSeq=0,supportPage=0;
    async function refresh(){
      const seq=++refreshSeq;
      status.textContent='Consultando incidencias…';
      try{
        const {data,count,error}=await fetchStaffSupportPage(supabase,supportPage);
        if(!available()||seq!==refreshSeq)return;
        if(error)throw new Error('No se pudo leer la bandeja');
        // Cuando se resuelve la última incidencia de una página, retroceder.
        if(count>0&&supportPage>=staffSupportPageCount(count)){
          supportPage=staffSupportPageCount(count)-1;
          return refresh();
        }
        if(count===0&&supportPage!==0){supportPage=0;return refresh();}
        status.textContent=count+' incidencias abiertas o en revisión.';
        list.innerHTML=data.map(item=>'<article class="support-ticket" data-support-ticket="'+esc(item.id)+'">'+
          '<strong>'+esc(item.subject)+'</strong> <small>'+esc(item.context)+' · '+esc(item.status)+'</small>'+
          '<p>'+esc(item.description)+'</p>'+
          '<div class="flex-actions"><button type="button" data-support-status="reviewing" data-ticket-id="'+esc(item.id)+'">En revisión</button>'+
          '<button type="button" data-support-status="resolved" data-ticket-id="'+esc(item.id)+'">Marcar resuelta</button></div></article>').join('')||
          '<p>No hay incidencias pendientes.</p>';
        pager.replaceChildren();
        if(count>staffSupportPageSize){
          const info=document.createElement('span');
          info.textContent='Página '+(supportPage+1)+' de '+staffSupportPageCount(count);
          const controls=document.createElement('div');
          const prev=document.createElement('button');
          prev.type='button';prev.dataset.supportPage='prev';prev.textContent='← Anterior';
          prev.disabled=supportPage===0;
          const next=document.createElement('button');
          next.type='button';next.dataset.supportPage='next';next.textContent='Siguiente →';
          next.disabled=!staffSupportCanAdvance(supportPage,count);
          controls.append(prev,next);pager.append(info,controls);
        }
      }catch{
        if(available()&&seq===refreshSeq){
          list.replaceChildren();
          status.textContent='No se pueden cargar las incidencias. Revisa conexión y permisos.';
          pager.innerHTML='<button type="button" data-support-page="retry">Reintentar</button>';
        }
      }
    }
    const savingReports=new Set();
    root.addEventListener('click',async event=>{
      const pageButton=event.target.closest('[data-support-page]');
      if(pageButton){
        if(!available()||pageButton.disabled)return;
        const action=pageButton.dataset.supportPage;
        if(action==='retry'){void refresh();return;}
        if(action==='prev'&&supportPage>0){supportPage--;void refresh();return;}
        if(action==='next'&&!pageButton.disabled){supportPage++;void refresh();}
        return;
      }
      const b=event.target.closest('[data-support-status]');
      if(!b||b.disabled||!available())return;
      const next=b.dataset.supportStatus,id=b.dataset.ticketId;
      if(!['reviewing','resolved'].includes(next)||!list.querySelector('[data-support-ticket="'+CSS.escape(id)+'"]')||savingReports.has(id))return;
      savingReports.add(id);
      const reportCard=list.querySelector('[data-support-ticket="'+CSS.escape(id)+'"]');
      const buttons=[...reportCard.querySelectorAll('[data-support-status]')];
      for(const button of buttons)button.disabled=true;
      try{
        const {data,error}=await supabase.from('support_reports').update({status:next})
          .eq('id',id).in('status',['open','reviewing']).select('id,status');
        if(!available())return;
        if(error||!data?.length){status.textContent='No se pudo cambiar el estado. Actualiza la pantalla.';return;}
        await refresh();
      }catch{if(available())status.textContent='No se ha podido guardar el cambio.';}
      finally{
        savingReports.delete(id);
        for(const button of buttons)if(button.isConnected)button.disabled=false;
      }
    });
    await refresh();
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

  // V84 · Una sola entrada privada para la cuenta propietaria.
  // El rol se obtiene del perfil autenticado, nunca de un botón o parámetro.
  const ownerOnly=()=>Boolean(session?.user?.id&&profile?.role==='admin');
  const ownerRoute=(view,filter)=>{
    if(!ownerOnly())return;
    if(view==='admin')return renderAdmin(filter||'all');
    if(view==='owner-calendar')return showOwnerCalendar();
    if(view==='owner-messages')return showOwnerMessages();
    if(view==='owner-customers')return showOwnerPeople('customer');
    if(view==='owner-operators')return showOwnerPeople('operator');
    if(view==='owner-mail')return showOwnerMail();
    if(view==='owner-export')return showOwnerWorkExport();
    if(view==='support-admin')return loadSupportReports();
    if(view==='review-moderation')return openReviewModeration();
  };
  async function showOwnerDashboard(){
    if(!ownerOnly()){if(!session)showLogin();else renderHome();return}
    setActiveNav(app,'profile');
    currentView='owner';
    const ownerId=session.user.id,epoch=authEpoch;
    await mountOwnerDashboard({
      main,supabase,
      isActive:()=>currentView==='owner'&&isCurrentUser(ownerId)&&
        authEpoch===epoch&&ownerOnly(),
      onNavigate:ownerRoute
    });
  }
  async function showOwnerCalendar(initialOperatorId=null){
    if(!ownerOnly()){if(!session)showLogin();else renderHome();return}
    setActiveNav(app,'profile');
    currentView='owner-calendar';
    const ownerId=session.user.id,epoch=authEpoch;
    await mountOwnerCalendar({
      main,supabase,initialOperatorId,
      isActive:()=>currentView==='owner-calendar'&&isCurrentUser(ownerId)&&
        authEpoch===epoch&&ownerOnly(),
      onBack:()=>showOwnerDashboard(),
      onNavigate:ownerRoute
    });
  }
  async function showOwnerMessages(){
    if(!ownerOnly()){if(!session)showLogin();else renderHome();return}
    setActiveNav(app,'profile');
    currentView='owner-messages';
    const ownerId=session.user.id,epoch=authEpoch;
    await mountOwnerMessages({
      main,supabase,
      isActive:()=>currentView==='owner-messages'&&isCurrentUser(ownerId)&&
        authEpoch===epoch&&ownerOnly(),
      onBack:()=>showOwnerDashboard(),
      onConversation:customerId=>loadStaffChat(customerId,'Cliente',0,'owner-messages')
    });
  }
  async function showOwnerPeople(role){
    if(!ownerOnly()){if(!session)showLogin();else renderHome();return}
    if(!['customer','operator'].includes(role))return showOwnerDashboard();
    setActiveNav(app,'profile');
    currentView=role==='customer'?'owner-customers':'owner-operators';
    const view=currentView,ownerId=session.user.id,epoch=authEpoch;
    await mountOwnerPeople({
      main,supabase,role,
      isActive:()=>currentView===view&&isCurrentUser(ownerId)&&
        authEpoch===epoch&&ownerOnly(),
      onBack:()=>showOwnerDashboard(),
      onChat:id=>loadStaffChat(id,'Cliente',0,view),
      onCalendar:id=>showOwnerCalendar(id)
    });
  }
  async function showOwnerWorkExport(){
    if(!ownerOnly()){if(!session)showLogin();else renderHome();return}
    setActiveNav(app,'profile');
    currentView='owner-export';
    const ownerId=session.user.id,epoch=authEpoch;
    await mountOwnerWorkExport({
      main,supabase,ownerId,
      isActive:()=>currentView==='owner-export'&&isCurrentUser(ownerId)&&
        authEpoch===epoch&&ownerOnly(),
      onBack:()=>showOwnerDashboard()
    });
  }

  function showOwnerMail(){
    if(!ownerOnly()){if(!session)showLogin();else renderHome();return}
    setActiveNav(app,'profile');
    currentView='owner-mail';
    main.innerHTML=ownerMailMarkup();
    main.querySelector('[data-owner-mail-back]')?.addEventListener('click',()=>showOwnerDashboard());
  }

  async function renderAdmin(filter=adminFilter){
    setActiveNav(app,'profile');
    if(!userIsStaff()){renderHome();return}
    currentView='admin';adminFilter=filter;
    if(staffWorkLastUser!==session?.user?.id){
      staffWorkLastUser=session?.user?.id||null;
      staffWorkPage=0;
      staffSearchTerm='';
      staffSearchField='service_name';
    }
    main.innerHTML=`<section class="card">${backButton}<h2>Panel interno</h2><p>Cargando solicitudes…</p></section>`;
    const admin=profile?.role==='admin';
    const staffUserId=session.user.id, loadingScreen=main.firstElementChild;
    let team,newQueue,unassignedQueue,filteredPage,filterCounts;
    try{
      [team,newQueue,unassignedQueue,filteredPage,filterCounts]=await Promise.all([
        admin ? supabase.from('profiles').select('id,full_name,role').eq('role','operator') : Promise.resolve({data:[],error:null}),
        admin
          ? (filter==='new'
             ? fetchNewRequestsPage(supabase,'id,customer_id,service_name,street,address_number,postal_code,city,phone,description,status,scheduled_at,operator_id,operator_name,price',newRequestsPage)
             : fetchNewRequestsCount(supabase))
          : Promise.resolve({count:null,error:false}),
        admin
          ? (filter==='unassigned'
             ? fetchUnassignedRequestsPage(supabase,'id,customer_id,service_name,street,address_number,postal_code,city,phone,description,status,scheduled_at,operator_id,operator_name,price',unassignedRequestsPage)
             : fetchUnassignedRequestsCount(supabase))
          : Promise.resolve({count:null,error:false}),
        admin && ['new','unassigned'].includes(filter)
          ? Promise.resolve({data:[],count:0,error:false})
          : fetchStaffWorkPage(supabase,{
              filter,page:staffWorkPage,operatorId:admin?null:staffUserId,
              searchTerm:staffSearchTerm,searchField:staffSearchField
            }),
        fetchStaffWorkCounts(supabase,{operatorId:admin?null:staffUserId})
      ]);
    }catch{team={data:[],error:null};newQueue={count:null,error:true};unassignedQueue={count:null,error:true};filteredPage={error:true};filterCounts={counts:null,error:true};}
    if(currentView!=='admin'||!isCurrentUser(staffUserId)||main.firstElementChild!==loadingScreen)return;
    if(filterCounts?.error||!filterCounts?.counts){
      main.innerHTML=`<section class="card">${backButton}<h2>Panel interno</h2><p>No se pudieron comprobar los contadores completos del servidor. No se mostrarán cifras parciales como si fueran totales.</p><button type="button" data-reload-staff>Reintentar</button></section>`;
      main.querySelector('[data-reload-staff]')?.addEventListener('click',()=>renderAdmin(filter));
      return;
    }
    if(admin && team.error){
      main.innerHTML=`<section class="card">${backButton}<h2>Panel interno</h2><p>No se pudo consultar el personal. No se permiten asignaciones hasta recuperar la lista de operarios.</p><button type="button" data-reload-staff>Reintentar</button></section>`;
      main.querySelector('[data-reload-staff]')?.addEventListener('click',()=>renderAdmin(filter));
      return;
    }
    if(admin && newQueue?.error){
      main.innerHTML=`<section class="card">${backButton}<h2>Panel interno</h2><p>No se pudo consultar la bandeja de solicitudes nuevas. No se mostrará un recuento que pueda ser falso.</p><button type="button" data-reload-staff>Reintentar</button></section>`;
      main.querySelector('[data-reload-staff]')?.addEventListener('click',()=>renderAdmin(filter));
      return;
    }
    if(admin && unassignedQueue?.error){
      main.innerHTML=`<section class="card">${backButton}<h2>Panel interno</h2><p>No se pudieron comprobar los trabajos sin operario. No se mostrará un recuento incompleto.</p><button type="button" data-reload-staff>Reintentar</button></section>`;
      main.querySelector('[data-reload-staff]')?.addEventListener('click',()=>renderAdmin(filter));
      return;
    }
    if(filteredPage?.error){
      main.innerHTML=`<section class="card">${backButton}<h2>Panel interno</h2><p>No se pudieron cargar las páginas del historial de trabajos. Comprueba la conexión.</p><button type="button" data-reload-staff>Reintentar</button></section>`;
      main.querySelector('[data-reload-staff]')?.addEventListener('click',()=>renderAdmin(filter));
      return;
    }
    if(!admin||!['new','unassigned'].includes(filter)){
      if(staffWorkPage>=staffWorkPageCount(filteredPage.count)&&staffWorkPage>0){
        staffWorkPage=0;void renderAdmin(filter);return;
      }
    }
    if(admin && filter==='new' && newRequestsPage>=Math.max(1,newRequestsPageCount(newQueue.count))){
      newRequestsPage=0;
      void renderAdmin('new');
      return;
    }
    if(admin && filter==='unassigned' && unassignedRequestsPage>=Math.max(1,newRequestsPageCount(unassignedQueue.count))){
      unassignedRequestsPage=0;
      void renderAdmin('unassigned');
      return;
    }
    const operators=team.data||[];
    const all=admin && filter==='new' ? newQueue.data : admin && filter==='unassigned' ? unassignedQueue.data : filteredPage.data;
    const counts={...filterCounts.counts,unassigned:admin?unassignedQueue.count:0};
    if(admin)counts.new=newQueue.count;
    if((!admin||!['new','unassigned'].includes(filter))&&!staffSearchTerm)
      counts[filter]=filteredPage.count;
    const tabCounts={...counts};
    const chosen=filterJobs(all,filter);
    const statuses=validStatus.map(x=>({id:x,label:statusLabels[x]}));
    main.innerHTML=`<section class="card">${backButton}<h2>Panel interno · Reparado</h2><p class="notice">${admin && filter==='new'?'Solicitudes nuevas consultadas directamente en Supabase, de 50 en 50.':admin && filter==='unassigned'?'Trabajos sin operario consultados directamente en Supabase, de 50 en 50.':(admin?'Panel de administración':'Solicitudes asignadas a tu cuenta')+'. Historial completo por páginas de 50. Todos los contadores consultan el total real autorizado en Supabase, sin límite de 150.'}</p>
    ${admin?`<div class="staff-new-queue" role="status"><div><strong>${counts.new===0?'No hay solicitudes nuevas':counts.new+' solicitud(es) nueva(s)'}</strong><small>Recuento de todas las solicitudes nuevas del servidor y ${counts.unassigned} trabajos sin operario en total, no solo los últimos 150. Consulta ambas bandejas por páginas; los avisos por correo dependen de una configuración externa.</small></div><div class="staff-queue-actions"><button type="button" data-admin-filter="new">Ver nuevas</button><button type="button" data-admin-filter="unassigned">Ver sin operario</button><button type="button" data-reload-staff>Actualizar solicitudes</button></div></div>`:''}
    <div class="staff-summary">
      <div><strong>${counts.all}</strong><small>Trabajos totales</small></div>
      <div><strong>${counts.pending}</strong><small>Pendientes</small></div>
      <div><strong>${counts.agenda}</strong><small>Programados / en curso</small></div>
      ${admin?'<div><strong>'+counts.unassigned+'</strong><small>Sin operario (total)</small></div>':
      '<div><strong>'+counts.finished+'</strong><small>Terminados</small></div>'}
    </div>
    <div class="staff-filters" role="group" aria-label="Filtrar trabajos">${jobFilters.filter(f=>admin||f.id!=='unassigned').map(f=>`<button type="button" data-admin-filter="${f.id}" aria-pressed="${filter===f.id}">${esc(f.label)} (${tabCounts[f.id]})</button>`).join('')}</div>
    ${(!admin||!['new','unassigned'].includes(filter))?`<form class="staff-work-search" data-staff-work-search>
      <label>Buscar por<select name="field" aria-label="Campo de búsqueda de trabajos">
        <option value="service_name" ${staffSearchField==='service_name'?'selected':''}>Servicio</option>
        <option value="city" ${staffSearchField==='city'?'selected':''}>Población</option>
        <option value="phone" ${staffSearchField==='phone'?'selected':''}>Teléfono</option>
      </select></label>
      <label>Localizar trabajos<input type="search" name="term" maxlength="64" autocomplete="off"
        aria-label="Buscar servicios en el historial" placeholder="Introduce servicio, población o teléfono"
        value="${esc(staffSearchTerm)}"></label>
      <button type="submit">Buscar</button>
      <button type="button" data-staff-search-clear>Mostrar todos</button>
    </form>
    <p class="notice" data-staff-search-status role="status">${staffSearchTerm?
      filteredPage.count+' resultado(s) para «'+esc(staffSearchTerm)+'» en este filtro. Los indicadores de arriba muestran los totales generales.':
      'Busca en todo el historial del filtro abierto; se mantienen los totales generales.'}</p>`:''}
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
        <label>Fecha y hora (Cataluña)<input type="datetime-local" name="scheduled_at" value="${madridDateTimeInput(job.scheduled_at)}"></label>
        <div class="flex-actions"><button type="submit">Guardar cambios</button><button type="button" data-photos="${esc(job.id)}" data-owner="${esc(job.customer_id)}">Ver fotos</button><button type="button" data-staff-chat="${esc(job.customer_id)}" data-chat-service="${esc(job.service_name)}">💬 Chat</button></div>
      </form><div class="staff-documents-toolbar">
        <button type="button" data-doc-kind="order" data-doc-job="${esc(job.id)}">Orden de trabajo</button>
        ${admin?'<button type="button" data-doc-kind="quote" data-doc-job="'+esc(job.id)+'">Vista de presupuesto</button>':''}
        ${admin && job.status==='completed' && job.price!=null ? '<button type="button" data-billing-start="'+esc(job.id)+'">🧾 Preparar borrador de factura</button>' : ''}
      </div><div class="staff-document-host" data-document-host="${esc(job.id)}"></div>
      <div class="photo-links" data-photo-output="${esc(job.id)}"></div>
    </article>`).join('')||'<section class="card"><p>No hay solicitudes en esta vista.</p></section>'}
    ${admin && filter==='new'?`<nav class="staff-new-pagination" aria-label="Páginas de solicitudes nuevas"><span>Página ${newRequestsPage+1} de ${Math.max(1,newRequestsPageCount(counts.new))} · ${counts.new} solicitudes nuevas en total</span><div><button type="button" data-new-page="prev" ${newRequestsPage===0?'disabled':''}>← Anterior</button><button type="button" data-new-page="next" ${canAdvanceNewRequests(newRequestsPage,counts.new)?'':'disabled'}>Siguiente →</button></div></nav>`:''}
    ${admin && filter==='unassigned'?`<nav class="staff-new-pagination" aria-label="Páginas de trabajos sin operario"><span>Página ${unassignedRequestsPage+1} de ${Math.max(1,newRequestsPageCount(counts.unassigned))} · ${counts.unassigned} trabajos sin operario en total</span><div><button type="button" data-unassigned-page="prev" ${unassignedRequestsPage===0?'disabled':''}>← Anterior</button><button type="button" data-unassigned-page="next" ${canAdvanceNewRequests(unassignedRequestsPage,counts.unassigned)?'':'disabled'}>Siguiente →</button></div></nav>`:''}
    ${(!admin||!['new','unassigned'].includes(filter))?`<nav class="staff-new-pagination" aria-label="Páginas del historial de trabajos"><span>Página ${staffWorkPage+1} de ${staffWorkPageCount(filteredPage.count)} · ${filteredPage.count} trabajos en este filtro</span><div><button type="button" data-staff-work-page="prev" ${staffWorkPage===0?'disabled':''}>← Anterior</button><button type="button" data-staff-work-page="next" ${staffWorkCanAdvance(staffWorkPage,filteredPage.count)?'':'disabled'}>Siguiente →</button></div></nav>`:''}`;
    const staffSearchForm=main.querySelector('[data-staff-work-search]');
    staffSearchForm?.addEventListener('submit',event=>{
      event.preventDefault();
      if(!isCurrentUser(staffUserId)||currentView!=='admin')return;
      const field=staffSearchForm.elements.namedItem('field')?.value;
      staffSearchField=staffWorkSearchFields.includes(field)?field:'service_name';
      staffSearchTerm=staffWorkSearchTerm(staffSearchForm.elements.namedItem('term')?.value);
      staffWorkPage=0;
      void renderAdmin(filter);
    });
    main.querySelector('[data-staff-search-clear]')?.addEventListener('click',()=>{
      if(!isCurrentUser(staffUserId)||currentView!=='admin')return;
      staffSearchTerm='';staffSearchField='service_name';staffWorkPage=0;
      void renderAdmin(filter);
    });
    main.querySelectorAll('[data-admin-filter]').forEach(btn=>btn.addEventListener('click',()=>{
      if(btn.dataset.adminFilter!==adminFilter){
        newRequestsPage=0;
        unassignedRequestsPage=0;
        staffWorkPage=0;
        staffSearchTerm='';
        staffSearchField='service_name';
      }
      renderAdmin(btn.dataset.adminFilter);
    }));
    main.querySelectorAll('[data-reload-staff]').forEach(btn=>btn.addEventListener('click',()=>renderAdmin(adminFilter)));
    main.querySelector('[data-staff-work-page="prev"]')?.addEventListener('click',()=>{
      if(staffWorkPage>0){staffWorkPage--;renderAdmin(filter)}
    });
    main.querySelector('[data-staff-work-page="next"]')?.addEventListener('click',()=>{
      if(staffWorkCanAdvance(staffWorkPage,filteredPage.count)){
        staffWorkPage++;renderAdmin(filter)
      }
    });
    main.querySelector('[data-new-page="prev"]')?.addEventListener('click',()=>{
      if(newRequestsPage>0){newRequestsPage--;renderAdmin('new')}
    });
    main.querySelector('[data-new-page="next"]')?.addEventListener('click',()=>{
      if(canAdvanceNewRequests(newRequestsPage,counts.new)){newRequestsPage++;renderAdmin('new')}
    });
    main.querySelector('[data-unassigned-page="prev"]')?.addEventListener('click',()=>{
      if(unassignedRequestsPage>0){unassignedRequestsPage--;renderAdmin('unassigned')}
    });
    main.querySelector('[data-unassigned-page="next"]')?.addEventListener('click',()=>{
      if(canAdvanceNewRequests(unassignedRequestsPage,counts.unassigned)){unassignedRequestsPage++;renderAdmin('unassigned')}
    });
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
    const staffSaves=new Set();
    main.querySelectorAll('form[data-job-id]').forEach(form=>form.addEventListener('submit',async e=>{
      e.preventDefault();
      const jobId=form.dataset.jobId,saveButton=form.querySelector('[type=submit]');
      if(!isCurrentUser(staffUserId)||!form.isConnected||staffSaves.has(jobId))return;
      staffSaves.add(jobId);
      if(saveButton)saveButton.disabled=true;
      try{
      const fields=new FormData(form);
      const status=String(fields.get('status'));
      if(!admin){
        const original=all.find(j=>j.id===form.dataset.jobId);
        if(!original)return message('Solicitud no encontrada.',true);
        const allowed=operatorMaySetStatus(original.status,status);
        if(!allowed)return message('El operario no puede realizar esta transición.',true);
        const {error}=await supabase.from('service_requests').update({status}).eq('id',jobId);
        if(!isCurrentUser(staffUserId)||currentView!=='admin'||!form.isConnected)return;
        if(error)message('No se pudo guardar el estado. Comprueba la conexión e inténtalo de nuevo.',true);
        else {await renderAdmin(filter);message('Estado del trabajo actualizado.');}
        return;
      }
      const original=all.find(j=>j.id===jobId);
      if(!original)return message('La solicitud ya no está disponible. Actualiza el panel.',true);
      if(status==='accepted'&&original.status!=='accepted')
        return message('La aceptación de un presupuesto debe realizarla el cliente desde Mis solicitudes.',true);
      if(['scheduled','in_progress','completed'].includes(status)&&
         !['accepted','scheduled','in_progress','completed'].includes(original.status))
        return message('Antes de programar o finalizar el trabajo, el cliente debe aceptar el presupuesto.',true);
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
      const visitTime=madridVisitDateTimeToIso(date,original.scheduled_at);
      if(visitTime.error)return message('Fecha y hora no válidas. '+visitTime.error,true);
      const stamp=visitTime.iso?new Date(visitTime.iso):null;
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
        if(!isCurrentUser(staffUserId)||currentView!=='admin'||!form.isConnected)return;
        if(appointments.error)
          return message('No se pudo comprobar la agenda del operario. No se ha guardado la programación.',true);
        const existing=sameOperatorSlot(appointments.data,{
          requestId:form.dataset.jobId,operatorId:operator_id,scheduledAt:stamp.toISOString()
        });
        if(existing.length)
          return message('El operario ya tiene una visita a menos de '+staffVisitGapMinutes+' minutos. Selecciona otra hora u otro operario.',true);
      }
      const operator=operators.find(op=>op.id===operator_id);
      const {error}=await supabase.from('service_requests').update({
        status,price:quotedPrice,operator_id,operator_name:operator?.full_name||null,scheduled_at:stamp?stamp.toISOString():null
      }).eq('id',jobId);
      if(!isCurrentUser(staffUserId)||currentView!=='admin'||!form.isConnected)return;
      if(error){
        // Postgres V7: error transaccional, incluso con dos administradores
        // guardando en paralelo. No anunciar cambios cuando el servidor falla.
        if(error.code==='23P01'||error.message?.includes('REPARADO_SCHEDULE_CONFLICT'))
          return message('No se ha programado: otro administrador acaba de reservar una visita de ese operario a menos de 60 minutos. Actualiza el panel y elige otra hora.',true);
        if(error.code==='23514' && error.message?.includes('REPARADO_ACCEPTED_QUOTE_PRICE_LOCKED'))
          return message('No puedes cambiar el importe de un presupuesto ya aceptado. Cualquier modificación requiere un nuevo presupuesto con aceptación expresa, conservando el anterior.',true);
        if(error.code==='23514' && error.message?.includes('REPARADO_ACCEPTANCE_REQUIRES_CUSTOMER'))
          return message('Solo el cliente puede aceptar su presupuesto desde Mis solicitudes.',true);
        if(error.code==='23514' && error.message?.includes('REPARADO_QUOTE_MUST_BE_ACCEPTED_FIRST'))
          return message('No se puede programar o finalizar un trabajo sin la aceptación del presupuesto.',true);
        if(error.code==='23514' && error.message?.includes('REPARADO_ACCEPTED_QUOTE_CANNOT_REOPEN'))
          return message('Un presupuesto ya aceptado no se puede volver a abrir ni modificar.',true);
        if(error.message?.includes('REPARADO_SCHEDULE_OPERATOR_REQUIRED')||
           error.message?.includes('REPARADO_SCHEDULE_INVALID_OPERATOR'))
          return message('No se ha guardado: revisa el operario y la fecha de la visita.',true);
        return message('No se han podido confirmar los cambios. Revisa los datos y tu conexión.',true);
      }
      await renderAdmin(filter);
      message('Solicitud actualizada.');
      }catch{
        if(isCurrentUser(staffUserId)&&currentView==='admin')
          message('No se pudo confirmar el cambio. Revisa el estado del trabajo antes de volver a guardar.',true);
      }finally{
        staffSaves.delete(jobId);
        if(saveButton?.isConnected)saveButton.disabled=false;
      }
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
    // V60: preparar, guardar y recuperar borradores fiscales privados.
    // Solo administración; NO crea facturas fiscales ni asigna números.
    main.querySelectorAll('[data-billing-start]').forEach(button=>button.addEventListener('click',()=>{
      if(currentView!=='admin'||profile?.role!=='admin'||!isCurrentUser(staffUserId))return;
      const job=all.find(x=>String(x.id)===button.dataset.billingStart);
      const host=button.closest('.job-card')?.querySelector('[data-document-host]');
      if(!host||!job||job.status!=='completed'||job.price==null)
        return message('Solo se pueden preparar borradores de trabajos terminados y valorados.',true);
      main.querySelectorAll('[data-document-host]').forEach(other=>other.replaceChildren());
      host.innerHTML='<div class="staff-documents-toolbar"><button type="button" data-close-billing>Cerrar preparación</button>'+
        '<button type="button" data-load-billing>Recuperar borrador guardado</button></div>'+
        billingDraftFormMarkup(job);
      host.querySelector('[data-close-billing]').addEventListener('click',()=>host.replaceChildren());
      const draftForm=host.querySelector('[data-billing-draft-form]');
      const feedback=host.querySelector('[data-billing-feedback]');
      const preview=host.querySelector('[data-billing-preview]');
      const available=()=>currentView==='admin'&&profile?.role==='admin'&&
        isCurrentUser(staffUserId)&&host.isConnected&&draftForm.isConnected;
      const load=host.querySelector('[data-load-billing]');
      load.addEventListener('click',async()=>{
        if(!available()||load.disabled)return;
        load.disabled=true;
        feedback.textContent='Consultando borrador privado…';
        try{
          const fields=await readPrivateBillingDraft({supabase,job});
          if(!available())return;
          if(!fields){
            feedback.textContent='No hay ningún borrador guardado para este trabajo.';
            return;
          }
          for(const [name,value] of Object.entries(fields)){
            const input=draftForm.elements.namedItem(name);
            if(input&&'value' in input)input.value=String(value??'');
          }
          preview.replaceChildren();
          feedback.textContent='Borrador privado recuperado. Revisa los datos y vuelve a preparar la vista antes de imprimir.';
        }catch{
          if(available())feedback.textContent='No se pudo recuperar el borrador o no coincide con el trabajo actual.';
        }finally{if(load.isConnected)load.disabled=false}
      });
      // Cualquier edición invalida la vista previa: impedir guardar datos
      // distintos a los que el administrador revisó en pantalla.
      draftForm.addEventListener('input',()=>{
        preview.replaceChildren();
        feedback.textContent='Cambios pendientes: vuelve a preparar el borrador.';
      });
      draftForm.addEventListener('submit',event=>{
        event.preventDefault();
        if(!available())return;
        preview.replaceChildren();
        try{
          const fields=Object.fromEntries(new FormData(draftForm));
          const draft=billingDraftDocument(job,fields);
          preview.innerHTML='<div class="staff-documents-toolbar"><button type="button" data-print-billing>Imprimir / guardar borrador PDF</button>'+
            '<button type="button" data-save-billing>Guardar borrador privado</button></div>'+draft;
          preview.querySelector('[data-print-billing]').addEventListener('click',()=>{
            if(typeof window.print==='function')window.print();
            else feedback.textContent='Este navegador no permite imprimir el borrador.';
          });
          const save=preview.querySelector('[data-save-billing]');
          save.addEventListener('click',async()=>{
            if(!available()||save.disabled||!save.isConnected)return;
            save.disabled=true;
            feedback.textContent='Guardando borrador privado…';
            try{
              await savePrivateBillingDraft({supabase,job,fields});
              if(available())feedback.textContent='Borrador privado guardado en Supabase. No es una factura emitida.';
            }catch{
              if(available())feedback.textContent='No se ha confirmado el guardado. Comprueba la conexión y recupera el borrador antes de reintentar.';
            }finally{if(save.isConnected)save.disabled=false}
          });
          feedback.textContent='Borrador preparado. Puedes guardarlo de forma privada; no tiene número ni validez fiscal.';
        }catch(error){
          feedback.textContent=error.message||'No se pudo validar el borrador.';
        }
      });
    }));
    main.querySelectorAll('[data-staff-chat]').forEach(button=>button.addEventListener('click',()=>loadStaffChat(button.dataset.staffChat,button.dataset.chatService)));
    main.querySelectorAll('[data-photos]').forEach(button=>button.addEventListener('click',async()=>{
      const out=main.querySelector(`[data-photo-output="${button.dataset.photos}"]`);
      if(!out||button.disabled||!isCurrentUser(staffUserId))return;
      button.disabled=true;
      out.textContent='Buscando fotografías…';
      const folder=`${button.dataset.owner}/${button.dataset.photos}`;
      try{
        const {data,error}=await supabase.storage.from('request-photos').list(folder,{limit:50});
        if(!isCurrentUser(staffUserId)||currentView!=='admin'||!out.isConnected)return;
        if(error)throw error;
        out.replaceChildren();
        if(!data?.length){out.textContent='Sin fotos disponibles.';return}
        for(const photo of data){
          if(!photo.name || photo.name.startsWith('.'))continue;
          const signed=await supabase.storage.from('request-photos').createSignedUrl(`${folder}/${photo.name}`,120);
          if(!isCurrentUser(staffUserId)||currentView!=='admin'||!out.isConnected)return;
          if(signed.error||!signed.data?.signedUrl)continue;
          const a=document.createElement('a');a.href=signed.data.signedUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='📷 Ver fotografía';out.append(a);
        }
        if(!out.children.length)out.textContent='No hay fotos accesibles.';
      }catch{
        if(isCurrentUser(staffUserId)&&currentView==='admin'&&out.isConnected)
          out.textContent='No se pudieron consultar las fotografías. Comprueba la conexión.';
      }finally{button.disabled=false}
    }));
  }
  supabase.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT'){
      authEpoch++;
      void pushManager.suspend();
      session=null;profile=null;passwordSetupPending=false;syncOwnerAccess();
      customerChatPage=0;pendingService=null;pendingView=null;renderHome();
    }else if(event==='PASSWORD_RECOVERY'){
      authEpoch++;
      passwordSetupPending=true;
      queueMicrotask(()=>boot());
    }else if(event==='SIGNED_IN'){
      authEpoch++;
      queueMicrotask(()=>boot());
    }
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
