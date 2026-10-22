// Reseñas publicadas: exclusivamente comentarios reales, aprobados por administración.
// Nunca se crean opiniones ni puntuaciones de demostración para la portada.
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const stars=n=>'<span class="review-stars" aria-label="'+n+' de 5 estrellas">'+('★'.repeat(n))+'</span>';

export function validateReview({rating,comment}){
  const n=Number(rating),text=String(comment??'').trim();
  return Number.isInteger(n)&&n>=1&&n<=5&&text.length>=12&&text.length<=1000;
}

export function combineReviews(approvedRows=[]){
  const seen=new Set();
  const real=(Array.isArray(approvedRows)?approvedRows:[]).filter(row=>{
    if(!row || row.status!=='approved' || !validateReview(row))return false;
    if(!row.id || seen.has(String(row.id)))return false;
    seen.add(String(row.id));
    return true;
  }).map(row=>({
    id:String(row.id),rating:Number(row.rating),comment:String(row.comment).trim(),
    created_at:row.created_at
  }));
  real.sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));
  return real;
}

export function verifiedReviewSummary(approvedRows=[]){
  const real=combineReviews(approvedRows);
  return {count:real.length,average:real.length?
    Math.round(real.reduce((sum,r)=>sum+r.rating,0)/real.length*10)/10:null};
}

function reviewCard(review,index){
  const n=Number(review.rating);
  return '<article class="review-card review-real"'+(index>=4?' hidden':'')+'>'+
    '<div class="review-card-top">'+stars(n)+
    '<small class="review-verified-label">Valoración real · servicio completado</small></div>'+
    '<p>'+escapeText(review.comment)+'</p>'+
    '<small>Cliente con servicio completado</small></article>';
}

export function reviewFeedMarkup(approvedRows=[],expanded=false){
  const list=combineReviews(approvedRows);
  return {count:list.length,html:list.length?
    list.map((row,index)=>reviewCard(row,expanded?0:index)).join(''):
    '<p class="review-loading">Todavía no hay valoraciones reales publicadas.</p>'};
}

export function renderReviewsSection(){
  return '<section class="reparado-reviews" id="reparado-reviews" aria-label="Reseñas y valoraciones">'+
    '<div class="section-heading"><h2>Reseñas y valoraciones</h2></div>'+
    '<p class="reviews-summary" data-reviews-summary aria-live="polite">Consultando valoraciones reales…</p>'+
    '<div class="review-feed-grid" data-review-feed>'+reviewFeedMarkup().html+'</div>'+
    '<button class="services-expand review-expand" type="button" data-expand-reviews aria-expanded="false" hidden>Ver más valoraciones ↓</button>'+
    '<div class="review-write"><h3>Valora tu servicio</h3>'+
    '<p data-review-mode-info>Para publicar una opinión auténtica hay que iniciar sesión y tener un servicio finalizado.</p>'+
    '<button type="button" class="primary-cta" data-review-login hidden>Iniciar sesión para valorar</button>'+
    '<form id="reparado-review-form" hidden>'+
    '<label class="review-service-select">Servicio finalizado <select name="request_id" required><option value="">Selecciona tu servicio</option></select></label>'+
    '<label>Tu puntuación <select name="rating" required><option value="5">★★★★★ · 5 estrellas</option><option value="4">★★★★☆ · 4 estrellas</option><option value="3">★★★☆☆ · 3 estrellas</option><option value="2">★★☆☆☆ · 2 estrellas</option><option value="1">★☆☆☆☆ · 1 estrella</option></select></label>'+
    '<label>Tu comentario <textarea name="comment" maxlength="1000" minlength="12" rows="3" placeholder="Cuenta cómo fue el servicio (mínimo 12 caracteres)" required></textarea></label>'+
    '<button type="submit" class="primary-cta">Enviar valoración</button></form>'+
    '<p data-review-feedback role="status" aria-live="polite"></p></div></section>';
}

