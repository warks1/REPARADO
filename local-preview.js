
import {appHeader,bottomNavigation,renderLanding,renderCategory,serviceFormHeader,formPeriodPicker,priceFor,esc,setActiveNav,matchServices,serviceRow} from './customer-ui.js';

// La misma interfaz que verá el cliente: si faltan credenciales, se conservan
// solicitudes locales para probar la navegación, sin simular envíos a operarios.
export function mountLocal({app,services}){
  const storeKey='reparado-local-requests';
  const profileKey='reparado-local-profile';
  const saved=()=>{try{return JSON.parse(localStorage.getItem(storeKey)||'[]')}catch{return []}};
  const profile=()=>{try{return JSON.parse(localStorage.getItem(profileKey)||'{}')}catch{return {}}};
  const persist=items=>localStorage.setItem(storeKey,JSON.stringify(items));
  let page='home',lastCategory=null;
  app.innerHTML='<div class="shell">'+appHeader({name:profile().name})+'<main id="main"></main><footer>© Reparado · Servicios para tu hogar</footer></div>'+bottomNavigation();
  const main=app.querySelector('#main');
  function home(){
    page='home';lastCategory=null;setActiveNav(app,'home');
    main.innerHTML=renderLanding(services);
    const input=main.querySelector('#category-search');
    input?.addEventListener('input',()=>{
      const term=input.value.trim().toLocaleLowerCase('es-ES');
      const matches=matchServices(services,term);
      main.querySelector('.popular-list').innerHTML=(term?matches: [0,2,3,7].map(i=>({s:services[i],i})))
        .map(({s,i})=>serviceRow(s,i)).join('');
      main.querySelectorAll('.category-tile').forEach(tile=>{
        tile.hidden=!matches.some(({s})=>s[0]===tile.dataset.categoryOpen);
      });
      main.querySelector('.no-results').hidden=matches.length>0;
    });
  }
  function category(id){
    page='category';lastCategory=id;setActiveNav(app,'home');
    main.innerHTML=renderCategory(services,id);
  }
  function request(item){
    page='new-request';setActiveNav(app,'requests');
    const p=profile();
    const s=item||['Reformas integrales','Consulta personalizada',0];
    main.innerHTML='<div class="request-screen"><button class="screen-back" type="button" data-back>← Volver</button>'+
      '<section class="card"><h2>Nueva solicitud</h2>'+serviceFormHeader(s)+
      '<form id="local-request">'+
      '<label>Dirección del servicio<input name="street" placeholder="Calle o avenida" required maxlength="120"></label>'+
      '<label>Número, piso y puerta<input name="address_number" required maxlength="80"></label>'+
      '<div class="row"><label>Código postal<input name="postal_code" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" required></label><label>Municipio<input name="city" value="Barcelona" required maxlength="90"></label></div>'+
      '<label>Teléfono de contacto<input name="phone" type="tel" value="'+esc(p.phone||'')+'" required maxlength="25"></label>'+
      '<label>Descripción del problema<textarea name="description" placeholder="Cuéntanos qué necesitas reparar..." maxlength="1800" required></textarea></label>'+
      '<label>Fotos (opcional)<input name="photos" type="file" accept="image/*" multiple></label>'+
      '<label>Fecha preferida<input name="preferred_date" type="date"></label>'+formPeriodPicker()+
      '<button type="submit">Guardar solicitud '+ '→</button></form>'+
      '<p class="notice">Puedes probar el proceso completo. Sin conexión a Supabase, las solicitudes se guardan solo en este dispositivo y no se envían al equipo.</p>'+
      '<p data-feedback role="status"></p></section></div>';
    main.querySelector('#local-request').addEventListener('submit',e=>{
      e.preventDefault();
      const data=new FormData(e.currentTarget);
      const selected=e.currentTarget.elements.photos?.files;
      if(selected?.length) {
        main.querySelector('[data-feedback]').textContent='Las fotos requieren conectar el almacenamiento privado. Puedes guardar el resto de la solicitud.';
      }
      const requests=saved();
      requests.unshift({id:String(Date.now()),category:s[0],service:s[1],
        street:String(data.get('street')||''),address:String(data.get('address_number')||''),
        postal_code:String(data.get('postal_code')||''),city:String(data.get('city')||''),
        phone:String(data.get('phone')||''),description:String(data.get('description')||''),
        period:String(data.get('preferred_period')||''),date:String(data.get('preferred_date')||''),
        price:s[2],status:'Pendiente (local)'});
      persist(requests);
      main.innerHTML='<section class="card request-confirm"><h2>Solicitud guardada en este dispositivo</h2>'+
        '<p>Se ha guardado correctamente para probar la aplicación. Aún no se ha enviado a Reparado.</p>'+
        '<button class="primary-cta" data-view="requests">Ver mis solicitudes →</button></section>';
    });
  }
  function requests(agenda=false){
    page=agenda?'agenda':'requests';setActiveNav(app,page);
    const all=saved();const rows=agenda?all.filter(x=>x.date):all;
    main.innerHTML='<section class="card"><h2>'+(agenda?'Mi agenda':'Mis solicitudes')+'</h2>'+
      (rows.length?rows.map(x=>'<article class="request"><strong>'+esc(x.service)+'</strong><span>'+esc(x.status)+'</span>'+
      '<p>'+esc(x.street)+', '+esc(x.address)+' · '+esc(x.city)+'</p>'+
      '<small>'+esc(x.date||'Sin fecha seleccionada')+' · '+esc(x.period||'Horario por confirmar')+'</small></article>').join(''):
      '<p>'+(agenda?'Todavía no hay fechas solicitadas.':'Todavía no has guardado ninguna solicitud.')+'</p>')+
      '<p class="notice">Estos datos son locales hasta conectar el servidor de Reparado.</p></section>';
  }
  function chat(){
    page='chat';setActiveNav(app,'chat');
    main.innerHTML='<section class="card"><h2>Chat con Reparado</h2><p>Podrás hablar con nuestro equipo desde aquí cuando la conexión de atención al cliente esté activa.</p>'+
      '<form id="contact-preview"><label>Tu mensaje<textarea name="body" required placeholder="Escribe tu consulta…"></textarea></label>'+
      '<button type="submit">Enviar mensaje</button></form><p data-feedback role="status"></p></section>';
    main.querySelector('#contact-preview').onsubmit=e=>{e.preventDefault();main.querySelector('[data-feedback]').textContent='No se ha enviado el mensaje: falta conectar Supabase.'};
  }
  function profileScreen(){
    page='profile';setActiveNav(app,'profile');const p=profile();
    main.innerHTML='<section class="card"><h2>Mi perfil</h2><form id="local-profile">'+
      '<label>Nombre y apellidos<input name="name" value="'+esc(p.name||'')+'" maxlength="100"></label>'+
      '<label>Teléfono<input name="phone" type="tel" value="'+esc(p.phone||'')+'" maxlength="25"></label>'+
      '<button type="submit">Guardar perfil</button></form><p data-feedback role="status"></p>'+
      '<p class="notice">Para crear una cuenta real y sincronizar tus datos entre dispositivos, es necesario activar el servicio de cuentas.</p></section>';
    main.querySelector('#local-profile').onsubmit=e=>{
      e.preventDefault();const d=new FormData(e.currentTarget);
      localStorage.setItem(profileKey,JSON.stringify({name:d.get('name'),phone:d.get('phone')}));
      main.querySelector('[data-feedback]').textContent='Perfil guardado en este dispositivo.';
    };
  }
  app.addEventListener('click',event=>{
    const expand=event.target.closest('[data-expand-services]');
    if(expand){
      const opened=expand.getAttribute('aria-expanded')==='true';
      main.querySelectorAll('.category-services .service-extra').forEach(btn=>{btn.hidden=opened});
      expand.setAttribute('aria-expanded',String(!opened));
      expand.innerHTML=opened?'Ver todos los servicios →':'Mostrar menos servicios ↑';
      return;
    }
    const filterButton=event.target.closest('[data-toggle-filters]');
    if(filterButton){
      const panel=main.querySelector('#category-quick-filters');
      if(panel){panel.hidden=!panel.hidden;filterButton.setAttribute('aria-expanded',String(!panel.hidden))}
      return;
    }
    const service=event.target.closest('[data-service]');
    if(service)return request(services[Number(service.dataset.service)]);
    const categoryBtn=event.target.closest('[data-category-open]');
    if(categoryBtn)return category(categoryBtn.dataset.categoryOpen);
    const custom=event.target.closest('[data-custom-request]');
    if(custom){lastCategory=custom.dataset.customRequest;return request([lastCategory,'Consulta personalizada',0])}
    if(event.target.closest('[data-show-all]')){main.querySelector('.category-grid')?.scrollIntoView({behavior:'smooth'});return}
    if(event.target.closest('[data-back]'))return page==='new-request' && lastCategory ? category(lastCategory) : home();
    const tab=event.target.closest('[data-view]');
    if(tab){
      switch(tab.dataset.view){
        case 'home':home();break;
        case 'requests':requests();break;
        case 'agenda':requests(true);break;
        case 'chat':chat();break;
        case 'profile':profileScreen();break;
      }
    }
  });
  home();
}
