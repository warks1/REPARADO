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
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stars=n=>'<span class="review-stars" aria-label="'+n+' de 5 estrellas">'+('★'.repeat(n))+'</span>';
export function validateReview({rating,comment}){
  const n=Number(rating),text=String(comment??'').trim();
  return Number.isInteger(n)&&n>=1&&n<=5&&text.length>=12&&text.length<=1000;
}
function reviewCard(review,demo){
  const starsCount=Math.max(1,Math.min(5,Number(review.rating)||1));
  return '<article class="review-card'+(demo?' review-demo':'')+'">'+
    '<div class="review-card-top">'+stars(starsCount)+(demo?'<small class="review-example-label">Ejemplo ficticio</small>':'<small class="review-verified-label">Servicio completado</small>')+'</div>'+
    '<p>'+escapeText(review.comment)+'</p>'+
    '<small>'+escapeText(demo?review.service:'Cliente con servicio completado')+'</small></article>';
}
export function renderReviewsSection(){
  return '<section class="reparado-reviews" id="reparado-reviews" aria-label="Reseñas y valoraciones">'+
    '<div class="section-heading"><h2>Reseñas y valoraciones</h2></div>'+
    '<p class="reviews-disclaimer"><strong>Demostración:</strong> las 32 opiniones siguientes son ficticias, solo ilustran el diseño. No son testimonios reales ni cuentan para la nota de REPARADO.</p>'+
    '<div class="demo-review-grid">'+demoReviews.map((item,i)=>reviewCard(item,true).replace('class="review-card review-demo"','class="review-card review-demo"'+(i>=4?' hidden':''))).join('')+'</div>'+
    '<button class="services-expand review-expand" type="button" data-expand-demo-reviews aria-expanded="false">Ver las 32 opiniones de ejemplo ↓</button>'+
    '<div class="reviews-authentic"><h3>Opiniones de clientes</h3><p class="review-real-note">Aquí se mostrarán únicamente reseñas de servicios completados y aprobadas antes de su publicación.</p>'+
    '<div class="real-review-grid" data-real-review-list><p class="review-loading">No hay reseñas verificadas publicadas.</p></div></div>'+
    '<div class="review-write"><h3>Valora tu servicio</h3><p data-review-mode-info>Para publicar una opinión auténtica hay que iniciar sesión y tener un servicio finalizado.</p>'+
    '<button type="button" class="primary-cta" data-review-login hidden>Iniciar sesión para valorar</button>'+
    '<form id="reparado-review-form" hidden>'+
    '<label class="review-service-select">Servicio finalizado <select name="request_id" required><option value="">Selecciona tu servicio</option></select></label>'+
    '<label>Tu puntuación <select name="rating" required><option value="5">★★★★★ · 5 estrellas</option><option value="4">★★★★☆ · 4 estrellas</option><option value="3">★★★☆☆ · 3 estrellas</option><option value="2">★★☆☆☆ · 2 estrellas</option><option value="1">★☆☆☆☆ · 1 estrella</option></select></label>'+
    '<label>Tu comentario <textarea name="comment" maxlength="1000" minlength="12" rows="3" placeholder="Cuenta cómo fue el servicio (mínimo 12 caracteres)" required></textarea></label>'+
    '<button type="submit" class="primary-cta">Enviar valoración</button></form><p data-review-feedback role="status" aria-live="polite"></p></div>'+
    '</section>';
}
export async function mountReviews(main,{supabase=null,session=null}={}){
  const root=main.querySelector('#reparado-reviews');
  if(!root)return;
  const expand=root.querySelector('[data-expand-demo-reviews]');
  expand?.addEventListener('click',()=>{
    const willExpand=expand.getAttribute('aria-expanded')!=='true';
    root.querySelectorAll('.review-demo').forEach((item,i)=>{if(i>=4)item.hidden=!willExpand});
    expand.setAttribute('aria-expanded',String(willExpand));
    expand.textContent=willExpand?'Mostrar menos opiniones de ejemplo ↑':'Ver las 32 opiniones de ejemplo ↓';
  });
  const note=root.querySelector('[data-review-mode-info]'),form=root.querySelector('#reparado-review-form'),feedback=root.querySelector('[data-review-feedback]');
  if(!supabase){
    note.textContent='Modo de demostración: puedes probar el formulario, pero no se envían ni publican opiniones.';
    form.hidden=false;
    const chooser=form.elements.request_id;
    chooser.innerHTML='<option value="demo">Servicio de demostración</option>';
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const data=new FormData(form);
      feedback.textContent=validateReview({rating:data.get('rating'),comment:data.get('comment')})
        ?'Vista previa completada. La valoración no se ha enviado a REPARADO.'
        :'Escribe un comentario de 12 a 1000 caracteres y selecciona de 1 a 5 estrellas.';
    });
    return;
  }
  const list=root.querySelector('[data-real-review-list]');
  try{
    const {data,error}=await supabase.from('customer_reviews')
      .select('id,rating,comment,created_at,status').eq('status','approved')
      .order('created_at',{ascending:false}).limit(50);
    if(error)throw error;
    if(!root.isConnected)return;
    list.innerHTML=data?.length?data.map(row=>reviewCard(row,false)).join(''):
      '<p class="review-loading">Todavía no se han publicado opiniones de clientes.</p>';
  }catch{
    if(root.isConnected)list.innerHTML='<p class="review-loading">Las opiniones verificadas no están disponibles en este momento.</p>';
  }
  if(!root.isConnected)return;
  if(!session?.user?.id){
    note.textContent='Para escribir una opinión real, accede con tu cuenta después de un servicio finalizado.';
    root.querySelector('[data-review-login]').hidden=false;
    return;
  }
  try{
    const {data,error}=await supabase.from('service_requests').select('id').eq('customer_id',session.user.id).eq('status','completed').limit(50);
    if(error)throw error;
    if(!root.isConnected)return;
    if(!data?.length){note.textContent='Podrás valorar un trabajo cuando aparezca como terminado en tu cuenta.';return;}
    const chooser=form.elements.request_id;
    chooser.innerHTML='<option value="">Selecciona tu servicio</option>'+data.map((row,i)=>'<option value="'+escapeText(row.id)+'">Servicio finalizado '+(i+1)+'</option>').join('');
    form.hidden=false;
    note.textContent='Solo puedes valorar solicitudes tuyas que consten como terminadas. La publicación requiere revisión.';
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const d=new FormData(form),rating=Number(d.get('rating')),comment=String(d.get('comment')||'').trim();
      const request_id=String(d.get('request_id')||'');
      if(!validateReview({rating,comment})||!data.some(item=>item.id===request_id)){
        feedback.textContent='Selecciona un servicio finalizado y escribe entre 12 y 1000 caracteres.';return;
      }
      const submit=form.querySelector('[type="submit"]');submit.disabled=true;
      try {
        const {error}=await supabase.from('customer_reviews').insert({customer_id:session.user.id,request_id,rating,comment});
        if(error){
          feedback.textContent=error.code==='23505'?'Ya existe una valoración para este servicio.':'No se ha podido enviar la valoración. Inténtalo de nuevo.';
        }else{
          feedback.textContent='Valoración recibida. Queda pendiente de revisión antes de publicarse.';
          form.reset();
        }
      }catch{feedback.textContent='Sin conexión. La valoración no se ha enviado.'}
      finally{submit.disabled=false;}
    });
  }catch{
    if(root.isConnected)note.textContent='No se pueden comprobar tus servicios finalizados en este momento.';
  }
}