export async function mountReviews(main,{supabase=null,session=null,selectedRequestId=null}={}){
  const root=main.querySelector('#reparado-reviews');
  if(!root)return;
  let real=[],expanded=false,loaded=!supabase,loadFailed=false;
  const feed=root.querySelector('[data-review-feed]');
  const expand=root.querySelector('[data-expand-reviews]');
  const summary=root.querySelector('[data-reviews-summary]');
  const showFeed=()=>{
    if(!root.isConnected)return;
    const {html,count}=reviewFeedMarkup(real,expanded);
    feed.innerHTML=loadFailed?
      '<p class="review-loading">No se pudieron cargar las valoraciones reales. Vuelve a intentarlo más tarde.</p>':html;
    expand.hidden=loadFailed||count<=4;
    expand.setAttribute('aria-expanded',String(expanded));
    expand.textContent=expanded?'Mostrar menos valoraciones ↑':'Ver todas las valoraciones ('+count+') ↓';
    if(!loaded)summary.textContent='Consultando valoraciones reales…';
    else if(loadFailed)summary.textContent='Las valoraciones reales no están disponibles en este momento.';
    else {
      const stats=verifiedReviewSummary(real);
      summary.textContent=stats.count?
        stats.count+' valoraciones reales · '+stats.average.toLocaleString('es-ES')+'/5 de media':
        'Todavía no hay valoraciones reales publicadas.';
    }
  };
  expand.addEventListener('click',()=>{expanded=!expanded;showFeed()});
  showFeed();
  const note=root.querySelector('[data-review-mode-info]');
  const form=root.querySelector('#reparado-review-form');
  const feedback=root.querySelector('[data-review-feedback]');
  if(!supabase){
    note.textContent='Modo de demostración: puedes probar el formulario, pero no se envían ni publican opiniones.';
    form.hidden=false;
    form.elements.request_id.innerHTML='<option value="demo">Servicio de demostración</option>';
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const data=new FormData(form);
      feedback.textContent=validateReview({rating:data.get('rating'),comment:data.get('comment')})?
        'Vista previa completada. La valoración no se ha enviado a REPARADO.':
        'Escribe un comentario de 12 a 1000 caracteres y selecciona de 1 a 5 estrellas.';
    });
    return;
  }
  try{
    const {data,error}=await supabase.from('customer_reviews')
      .select('id,rating,comment,created_at,status').eq('status','approved')
      .order('created_at',{ascending:false}).limit(50);
    if(error)throw error;
    if(!root.isConnected)return;
    real=Array.isArray(data)?data:[];
    loaded=true;showFeed();
  }catch{
    if(!root.isConnected)return;
    loaded=true;loadFailed=true;showFeed();
  }
  if(!root.isConnected)return;
  if(!session?.user?.id){
    note.textContent='Para escribir una opinión real, accede con tu cuenta después de un servicio finalizado.';
    root.querySelector('[data-review-login]').hidden=false;
    return;
  }
  try{
    const {data,error}=await supabase.from('service_requests')
      .select('id,service_name').eq('customer_id',session.user.id).eq('status','completed').limit(50);
    if(error)throw error;
    if(!root.isConnected)return;
    if(!data?.length){
      note.textContent='Podrás valorar un trabajo cuando aparezca como terminado en tu cuenta.';
      return;
    }
    form.elements.request_id.innerHTML='<option value="">Selecciona tu servicio</option>'+
      data.map((row,i)=>'<option value="'+escapeText(row.id)+'">'+escapeText(row.service_name||'Servicio finalizado '+(i+1))+'</option>').join('');
    form.hidden=false;
    const requested=data.find(row=>row.id===selectedRequestId);
    if(requested){
      form.elements.request_id.value=requested.id;
      note.textContent='Valora el trabajo terminado: '+String(requested.service_name||'servicio seleccionado')+'. La publicación requiere revisión.';
    }else{
      note.textContent='Solo puedes valorar solicitudes tuyas que consten como terminadas. La publicación requiere revisión.';
    }
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const d=new FormData(form),rating=Number(d.get('rating')),comment=String(d.get('comment')||'').trim();
      const request_id=String(d.get('request_id')||'');
      if(!validateReview({rating,comment})||!data.some(item=>item.id===request_id)){
        feedback.textContent='Selecciona un servicio finalizado y escribe entre 12 y 1000 caracteres.';
        return;
      }
      const submit=form.querySelector('[type="submit"]');submit.disabled=true;
      try{
        const {error}=await supabase.from('customer_reviews')
          .insert({customer_id:session.user.id,request_id,rating,comment});
        if(error){
          feedback.textContent=error.code==='23505'?'Ya existe una valoración para este servicio.':
            'No se ha podido enviar la valoración. Inténtalo de nuevo.';
        }else{
          feedback.textContent='Valoración recibida. Queda pendiente de revisión antes de publicarse.';
          form.reset();
        }
      }catch{feedback.textContent='Sin conexión. La valoración no se ha enviado.'}
      finally{submit.disabled=false}
    });
  }catch{
    if(root.isConnected)note.textContent='No se pueden comprobar tus servicios finalizados en este momento.';
  }
}
