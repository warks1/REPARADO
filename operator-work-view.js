// REPARADO V100 · Pantalla privada del parte de servicio.
// Solo operario asignado edita; el propietario consulta partes y evidencias.
import {
  fetchWorkReport,fetchWorkReports,fetchWorkTransfers,
  listWorkPhotos,startOperatorWork,saveOperatorWorkDescription,
  completeOperatorWork,uploadOperatorWorkPhotos,
  mayStartWork,mayFinishWork,MAX_WORK_PHOTOS,WORK_DESCRIPTION_MAX
} from './operator-work-service.js';
import {bindWorkPhotoRetry} from './work-photo-recovery.js';
import {workNotesDirty,confirmWorkNotesExit} from './work-notes-draft.js';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
const displayTime=value=>{
  const d=new Date(value||'');
  return Number.isFinite(d.getTime())
    ?new Intl.DateTimeFormat('es-ES',{
      timeZone:'Europe/Madrid',dateStyle:'medium',timeStyle:'short'
    }).format(d):'Sin registrar';
};
function viewMarkup(job,report,photos,{userId,role,preserve='',history=[],transfers=[]}) {
  const canEdit=role==='operator'&&job.operator_id===userId;
  const start=canEdit&&mayStartWork(job,userId);
  const finish=canEdit&&mayFinishWork(job,userId)&&Boolean(report);
  const needsOpen=start&&(job.status==='scheduled'||!report);
  const ended=job.status==='completed';
  const description=preserve||report?.description||'';
  return '<section class="card operator-work-view" id="reparado-operator-work">'+
    '<button type="button" class="screen-back" data-work-back>← Volver a los servicios</button>'+
    '<p class="owner-eyebrow">PARTE DE TRABAJO · REPARADO</p>'+
    '<h1>'+esc(job.service_name)+'</h1>'+
    '<p class="notice">Referencia: '+esc(job.id)+'</p>'+
    '<p><strong>Dirección:</strong> '+esc([job.street,job.address_number,job.city].filter(Boolean).join(', '))+'</p>'+
    '<p><strong>Solicitud:</strong> '+esc(job.description||'Sin observaciones')+'</p>'+
    '<div class="operator-work-meta"><span><strong>Estado:</strong> '+esc({
      scheduled:'Programado',in_progress:'En curso',completed:'Terminado'
    }[job.status]||job.status)+'</span>'+
    '<span><strong>Inicio:</strong> '+esc(displayTime(job.work_started_at||report?.created_at))+'</span>'+
    '<span><strong>Finalización:</strong> '+esc(displayTime(job.work_finished_at))+'</span></div>'+
    (needsOpen
      ?'<div class="operator-work-actions"><button type="button" data-work-start>'+
        (job.status==='scheduled'?'▶ Iniciar trabajo':'🧾 Preparar parte de trabajo')+'</button>'+
       '<p>'+(job.status==='scheduled'
         ?'Al iniciar quedará registrado en curso. Después podrás escribir el parte y subir fotos.'
         :'Este servicio ya estaba en curso. Prepara su parte sin cambiar de nuevo el estado; después añade notas y fotos.')+
       '</p></div>'
      :'')+
    (finish?'<label class="operator-work-notes">Descripción del trabajo realizado'+
      '<textarea name="work_description" rows="5" maxlength="'+WORK_DESCRIPTION_MAX+
      '" placeholder="Explica qué se ha reparado, comprobaciones, materiales y resultado..." required>'+esc(description)+'</textarea></label>'+
      '<p class="notice" role="status" aria-live="polite" data-work-draft-state></p>'+
      '<button type="button" data-work-save-notes>Guardar descripción</button>'
      :role==='admin'?'':'<div class="operator-work-readonly"><h2>Trabajo realizado</h2><p data-work-description>'+
       esc(report?.description|| (ended?'Pendiente de parte histórico.':'Aún no se ha iniciado.'))+'</p></div>')+
    (role==='admin'?'<section class="operator-work-history" data-work-history>'+
      '<h2>Historial completo de intervenciones</h2>'+
      (history.length?history.map(entry=>
        '<article class="operator-work-history-item" data-work-report-operator="'+esc(entry.operator_id)+'">'+
        '<p><strong>Operario:</strong> '+esc(entry.operator_label||entry.operator_id)+
        ' · <strong>Parte abierto:</strong> '+esc(displayTime(entry.created_at))+'</p>'+
        '<p><strong>Trabajo realizado:</strong> '+esc(entry.description||'Sin descripción guardada')+'</p>'+
        '<p>'+(entry.photoError?'Fotografías no disponibles: error de lectura o permisos.':entry.photoCount+' fotografía(s) de esta intervención')+'</p>'+
        '<div class="operator-work-gallery" data-work-gallery-operator="'+esc(entry.operator_id)+
        '" aria-label="Fotografías de '+esc(entry.operator_label||entry.operator_id)+'">'+
        (entry.photoError?'<p class="notice" role="status">No se pudieron consultar estas fotografías. Usa «Actualizar parte y fotografías» para reintentar.</p>':(entry.photoCount?'':'<p class="notice">Sin fotografías de esta intervención.</p>'))+
        '</div></article>'
      ).join(''):'<p>No hay partes de intervención registrados.</p>')+
      '<h3>Traspasos de operario</h3>'+
      (transfers.length?transfers.map(transfer=>
        '<p class="operator-work-transfer">'+esc(displayTime(transfer.changed_at))+
        ' · De '+esc(transfer.previous_operator_label||transfer.previous_operator_id||'Sin asignar')+
        ' a '+esc(transfer.next_operator_label||transfer.next_operator_id||'Sin asignar')+
        ' · '+esc(transfer.status_at_transfer)+'</p>'
      ).join(''):'<p>No se han registrado traspasos.</p>')+
      '</section>':'')+
    '<h2>Fotografías del trabajo</h2><p data-work-photo-count>'+
      (role==='admin'?(history.some(entry=>entry.photoError) ? photos.length+' fotografía'+(photos.length===1?'':'s')+' accesible'+(photos.length===1?'':'s')+' del historial · Algunas intervenciones tienen fotos pendientes de consultar.' : photos.length+' fotografías del historial'):
        photos.length+' de '+MAX_WORK_PHOTOS+' fotografías adjuntas')+'</p>'+
    (role==='admin'
      ?'<p class="notice">Cada fotografía se muestra en el parte del operario que la adjuntó.</p>'
      :'<div class="operator-work-gallery" data-work-gallery aria-label="Fotos del trabajo"></div>')+
    '<button type="button" data-work-refresh>↻ Actualizar parte y fotografías</button>'+
    (finish?'<div class="operator-work-upload">'+
      '<label>Seleccionar fotos del trabajo <input type="file" data-work-files multiple '+
      'accept="image/jpeg,image/png,image/webp,image/heic"></label>'+
      '<button type="button" data-work-upload>Subir fotos</button>'+
      '<label>Hacer una foto ahora (móvil)<input type="file" data-work-camera '+
      'capture="environment" accept="image/jpeg,image/png,image/webp,image/heic"></label>'+
      '<p class="notice">Hasta 8 fotos JPG, PNG, WEBP o HEIC (8 MB cada una). '+
      'Las imágenes son privadas y quedan vinculadas a este servicio.</p></div>'+
      '<div class="operator-work-close"><p>Para cerrar el servicio, '+
      'escribe al menos 20 caracteres y sube al menos una foto.</p>'+
      '<button type="button" data-work-finish>✓ Terminar y cerrar servicio</button></div>'
      :'')+
    '<p data-work-feedback role="status" aria-live="polite" class="feedback">'+
      (ended?'Servicio finalizado. El parte queda disponible para consulta.':
       role==='admin'?'Consulta privada del propietario.':
       job.status==='in_progress'?'Registra el trabajo antes de finalizar.':
       'Abre el servicio cuando comiences la intervención.')+'</p>'+
    '</section>';
}

