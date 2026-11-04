import {fetchPendingModerationPage,moderationPageCount,moderationCanAdvance} from './review-moderation-page.js';
// Área privada de moderación V15: no se publica contenido pendiente en portada.
// El cliente nunca recibe claves de servicio ni privilegios de administración.
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const stars=rating=>'★'.repeat(Math.max(1,Math.min(5,Number(rating)||1)));

export function validModerationDecision(value){
  return value==='approved'||value==='rejected';
}
export function moderationRowsMarkup(reviews=[]){
  if(!reviews.length)return '<p class="notice" data-moderation-empty>No hay reseñas pendientes de revisión.</p>';
  return reviews.map(item=>{
    const rating=Number(item.rating);
    if(!Number.isInteger(rating)||rating<1||rating>5||item.status!=='pending')return '';
    return '<article class="review-moderation-card" data-review-id="'+escapeText(item.id)+'">'+
      '<div class="review-moderation-head"><span class="review-stars" aria-label="'+rating+' de 5 estrellas">'+
      stars(rating)+'</span><span class="review-pending-tag">Pendiente</span></div>'+
      '<p>'+escapeText(item.comment)+'</p>'+
      '<small>Opinión real sobre un servicio registrado · '+
      (item.created_at?escapeText(new Date(item.created_at).toLocaleDateString('es-ES')):'Fecha no disponible')+'</small>'+
      '<div class="review-moderation-buttons">'+
      '<button type="button" data-review-decision="approved" data-review-id="'+escapeText(item.id)+'">Aprobar y publicar</button>'+
      '<button type="button" data-review-decision="rejected" data-review-id="'+escapeText(item.id)+'">Rechazar</button>'+
      '</div></article>';
  }).join('');
}

export async function mountReviewModeration({main,supabase,onBack,isActive=()=>true}){
  main.innerHTML='<section class="card review-moderation" id="review-moderation">'+
    '<button type="button" class="screen-back" data-review-admin-back aria-label="Volver al panel interno">← Volver</button>'+
    '<h2>Moderación de reseñas</h2>'+
    '<p class="notice">Solo administración. Revisa comentarios auténticos sobre trabajos finalizados antes de publicarlos. En esta pantalla solo se revisan valoraciones auténticas.</p>'+
    '<p data-review-moderation-feedback role="status" aria-live="polite">Cargando reseñas pendientes…</p>'+
    '<div data-review-moderation-list></div>'+
    '<nav class="review-moderation-pagination" aria-label="Páginas de valoraciones pendientes">'+
    '<button type="button" data-moderation-page="prev" disabled>← Anteriores</button>'+
    '<span data-moderation-page-label aria-live="polite">Página 1</span>'+
    '<button type="button" data-moderation-page="next" disabled>Siguientes →</button>'+
    '</nav></section>';
  const root=main.querySelector('#review-moderation');
  const feedback=root.querySelector('[data-review-moderation-feedback]');
  const list=root.querySelector('[data-review-moderation-list]');
  const previous=root.querySelector('[data-moderation-page="prev"]');
  const next=root.querySelector('[data-moderation-page="next"]');
  const pageLabel=root.querySelector('[data-moderation-page-label]');
  const available=()=>root.isConnected && isActive();
  let page=0,total=null,loading=false,saving=false,refreshSeq=0;
  root.querySelector('[data-review-admin-back]').addEventListener('click',onBack);

  const updatePagination=()=>{
    const known=Number.isSafeInteger(total)&&total>=0;
    pageLabel.textContent=known?
      'Página '+(page+1)+' de '+moderationPageCount(total):
      'Página '+(page+1)+' · recuento no disponible';
    previous.disabled=loading||saving||page===0||!known;
    next.disabled=loading||saving||!known||!moderationCanAdvance(page,total);
  };

  async function refresh(successMessage=''){
    const request=++refreshSeq;
    loading=true;
    updatePagination();
    try{
      const {data,count,error}=await fetchPendingModerationPage(supabase,page);
      if(!available()||request!==refreshSeq)return;
      if(error)throw Error('No se pudieron consultar las reseñas');
      // La cola cambia mientras se aprueban reseñas. Si se vacía la última
      // página, volver a la última página existente sin mostrar un vacío falso.
      if(page>=moderationPageCount(count)){
        page=Math.max(0,moderationPageCount(count)-1);
        loading=false;
        return refresh(successMessage);
      }
      total=count;
      list.innerHTML=moderationRowsMarkup(data);
      feedback.textContent=(successMessage?successMessage+' · ':'')+
        count+' reseña(s) pendiente(s) en total.';
    }catch{
      if(!available()||request!==refreshSeq)return;
      total=null;
      list.innerHTML='';
      feedback.textContent='No se pueden cargar las reseñas. Comprueba tu conexión y permisos de administración.';
      const retry=document.createElement('button');
      retry.type='button';
      retry.textContent='Reintentar';
      retry.addEventListener('click',()=>refresh());
      list.append(retry);
    }finally{
      if(request===refreshSeq){loading=false;updatePagination()}
    }
  }

  root.addEventListener('click',async event=>{
    const navigation=event.target.closest('button[data-moderation-page]');
    if(navigation){
      if(navigation.disabled||loading||saving||!available())return;
      const action=navigation.dataset.moderationPage;
      if(action==='prev'&&page>0)page--;
      else if(action==='next'&&moderationCanAdvance(page,total))page++;
      else return;
      await refresh();
      return;
    }
    const button=event.target.closest('button[data-review-decision]');
    if(!button||button.disabled||!available()||loading||saving)return;
    const status=button.dataset.reviewDecision;
    const id=button.dataset.reviewId;
    if(!validModerationDecision(status)||!id)return;
    const item=button.closest('.review-moderation-card');
    if(!item||item.dataset.reviewId!==id)return;
    const other=item.querySelectorAll('[data-review-decision]');
    other.forEach(b=>b.disabled=true);
    saving=true;
    updatePagination();
    feedback.textContent='Guardando decisión…';
    try{
      // El servidor valida rol admin, columnas autorizadas y estado inicial.
      const {data,error}=await supabase.from('customer_reviews').update({status})
        .eq('id',id).eq('status','pending').select('id,status');
      if(!available())return;
      if(error)throw error;
      if(!data||data.length!==1){
        feedback.textContent='Esta reseña ya fue revisada o ya no está disponible. Actualiza la lista.';
        other.forEach(b=>b.disabled=false);
        return;
      }
      // Volver a consultar el contador evita dar por vacía una cola con más
      // páginas y rellena inmediatamente la página tras aprobar o rechazar.
      await refresh(status==='approved'?
        'Reseña aprobada. Aparecerá entre las valoraciones reales de la portada.':
        'Reseña rechazada; no se mostrará públicamente.');
    }catch{
      if(!available())return;
      feedback.textContent='No se ha podido guardar la decisión. Inténtalo de nuevo.';
      other.forEach(b=>b.disabled=false);
    }finally{
      saving=false;
      if(available())updatePagination();
    }
  });
  await refresh();
}
