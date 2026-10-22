// Opiniones ficticias para revisar la interfaz: NO proceden de clientes reales.
// No se insertan en Supabase, no generan una media pública ni se presentan como verificadas.
const demoData=[
  [
    "Fontanería",
    "El grifo dejó de gotear y quedó bien ajustado."
  ],
  [
    "Fontanería",
    "Una fuga pequeña parecía complicada; el resultado quedó limpio."
  ],
  [
    "Fontanería",
    "El desagüe vuelve a funcionar sin malos olores."
  ],
  [
    "Fontanería",
    "La cisterna descarga suavemente y no pierde agua."
  ],
  [
    "Albañilería",
    "Las baldosas nuevas combinan muy bien con las anteriores."
  ],
  [
    "Albañilería",
    "El alicatado quedó alineado y con juntas regulares."
  ],
  [
    "Albañilería",
    "El suelo de gres presenta un acabado uniforme."
  ],
  [
    "Albañilería",
    "El rejuntado renovó la apariencia del baño."
  ],
  [
    "Albañilería",
    "El tabique de pladur ha quedado recto y firme."
  ],
  [
    "Albañilería",
    "El falso techo se integra muy bien con la iluminación."
  ],
  [
    "Albañilería",
    "La reparación de pared dejó la superficie lisa."
  ],
  [
    "Albañilería",
    "El trasdosado mejoró el aspecto de toda la habitación."
  ],
  [
    "Parquet",
    "Las tablas encajan sin huecos apreciables."
  ],
  [
    "Parquet",
    "La reparación recuperó la uniformidad del suelo."
  ],
  [
    "Parquet",
    "Tras el lijado la madera se ve mucho más clara."
  ],
  [
    "Parquet",
    "El barniz tiene un tono natural y agradable."
  ],
  [
    "Parquet",
    "El rodapié sigue el contorno de las paredes con precisión."
  ],
  [
    "Parquet",
    "Retirar el suelo antiguo facilitó mucho la reforma."
  ],
  [
    "Reformas integrales",
    "El baño se ve más amplio y mejor aprovechado."
  ],
  [
    "Reformas integrales",
    "La distribución de la cocina resulta mucho más práctica."
  ],
  [
    "Reformas integrales",
    "La reforma de la vivienda quedó coherente de principio a fin."
  ],
  [
    "Manitas",
    "La estantería está nivelada y bien anclada."
  ],
  [
    "Manitas",
    "El soporte del televisor quedó firme y a la altura adecuada."
  ],
  [
    "Manitas",
    "Las puertas vuelven a cerrar sin rozar."
  ],
  [
    "Manitas",
    "La cinta de la persiana corre sin atascarse."
  ],
  [
    "Manitas",
    "La silicona de la ducha presenta un acabado uniforme."
  ],
  [
    "Manitas",
    "La lámpara queda centrada y bien fijada."
  ],
  [
    "Manitas",
    "Los cuadros quedaron equilibrados y a la misma altura."
  ],
  [
    "Manitas",
    "El mueble en kit quedó estable y sin holguras."
  ],
  [
    "Manitas",
    "La barra de cortina se sostiene correctamente."
  ],
  [
    "Manitas",
    "Los accesorios del baño quedaron colocados con cuidado."
  ],
  [
    "Manitas",
    "La manilla abre y cierra con suavidad."
  ]
];
export const demoReviews=Object.freeze(demoData.map(([service,comment],i)=>Object.freeze({
  id:'demo-'+(i+1),service,comment,rating:5,fictional:true
})));

// Las valoraciones auténticas se muestran antes que los ejemplos ficticios.
// Nunca se añaden las demostraciones a Supabase ni al promedio de estrellas.
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    id:String(row.id),rating:Number(row.rating),
    comment:String(row.comment).trim(),
    created_at:row.created_at,fictional:false
  }));
  real.sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));
  return [...real,...demoReviews];
}

export function verifiedReviewSummary(approvedRows=[]){
  const real=combineReviews(approvedRows).filter(review=>!review.fictional);
  return {count:real.length,average:real.length?
    Math.round(real.reduce((sum,r)=>sum+r.rating,0)/real.length*10)/10:null};
}

function reviewCard(review,index){
  const demo=review.fictional===true;
  const n=Math.min(5,Math.max(1,Math.round(Number(review.rating)||1)));
  const label=demo?'Ejemplo ficticio':'Valoración real · servicio completado';
  return '<article class="review-card'+(demo?' review-demo':' review-real')+'"'+(index>=4?' hidden':'')+'>'+
    '<div class="review-card-top">'+stars(n)+
    '<small class="'+(demo?'review-example-label':'review-verified-label')+'">'+label+'</small></div>'+
    '<p>'+escapeText(review.comment)+'</p>'+
    '<small>'+escapeText(demo?review.service:'Cliente con servicio completado')+'</small></article>';
}