export async function mountOperatorWork({main,supabase,requestId,userId,role,isActive,onBack,onNavigationGuard}){
  if(!isActive()||!UUID.test(String(requestId||''))||
    !UUID.test(String(userId||''))||!['admin','operator'].includes(role))return;
  main.innerHTML='<section class="card" data-work-loading><h2>Parte de trabajo</h2>'+
    '<p>Cargando servicio asignado…</p></section>';
  const active=()=>isActive()&&main.querySelector('#reparado-operator-work')!==null;
  let busy=false,screen=null,renderGeneration=0;
  async function render(preserve=''){
    if(!isActive())return;
    const generation=++renderGeneration,anchor=main.firstElementChild;
    const stillHere=()=>isActive()&&generation===renderGeneration&&
      main.firstElementChild===anchor;
    const query=supabase.from('service_requests')
      .select('id,service_name,status,operator_id,operator_name,street,address_number,city,description,scheduled_at,work_started_at,work_finished_at')
      .eq('id',requestId);
    if(role==='operator')query.eq('operator_id',userId);
    const response=await query.maybeSingle();
    if(!stillHere())return;
    if(response?.error||!response?.data){
      main.innerHTML='<section class="card"><h2>Parte de trabajo</h2>'+
        '<p>El servicio no está disponible para esta cuenta. Comprueba la conexión, los permisos y la migración V100.</p>'+
        '<button type="button" data-work-back>← Volver</button>'+
        '<button type="button" data-work-retry>↻ Reintentar carga</button></section>';
      main.querySelector('[data-work-back]')?.addEventListener('click',onBack);
      main.querySelector('[data-work-retry]')?.addEventListener('click',()=>{
        if(isActive())void render();
      });
      return;
    }
    const job=response.data;
    let report=null,photos=[],history=[],transfers=[];
    try{
      history=role==='admin'
        ?await fetchWorkReports({supabase,requestId,isActive})
        :[];
      if(role==='admin'){
        transfers=await fetchWorkTransfers({supabase,requestId,isActive});
        report=history.find(entry=>entry.operator_id===job.operator_id)||null;
      }else{
        report=await fetchWorkReport({
          supabase,requestId,operatorId:userId,isActive
        });
        if(report)history=[report];
      }
      if(role==='admin'&&(history.length||transfers.length)){
        const ids=[...new Set([
          ...history.map(entry=>entry.operator_id),
          ...transfers.flatMap(entry=>[
            entry.previous_operator_id,entry.next_operator_id
          ])
        ].filter(Boolean))];
        if(ids.length){
          const named=await supabase.from('profiles')
            .select('id,full_name').in('id',ids);
          if(!isActive())return;
          if(!named.error&&Array.isArray(named.data)){
            const names=new Map(named.data.map(op=>[
              op.id,op.full_name||op.id
            ]));
            history=history.map(entry=>({
              ...entry,operator_label:names.get(entry.operator_id)||entry.operator_id
            }));
            transfers=transfers.map(entry=>({
              ...entry,
              previous_operator_label:names.get(entry.previous_operator_id),
              next_operator_label:names.get(entry.next_operator_id)
            }));
          }
        }
      }
      for(const entry of history){
        let originals;
        try{
          originals=await listWorkPhotos({
            supabase,operatorId:entry.operator_id,requestId,isActive
          });
        }catch(error){
          if(!isActive())return;
          // Al propietario no se le ocultan partes ni traspasos por el
          // fallo de lectura de una galería. Al operario se le bloquea
          // la pantalla para no presentar fotos desconocidas como cero.
          if(role!=='admin')throw error;
          entry.photoCount=null;
          entry.photoError=true;
          continue;
        }
        if(!isActive())return;
        entry.photoCount=originals.length;
        photos.push(...originals.map(photo=>({
          name:photo.name,operator_id:entry.operator_id
        })));
      }
    }catch(error){
      if(!isActive())return;
      main.innerHTML='<section class="card"><h2>Parte de trabajo</h2>'+
        '<p data-work-error>'+esc(error.message)+'</p>'+
        '<button type="button" data-work-back>← Volver</button>'+
        '<button type="button" data-work-retry>↻ Reintentar carga</button></section>';
      main.querySelector('[data-work-back]')?.addEventListener('click',onBack);
      main.querySelector('[data-work-retry]')?.addEventListener('click',()=>{
        if(isActive())void render();
      });
      return;
    }
    if(!stillHere())return;
    main.innerHTML=viewMarkup(job,report,photos,{
      userId,role,preserve,history,transfers
    });
    screen=main.querySelector('#reparado-operator-work');
    const notes=screen.querySelector('[name="work_description"]');
    // La descripción confirmada se vuelve a consultar después de guardar.
    // Mientras se suben fotos, el texto local se conserva sin fingir que
    // se haya enviado también al servidor.
    const confirmedNotes=report?.description||'';
    const draftIndicator=screen.querySelector('[data-work-draft-state]');
    const updateDraftIndicator=()=>{
      if(!draftIndicator||!notes)return;
      draftIndicator.textContent=workNotesDirty(notes.value,confirmedNotes)
        ?'Cambios sin guardar. Guarda la descripción antes de salir.'
        :'Descripción sin cambios pendientes.';
    };
    notes?.addEventListener('input',updateDraftIndicator);
    updateDraftIndicator();
    const requestLeave=()=>{
      if(!active()||!screen.isConnected)return true;
      // No navegar mientras una escritura o subida está en curso.
      if(busy)return false;
      return confirmWorkNotesExit({
        draft:notes?.value,confirmed:confirmedNotes,
        confirmExit:message=>window.confirm(message)
      });
    };
    // El menú general está fuera de esta pantalla; la app principal debe
    // aplicar el mismo control que el botón Volver sin almacenar el borrador.
    onNavigationGuard?.({
      canLeave:requestLeave,
      hasUnsaved:()=>active()&&screen.isConnected&&
        workNotesDirty(notes?.value,confirmedNotes)
    });
    const show=text=>{
      if(active()){
        const feedback=main.querySelector('[data-work-feedback]');
        if(feedback)feedback.textContent=text;
      }
    };
    const transact=async(action,success,retain=false)=>{
      if(!active()||busy)return;
      busy=true;
      for(const btn of screen.querySelectorAll('[data-work-start],[data-work-save-notes],[data-work-upload],[data-work-finish]'))
        btn.disabled=true;
      show('Guardando cambios en REPARADO…');
      try{
        const result=await action();
        if(!active())return;
        const currentText=retain?notes?.value||'':'';
        await render(currentText);
        if(active())show(typeof result==='string'?result:success);
      }catch(e){if(active())show(e.message||'No se pudo completar la operación.')}
      finally{
        busy=false;
        if(active())for(const btn of screen.querySelectorAll('button[disabled]'))
          btn.disabled=false;
      }
    };
    screen.querySelector('[data-work-back]')?.addEventListener('click',()=>{
      if(!requestLeave())return;
      onBack();
    });
    screen.querySelector('[data-work-refresh]')?.addEventListener('click',()=>{
      if(busy||!active())return;
      void render(notes?.value||'');
    });
    screen.querySelector('[data-work-start]')?.addEventListener('click',()=>transact(
      ()=>startOperatorWork({supabase,requestId,operatorId:userId,isActive}),
      'Trabajo iniciado.'));
    screen.querySelector('[data-work-save-notes]')?.addEventListener('click',()=>transact(
      ()=>saveOperatorWorkDescription({
        supabase,requestId,operatorId:userId,description:notes.value,isActive
      }),'Descripción guardada.',true));
    const uploadPictures=files=>transact(async()=>{
      const result=await uploadOperatorWorkPhotos({
        supabase,operatorId:userId,requestId,files,isActive
      });
      const saved=result.uploaded+result.recovered;
      if(result.failed)return result.total+' foto(s) en el parte. '+
        saved+' nueva(s) guardada(s), '+result.failed+' fallida(s). '+
        'Selecciona de nuevo las fallidas para reintentarlas; las demás no se duplican.';
      return 'Fotografías verificadas en el parte: '+result.total+
        ' · nuevas: '+saved+' · ya existentes: '+result.alreadyPresent+'.';
    },'Fotos guardadas.',true);
    screen.querySelector('[data-work-upload]')?.addEventListener('click',()=>
      void uploadPictures(screen.querySelector('[data-work-files]')?.files));
    screen.querySelector('[data-work-camera]')?.addEventListener('change',event=>{
      if(event.target.files?.length)void uploadPictures(event.target.files);
    });
    screen.querySelector('[data-work-finish]')?.addEventListener('click',()=>transact(
      ()=>completeOperatorWork({
        supabase,requestId,operatorId:userId,description:notes.value,isActive
      }),'Servicio finalizado y cerrado correctamente.'));
    // Enlaces firmados breves: Storage privado, nunca URLs públicas permanentes.
    const operatorGallery=screen.querySelector('[data-work-gallery]');
    const showPhotoUnavailable=gallery=>{
      const message=document.createElement('p');
      message.className='notice';
      message.textContent='No se pudo cargar una fotografía privada. Actualiza el parte para reintentar.';
      gallery.append(message);
    };
    for(const photo of photos){
      if(!active())return;
      const gallery=role==='admin'
        ?screen.querySelector('[data-work-gallery-operator="'+photo.operator_id+'"]')
        :operatorGallery;
      if(!gallery)continue;
      const path=photo.operator_id+'/'+requestId+'/'+photo.name;
      try{
        const {data,error}=await supabase.storage.from('work-photos')
          .createSignedUrl(path,120);
        if(!active())return;
        if(error||!data?.signedUrl){
          showPhotoUnavailable(gallery);
          continue;
        }
        const link=document.createElement('a');
        link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';
        const img=document.createElement('img');
        const author=history.find(entry=>entry.operator_id===photo.operator_id);
        img.alt='Foto del trabajo de '+(author?.operator_label||photo.operator_id);
        img.loading='lazy';
        link.append(img);gallery.append(link);
        // Registrar el error antes de asignar src para recuperar también
        // fallos inmediatos y URLs caducadas al cargar miniaturas diferidas.
        bindWorkPhotoRetry({
          image:img,link,gallery,
          store:supabase.storage.from('work-photos'),path,
          isActive:active,onUnavailable:showPhotoUnavailable
        });
        img.src=data.signedUrl;
      }catch{showPhotoUnavailable(gallery)}
    }
    if(operatorGallery&&!operatorGallery.children.length)
      operatorGallery.textContent='Aún no hay fotografías accesibles.';
  }
  await render();
}
