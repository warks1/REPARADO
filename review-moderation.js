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
    '<p class="notice">Solo administración. Revisa comentarios auténticos sobre trabajos finalizados antes de publicarlos. Las 32 reseñas de ejemplo no están aquí ni se aprueban.</p>'+
    '<p data-review-moderation-feedback role="status" aria-live="polite">Cargando reseñas pendientes…</p>'+
    '<div data-review-moderation-list></div></section>';
  const root=main.querySelector('#review-moderation');
  const feedback=root.querySelector('[data-review-moderation-feedback]');
  const list=root.querySelector('[data-review-moderation-list]');
  const available=()=>root.isConnected && isActive();
  root.querySelector('[data-review-admin-back]').addEventListener('click',onBack);
  async function refresh(){
    try {
      const {data,error}=await supabase.from('customer_reviews')
        .select('id,rating,comment,status,created_at')
        .eq('status','pending').order('created_at',{ascending:true}).limit(100);
      if(!available())return;
      if(error)throw error;
      list.innerHTML=moderationRowsMarkup(data||[]);
      feedback.textContent=(data?.length||0)+' reseña(s) pendiente(s) · máximo 100 por revisión.';
    } catch {
      if(!available())return;
      list.innerHTML='';
      feedback.textContent='No se pueden cargar las reseñas. Comprueba tu conexión y permisos de administración.';
      const retry=document.createElement('button');
      retry.type='button';retry.textContent='Reintentar';retry.addEventListener('click',refresh);
      list.append(retry);
    }
  }
  root.addEventListener('click',async event=>{
    const button=event.target.closest('button[data-review-decision]');
    if(!button||button.disabled||!available())return;
    const status=button.dataset.reviewDecision;
    const id=button.dataset.reviewId;
    if(!validModerationDecision(status)||!id)return;
    const item=button.closest('.review-moderation-card');
    if(!item||item.dataset.reviewId!==id)return;
    const other=item.querySelectorAll('[data-review-decision]');
    other.forEach(b=>b.disabled=true);
    feedback.textContent='Guardando decisión…';
    try{
      // Filtrar por estado inicial para evitar aprobar dos veces o usar datos antiguos.
      const {data,error}=await supabase.from('customer_reviews').update({status})
        .eq('id',id).eq('status','pending').select('id,status');
      if(!available())return;
      if(error)throw error;
      if(!data||data.length!==1){
        feedback.textContent='Esta reseña ya fue revisada o ya no está disponible. Actualiza la lista.';
        other.forEach(b=>b.disabled=false);
        return;
      }
      item.remove();
      feedback.textContent=status==='approved'?
        'Reseña aprobada. Aparecerá entre las valoraciones reales de la portada.':
        'Reseña rechazada; no se mostrará públicamente.';
      if(!list.querySelector('.review-moderation-card')){
        list.innerHTML='<p class="notice" data-moderation-empty>No hay reseñas pendientes de revisión.</p>';
      }
    } catch {
      if(!available())return;
      feedback.textContent='No se ha podido guardar la decisión. Inténtalo de nuevo.';
      other.forEach(b=>b.disabled=false);
    }
  });
  await refresh();
}