export function reviewFeedMarkup(approvedRows=[],filter='all',expanded=false){
  const list=combineReviews(approvedRows).filter(row=>
    filter==='real'?!row.fictional:filter==='examples'?row.fictional:true);
  const cards=list.map((row,index)=>reviewCard(row,expanded?0:index)).join('');
  return {
    count:list.length,
    html:cards || '<p class="review-loading">'+
      (filter==='real'?'Todavía no hay valoraciones reales aprobadas.':
        'No hay reseñas para este filtro.')+'</p>'
  };
}
export function renderReviewsSection(){
  return '<section class="reparado-reviews" id="reparado-reviews" aria-label="Reseñas y valoraciones">'+
    '<div class="section-heading"><h2>Reseñas y valoraciones</h2></div>'+
    '<p class="reviews-disclaimer"><strong>Importante:</strong> las 32 opiniones marcadas como ejemplos son ficticias y son ejemplos de diseño. Cuando existan valoraciones reales aprobadas aparecerán en esta misma lista, siempre antes de los ejemplos. No son testimonios reales ni cuentan para la nota de REPARADO.</p>'+
    '<p class="reviews-summary" data-reviews-summary aria-live="polite">32 ejemplos ficticios · comprobando valoraciones reales…</p>'+
    '<div class="review-filters" role="group" aria-label="Filtrar reseñas">'+
      '<button type="button" class="review-filter active" data-review-filter="all" aria-pressed="true">Todas</button>'+
      '<button type="button" class="review-filter" data-review-filter="real" aria-pressed="false">Valoraciones reales</button>'+
      '<button type="button" class="review-filter" data-review-filter="examples" aria-pressed="false">Ejemplos</button>'+
    '</div>'+
    '<div class="review-feed-grid" data-review-feed>'+reviewFeedMarkup().html+'</div>'+
    '<button class="services-expand review-expand" type="button" data-expand-reviews aria-expanded="false">Ver todas las reseñas (32) ↓</button>'+
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

export async function mountReviews(main,{supabase=null,session=null}={}){
  const root=main.querySelector('#reparado-reviews');
  if(!root)return;
  let real=[],filter='all',expanded=false,loaded=!supabase,loadFailed=false;
  const feed=root.querySelector('[data-review-feed]');
  const expand=root.querySelector('[data-expand-reviews]');
  const summary=root.querySelector('[data-reviews-summary]');
  function showFeed(){
    if(!root.isConnected)return;
    const {html,count}=reviewFeedMarkup(real,filter,expanded);
    feed.innerHTML=loadFailed && filter==='real' ?
      '<p class="review-loading">No se pueden cargar las valoraciones reales en este momento.</p>' : html;
    root.querySelectorAll('[data-review-filter]').forEach(btn=>{
      const selected=btn.dataset.reviewFilter===filter;
      btn.classList.toggle('active',selected);
      btn.setAttribute('aria-pressed',String(selected));
    });
    expand.hidden=count<=4;
    expand.setAttribute('aria-expanded',String(expanded));
    expand.textContent=expanded?'Mostrar menos reseñas ↑':'Ver todas las reseñas ('+count+') ↓';
    if(!loaded)summary.textContent='Cargando valoraciones reales… · 32 ejemplos ficticios';
    else if(loadFailed)summary.textContent='No se han podido consultar las valoraciones reales · 32 ejemplos ficticios';
    else {
      const stats=verifiedReviewSummary(real);
      summary.textContent=stats.count?
        stats.count+' valoraciones reales · '+stats.average.toLocaleString('es-ES')+'/5 de media real · 32 ejemplos ficticios':
        (supabase?'Aún no hay valoraciones reales aprobadas':'Modo local: sin valoraciones reales conectadas')+' · 32 ejemplos ficticios';
    }
  }
  root.querySelectorAll('[data-review-filter]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      filter=btn.dataset.reviewFilter;expanded=false;showFeed();
    });
  });
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
      .select('id').eq('customer_id',session.user.id).eq('status','completed').limit(50);
    if(error)throw error;
    if(!root.isConnected)return;
    if(!data?.length){
      note.textContent='Podrás valorar un trabajo cuando aparezca como terminado en tu cuenta.';
      return;
    }
    form.elements.request_id.innerHTML='<option value="">Selecciona tu servicio</option>'+
      data.map((row,i)=>'<option value="'+escapeText(row.id)+'">Servicio finalizado '+(i+1)+'</option>').join('');
    form.hidden=false;
    note.textContent='Solo puedes valorar solicitudes tuyas que consten como terminadas. La publicación requiere revisión.';
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
