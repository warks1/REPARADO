// REPARADO V100 · Pantalla privada del parte de servicio.
// Solo operario asignado edita; el propietario consulta partes y evidencias.
import {
  fetchWorkReport,listWorkPhotos,startOperatorWork,saveOperatorWorkDescription,
  completeOperatorWork,uploadOperatorWorkPhotos,
  mayStartWork,mayFinishWork,MAX_WORK_PHOTOS,WORK_DESCRIPTION_MAX
} from './operator-work-service.js';

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
function viewMarkup(job,report,photos,{userId,role,preserve=''}) {
  const canEdit=role==='operator'&&job.operator_id===userId;
  const start=canEdit&&mayStartWork(job,userId);
  const finish=canEdit&&mayFinishWork(job,userId);
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
    (start&&job.status==='scheduled'
      ?'<div class="operator-work-actions"><button type="button" data-work-start>▶ Iniciar trabajo</button>'+
       '<p>Al iniciar quedará registrado en curso. Después podrás escribir el parte y subir fotos.</p></div>'
      :'')+
    (finish?'<label class="operator-work-notes">Descripción del trabajo realizado'+
      '<textarea name="work_description" rows="5" maxlength="'+WORK_DESCRIPTION_MAX+
      '" placeholder="Explica qué se ha reparado, comprobaciones, materiales y resultado..." required>'+esc(description)+'</textarea></label>'+
      '<button type="button" data-work-save-notes>Guardar descripción</button>'
      :'<div class="operator-work-readonly"><h2>Trabajo realizado</h2><p data-work-description>'+
       esc(report?.description|| (ended?'Pendiente de parte histórico.':'Aún no se ha iniciado.'))+'</p></div>')+
    '<h2>Fotografías del trabajo</h2><p data-work-photo-count>'+
      photos.length+' de '+MAX_WORK_PHOTOS+' fotografías adjuntas</p>'+
    '<div class="operator-work-gallery" data-work-gallery aria-label="Fotos del trabajo"></div>'+
    (finish?'<div class="operator-work-upload">'+
      '<label>Seleccionar fotos del trabajo <input type="file" data-work-files multiple '+
      'accept="image/jpeg,image/png,image/webp,image/heic"></label>'+
      '<button type="button" data-work-upload>Subir fotos</button>'+
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

export async function mountOperatorWork({main,supabase,requestId,userId,role,isActive,onBack}){
  if(!isActive()||!UUID.test(String(requestId||''))||
    !UUID.test(String(userId||''))||!['admin','operator'].includes(role))return;
  main.innerHTML='<section class="card" data-work-loading><h2>Parte de trabajo</h2>'+
    '<p>Cargando servicio asignado…</p></section>';
  const loading=main.querySelector('[data-work-loading]');
  const active=()=>isActive()&&main.querySelector('#reparado-operator-work')!==null;
  let busy=false,screen=null;
  async function render(preserve=''){
    if(!isActive())return;
    const query=supabase.from('service_requests')
      .select('id,service_name,status,operator_id,operator_name,street,address_number,city,description,scheduled_at,work_started_at,work_finished_at')
      .eq('id',requestId);
    if(role==='operator')query.eq('operator_id',userId);
    const response=await query.maybeSingle();
    if(!isActive()||!main.contains(screen||loading))return;
    if(response?.error||!response?.data){
      main.innerHTML='<section class="card"><h2>Parte de trabajo</h2>'+
        '<p>El servicio no está disponible para esta cuenta. Comprueba la conexión, los permisos y la migración V100.</p>'+
        '<button type="button" data-work-back>← Volver</button></section>';
      main.querySelector('[data-work-back]')?.addEventListener('click',onBack);
      return;
    }
    const job=response.data;
    let report=null,photos=[];
    try{
      report=await fetchWorkReport({supabase,requestId,isActive});
      if(report)photos=await listWorkPhotos({
        supabase,operatorId:report.operator_id,requestId,isActive
      });
    }catch(error){
      if(!isActive())return;
      main.innerHTML='<section class="card"><h2>Parte de trabajo</h2>'+
        '<p data-work-error>'+esc(error.message)+'</p>'+
        '<button type="button" data-work-back>← Volver</button></section>';
      main.querySelector('[data-work-back]')?.addEventListener('click',onBack);
      return;
    }
    if(!isActive()||!main.contains(screen||loading))return;
    main.innerHTML=viewMarkup(job,report,photos,{userId,role,preserve});
    screen=main.querySelector('#reparado-operator-work');
    const feedback=screen.querySelector('[data-work-feedback]');
    const notes=screen.querySelector('[name="work_description"]');
    const show=text=>{if(active())feedback.textContent=text};
    const transact=async(action,success,retain=false)=>{
      if(!active()||busy)return;
      busy=true;
      for(const btn of screen.querySelectorAll('[data-work-start],[data-work-save-notes],[data-work-upload],[data-work-finish]'))
        btn.disabled=true;
      show('Guardando cambios en REPARADO…');
      try{
        await action();
        if(!active())return;
        if(success)show(success);
        const currentText=retain?notes?.value||'':'';
        await render(currentText);
      }catch(e){if(active())show(e.message||'No se pudo completar la operación.')}
      finally{
        busy=false;
        if(active())for(const btn of screen.querySelectorAll('button[disabled]'))
          btn.disabled=false;
      }
    };
    screen.querySelector('[data-work-back]')?.addEventListener('click',()=>{
      if(!busy&&isActive())onBack();
    });
    screen.querySelector('[data-work-start]')?.addEventListener('click',()=>transact(
      ()=>startOperatorWork({supabase,requestId,operatorId:userId,isActive}),
      'Trabajo iniciado.'));
    screen.querySelector('[data-work-save-notes]')?.addEventListener('click',()=>transact(
      ()=>saveOperatorWorkDescription({
        supabase,requestId,operatorId:userId,description:notes.value,isActive
      }),'Descripción guardada.',true));
    screen.querySelector('[data-work-upload]')?.addEventListener('click',()=>transact(async()=>{
      const files=screen.querySelector('[data-work-files]')?.files;
      const result=await uploadOperatorWorkPhotos({
        supabase,operatorId:userId,requestId,files,isActive
      });
      if(result.failed)throw new Error(
        'Se han guardado '+(result.uploaded+result.recovered)+
        ' fotos, pero '+result.failed+' han fallado. Revisa las imágenes antes de cerrar.');
    },'Fotos guardadas.',true));
    screen.querySelector('[data-work-finish]')?.addEventListener('click',()=>transact(
      ()=>completeOperatorWork({
        supabase,requestId,operatorId:userId,description:notes.value,isActive
      }),'Servicio cerrado correctamente.'));
    // Enlaces firmados breves: Storage privado, nunca URLs públicas permanentes.
    const gallery=screen.querySelector('[data-work-gallery]');
    for(const photo of photos){
      if(!active())return;
      const path=report.operator_id+'/'+requestId+'/'+photo.name;
      try{
        const {data,error}=await supabase.storage.from('work-photos')
          .createSignedUrl(path,120);
        if(!active())return;
        if(error||!data?.signedUrl)continue;
        const link=document.createElement('a');
        link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';
        const img=document.createElement('img');img.src=data.signedUrl;
        img.alt='Foto de intervención';img.loading='lazy';
        link.append(img);gallery.append(link);
      }catch{/* Seguir mostrando las fotos accesibles aunque una URL falle. */}
    }
    if(!gallery.children.length)gallery.textContent='Aún no hay fotografías accesibles.';
  }
  await render();
}
