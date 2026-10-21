import {requestStorageKey,profileStorageKey,messageDraftStorageKey,safeReadJSON,localRequests,localProfile,localWrite,localAgenda,localSummary,localDateLabel,validLocalDate} from './local-data.js';
import {localReceipt,localRequestBackup,localBackupName,historicalEvents,readableTimestamp} from './local-document.js';
import {makeLocalCollection,restoreLocalCollection,localBackupLimit} from './local-backup.js';

import {appHeader,bottomNavigation,renderLanding,renderCategory,serviceFormHeader,formPeriodPicker,priceFor,esc,setActiveNav,matchServices,serviceRow,featuredServices} from './customer-ui.js';

// La misma interfaz que verá el cliente: si faltan credenciales, se conservan
// solicitudes locales para probar la navegación, sin simular envíos a operarios.
export function mountLocal({app,services}){
  const storeKey=requestStorageKey,profileKey=profileStorageKey;
  const saved=()=>localRequests(localStorage);
  const profile=()=>localProfile(localStorage);
  const persist=items=>localWrite(localStorage,storeKey,items);
  let page='home',lastCategory=null,detailOrigin='requests';
  app.innerHTML='<div class="shell">'+appHeader({name:profile().name})+'<main id="main"></main><footer>© Reparado · Servicios para tu hogar</footer></div>'+bottomNavigation();
  const main=app.querySelector('#main');
  function home(){
    page='home';lastCategory=null;setActiveNav(app,'home');
    main.innerHTML=renderLanding(services);
    const input=main.querySelector('#category-search');
    input?.addEventListener('input',()=>{
      const term=input.value.trim().toLocaleLowerCase('es-ES');
      const matches=matchServices(services,term);
      main.querySelector('.popular-list').innerHTML=(term?matches:featuredServices(services))
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
      '<label>Dirección del servicio<input name="street" value="'+esc(p.street||'')+'" placeholder="Calle o avenida" required maxlength="120"></label>'+
      '<label>Número, piso y puerta<input name="address_number" value="'+esc(p.address_number||'')+'" required maxlength="80"></label>'+
      '<div class="row"><label>Código postal<input name="postal_code" value="'+esc(p.postal_code||'')+'" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" required></label><label>Municipio<input name="city" value="'+esc(p.city||'Barcelona')+'" required maxlength="90"></label></div>'+
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
      requests.unshift({id:globalThis.crypto?.randomUUID?.()||String(Date.now()),category:s[0],service:s[1],
        street:String(data.get('street')||''),address:String(data.get('address_number')||''),
        postal_code:String(data.get('postal_code')||''),city:String(data.get('city')||''),
        phone:String(data.get('phone')||''),description:String(data.get('description')||''),
        period:String(data.get('preferred_period')||''),date:String(data.get('preferred_date')||''),
        price:s[2],status:'Pendiente (local)',created_at:new Date().toISOString(),
        history:[{type:'created',at:new Date().toISOString()}]});
      if(!persist(requests)){
        main.querySelector('[data-feedback]').textContent='No se ha podido guardar. Comprueba el almacenamiento de este navegador y vuelve a intentarlo.';
        return;
      }
      main.innerHTML='<section class="card request-confirm"><h2>Solicitud guardada en este dispositivo</h2>'+
        '<p>Se ha guardado correctamente para probar la aplicación. Aún no se ha enviado a Reparado.</p>'+
        '<button class="primary-cta" data-view="requests">Ver mis solicitudes →</button></section>';
    });
  }
  function requestListItem(x){
    return '<article class="request local-item" data-local-item="'+esc(x.id)+'">'+
      '<div class="local-item-heading"><strong>'+esc(x.service||'Reparación')+'</strong><span class="local-label">Solo local</span></div>'+
      '<p>'+esc(x.street||'')+', '+esc(x.address||'')+' · '+esc(x.city||'')+'</p>'+
      '<small>'+esc(localDateLabel(x.date))+' · '+esc(x.period||'Horario sin indicar')+'</small>'+
      '<div class="flex-actions"><button type="button" data-local-detail="'+esc(x.id)+'">Ver detalles y editar</button></div></article>';
  }
  function requests(agenda=false){
    page=agenda?'agenda':'requests';setActiveNav(app,page);
    const all=saved(),summary=localSummary(all);
    const rows=agenda?localAgenda(all):all;
    main.innerHTML='<section class="card local-module"><h2>'+(agenda?'Mi agenda':'Mis solicitudes')+'</h2>'+
      '<p class="notice">Sin conexión al equipo. Las fechas son preferencias, no citas confirmadas.</p>'+
      '<div class="local-stats"><span><strong>'+summary.total+'</strong> solicitudes</span><span><strong>'+summary.withDate+'</strong> con fecha preferida</span></div>'+
      (agenda?'': '<div class="local-backup-tools"><h3>Mis copias de seguridad</h3><p class="notice">Exporta las solicitudes de este dispositivo o recupera una copia JSON. Contiene datos personales, guárdala de forma privada. No se envía a Reparado.</p>'+
        '<div class="flex-actions"><button type="button" data-export-all>Descargar copia de solicitudes</button><button type="button" data-import-all>Importar una copia</button></div>'+
        '<input id="local-import-file" type="file" accept=".json,application/json" hidden aria-label="Seleccionar una copia JSON">'+
        '<p data-backup-feedback role="status"></p></div>'+
        '<label class="local-search">Buscar solicitud<input type="search" id="local-request-search" placeholder="Servicio, municipio o calle"></label>')+
      '<div id="local-request-list">'+
      (rows.length?rows.map(requestListItem).join(''):'<p>'+(agenda?'No hay fechas preferidas registradas. Puedes elegir una desde los detalles de cualquier solicitud.':'Todavía no has guardado ninguna solicitud.')+'</p>')+'</div>'+
      (agenda && summary.withoutDate?'<p>'+summary.withoutDate+' solicitud(es) sin fecha elegida. <button type="button" data-view="requests">Ver todas las solicitudes</button></p>':'')+
      '<p class="notice">Estos datos se guardan solo en este dispositivo.</p></section>';
    const backupFeedback=main.querySelector('[data-backup-feedback]');
    main.querySelector('[data-export-all]')?.addEventListener('click',()=>{
      const records=saved();
      if(!records.length){backupFeedback.textContent='No tienes solicitudes que exportar.';return}
      try{
        const output=JSON.stringify(makeLocalCollection(records),null,2);
        const url=URL.createObjectURL(new Blob([output],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download='reparado-solicitudes-locales.json';
        document.body.append(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
        backupFeedback.textContent='Copia preparada. Contiene datos personales: guárdala en un lugar privado.';
      }catch(error){backupFeedback.textContent=error.message||'No se pudo preparar la copia.'}
    });
    const backupInput=main.querySelector('#local-import-file');
    main.querySelector('[data-import-all]')?.addEventListener('click',()=>backupInput?.click());
    backupInput?.addEventListener('change',async()=>{
      const file=backupInput.files?.[0];
      if(!file)return;
      backupInput.value='';
      if(file.size>localBackupLimit){backupFeedback.textContent='La copia supera el tamaño máximo permitido.';return}
      try{
        const restored=restoreLocalCollection(await file.text(),saved());
        if(!restored.added){
          backupFeedback.textContent=restored.duplicates?
            'No se añadieron solicitudes: ya estaban guardadas en este dispositivo.':'La copia no contiene solicitudes nuevas.';
          return;
        }
        if(!window.confirm('Se importarán '+restored.added+' solicitudes. Se conservarán las existentes. ¿Continuar?'))return;
        if(!persist(restored.requests)){backupFeedback.textContent='No se pudo guardar la copia en este dispositivo.';return}
        requests();
        main.querySelector('[data-backup-feedback]').textContent=
          'Importadas '+restored.added+' solicitudes locales. Duplicados omitidos: '+restored.duplicates+'. No se han enviado al equipo.';
      }catch(error){backupFeedback.textContent=error.message||'No se pudo importar la copia.'}
    });
    const search=main.querySelector('#local-request-search');
    search?.addEventListener('input',()=>{
      const text=search.value.trim().toLocaleLowerCase('es-ES');
      let visible=0;
      main.querySelectorAll('[data-local-item]').forEach(row=>{
        const item=all.find(x=>String(x.id)===row.dataset.localItem);
        const hit=!text||[item?.service,item?.category,item?.street,item?.city].some(v=>String(v||'').toLocaleLowerCase('es-ES').includes(text));
        row.hidden=!hit;if(hit)visible++;
      });
      let note=main.querySelector('#local-search-empty');
      if(!note){note=document.createElement('p');note.id='local-search-empty';main.querySelector('#local-request-list').append(note)}
      note.hidden=visible!==0||!text;
      note.textContent='No hay solicitudes que coincidan con la búsqueda.';
    });
  }
  function requestDetail(id,origin='requests'){
    const x=saved().find(row=>String(row.id)===String(id));
    if(!x)return requests(origin==='agenda');
    detailOrigin=origin;page='request-detail';setActiveNav(app,origin);
    main.innerHTML='<section class="card local-module"><button type="button" class="screen-back" data-back>← Volver</button>'+
      '<h2>Detalle de la solicitud</h2>'+
      '<p class="notice">Borrador guardado solo en este dispositivo. No se ha enviado ni hay una cita confirmada.</p>'+
      '<div class="local-item-heading"><strong>'+esc(x.service)+'</strong><span class="local-label">Solo local</span></div>'+
      '<p><b>Categoría:</b> '+esc(x.category)+'</p>'+
      '<p><b>Dirección:</b> '+esc([x.street,x.address,x.postal_code,x.city].filter(Boolean).join(', '))+'</p>'+
      '<p><b>Teléfono:</b> '+esc(x.phone||'No indicado')+'</p>'+
      '<p><b>Descripción:</b> '+esc(x.description||'No indicada')+'</p>'+
      '<p><b>Precio:</b> '+(Number(x.price)>0?esc(Number(x.price).toFixed(2).replace('.',',')+' € · orientativo, IVA incluido'):'Por presupuesto')+'</p>'+
      '<h3>Seguimiento de esta solicitud</h3>'+
      '<p class="notice">Historial local de las acciones realizadas en este dispositivo; no refleja asignaciones ni trabajos del equipo.</p>'+
      '<ol class="local-timeline">'+(historicalEvents(x).length
        ?historicalEvents(x).map(ev=>'<li><strong>'+esc(ev.label)+'</strong><small>'+esc(readableTimestamp(ev.at))+'</small></li>').join('')
        :'<li>Esta solicitud se guardó antes de activar el historial. No consta la fecha original.</li>')+'</ol>'+
      '<h3>Documentos de la solicitud</h3>'+
      '<div class="local-doc-actions"><button type="button" data-local-print>Imprimir resguardo</button>'+
      '<button type="button" data-local-export="'+esc(x.id)+'">Guardar copia JSON</button></div>'+
      '<p class="notice">El resguardo no es una factura. La copia contiene teléfono y dirección: guárdala de forma segura.</p>'+
      localReceipt(x)+
      '<h3>Preferencias de visita</h3><form id="local-edit-request">'+
      '<label>Fecha preferida<input type="date" name="preferred_date" value="'+esc(validLocalDate(x.date)?x.date:'')+'"></label>'+
      '<label>Horario<select name="preferred_period"><option value="Mañana (9:00–13:00)">Mañana (9:00–13:00)</option><option value="Tarde (13:00–17:00)">Tarde (13:00–17:00)</option><option value="Indiferente">Indiferente</option></select></label>'+
      '<button type="submit" class="primary-cta">Guardar preferencias</button></form>'+
      '<div class="flex-actions"><button type="button" class="local-delete" data-local-delete="'+esc(x.id)+'">Eliminar solicitud local</button></div>'+
      '<p data-feedback role="status"></p></section>';
    const form=main.querySelector('#local-edit-request');
    form.elements.preferred_period.value=['Mañana (9:00–13:00)','Tarde (13:00–17:00)','Indiferente'].includes(x.period)?x.period:'Indiferente';
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const date=form.elements.preferred_date.value;
      if(date && !validLocalDate(date)){main.querySelector('[data-feedback]').textContent='La fecha no es válida.';return}
      const all=saved();
      const index=all.findIndex(row=>String(row.id)===String(id));
      if(index<0){requests();return}
      const prior=all[index],period=form.elements.preferred_period.value;
      if(prior.date===date && prior.period===period){
        main.querySelector('[data-feedback]').textContent='No hay cambios que guardar.';return;
      }
      const now=new Date().toISOString();
      const timeline=Array.isArray(prior.history)?prior.history.filter(ev=>ev&&typeof ev==='object').slice(-28):[];
      timeline.push({type:'preferences_changed',at:now});
      all[index]={...prior,date,period,updated_at:now,history:timeline};
      if(!persist(all)){main.querySelector('[data-feedback]').textContent='No se han guardado los cambios. Comprueba el almacenamiento.';return}
      requestDetail(id,detailOrigin);
      main.querySelector('[data-feedback]').textContent='Preferencias actualizadas en este dispositivo. La cita no está confirmada.';
    });
  }
  function chat(){
    page='chat';setActiveNav(app,'chat');
    const draft=String(safeReadJSON(localStorage,messageDraftStorageKey,'')||'');
    main.innerHTML='<section class="card local-module"><h2>Chat con Reparado</h2>'+
      '<p class="notice">La mensajería con el equipo aún no está conectada. Puedes guardar un borrador en este dispositivo, pero NO se enviará.</p>'+
      '<form id="contact-preview"><label>Borrador de mensaje<textarea name="body" maxlength="2000" required placeholder="Escribe tu consulta…">'+esc(draft)+'</textarea></label>'+
      '<button type="submit">Guardar borrador</button></form>'+
      '<button class="local-clear-draft" type="button" data-clear-chat-draft>Descartar borrador</button>'+
      '<p data-feedback role="status"></p></section>';
    main.querySelector('#contact-preview').onsubmit=e=>{
      e.preventDefault();
      const body=String(new FormData(e.currentTarget).get('body')||'').trim();
      main.querySelector('[data-feedback]').textContent=localWrite(localStorage,messageDraftStorageKey,body)
        ?'Borrador guardado solamente en este dispositivo. No se ha enviado.'
        :'No se ha podido guardar el borrador.';
    };
  }
  function profileScreen(){
    page='profile';setActiveNav(app,'profile');const p=profile();
    main.innerHTML='<section class="card local-module"><h2>Mi perfil</h2><form id="local-profile">'+
      '<label>Nombre y apellidos<input name="name" value="'+esc(p.name||'')+'" maxlength="100" autocomplete="name"></label>'+
      '<label>Teléfono<input name="phone" type="tel" value="'+esc(p.phone||'')+'" maxlength="25" autocomplete="tel"></label>'+
      '<h3>Dirección habitual (opcional)</h3>'+
      '<label>Calle<input name="street" value="'+esc(p.street||'')+'" maxlength="120"></label>'+
      '<label>Número, piso y puerta<input name="address_number" value="'+esc(p.address_number||'')+'" maxlength="80"></label>'+
      '<div class="row"><label>Código postal<input name="postal_code" value="'+esc(p.postal_code||'')+'" inputmode="numeric" pattern="[0-9]{5}" maxlength="5"></label>'+
      '<label>Municipio<input name="city" value="'+esc(p.city||'Barcelona')+'" maxlength="90"></label></div>'+
      '<button type="submit">Guardar perfil</button></form><p data-feedback role="status"></p>'+
      '<p class="notice">El perfil solo se guarda en este dispositivo. Se utilizará para rellenar futuras solicitudes.</p></section>';
    main.querySelector('#local-profile').onsubmit=e=>{
      e.preventDefault();const d=new FormData(e.currentTarget);
      const data=Object.fromEntries(['name','phone','street','address_number','postal_code','city'].map(key=>[key,String(d.get(key)||'').trim()]));
      if(localWrite(localStorage,profileKey,data)){
        main.querySelector('[data-feedback]').textContent='Perfil guardado en este dispositivo.';
      }else{
        main.querySelector('[data-feedback]').textContent='No se ha podido guardar el perfil.';
      }
    };
  }
  app.addEventListener('click',event=>{
    if(event.target.closest('[data-local-print]')){
      if(typeof window.print==='function')window.print();
      else main.querySelector('[data-feedback]').textContent='Tu navegador no permite imprimir esta pantalla.';
      return;
    }
    const exportButton=event.target.closest('[data-local-export]');
    if(exportButton){
      const request=saved().find(r=>String(r.id)===exportButton.dataset.localExport);
      if(!request){main.querySelector('[data-feedback]').textContent='No se encuentra esta solicitud.';return}
      try {
        const json=JSON.stringify(localRequestBackup(request),null,2);
        const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
        const link=document.createElement('a');
        link.href=url;link.download=localBackupName(request);
        document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
        main.querySelector('[data-feedback]').textContent='Copia local preparada. Contiene datos personales: guárdala de forma segura.';
      }catch{
        main.querySelector('[data-feedback]').textContent='No se ha podido preparar la copia.';
      }
      return;
    }
    const openDetail=event.target.closest('[data-local-detail]');
    if(openDetail)return requestDetail(openDetail.dataset.localDetail,page==='agenda'?'agenda':'requests');
    const deleteBtn=event.target.closest('[data-local-delete]');
    if(deleteBtn){
      if(!window.confirm('¿Eliminar esta solicitud del dispositivo? No se podrá recuperar.'))return;
      const next=saved().filter(row=>String(row.id)!==deleteBtn.dataset.localDelete);
      if(!persist(next)){main.querySelector('[data-feedback]').textContent='No se pudo eliminar la solicitud.';return}
      return requests(detailOrigin==='agenda');
    }
    if(event.target.closest('[data-clear-chat-draft]')){
      const cleared=localWrite(localStorage,messageDraftStorageKey,'');
      if(cleared){const input=main.querySelector('#contact-preview textarea');if(input)input.value=''}
      main.querySelector('[data-feedback]').textContent=cleared?'Borrador descartado.':'No se ha podido descartar el borrador.';
      return;
    }
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
    if(event.target.closest('[data-back]')){
      if(page==='request-detail')return requests(detailOrigin==='agenda');
      return page==='new-request' && lastCategory ? category(lastCategory) : home();
    }
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
