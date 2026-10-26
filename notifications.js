import {fetchOwnNotifications,markOwnNotificationRead} from './notifications-data.js';

// Los avisos de otra cuenta nunca deben pintar la pantalla ni marcarse como leídos.
export async function renderNotifications({main,supabase,session,onRefresh,isStaff=false}) {
  const userId=session?.user?.id;
  if(!userId||!onRefresh())return;
  main.innerHTML='<section class="card"><h2>Mis avisos</h2><p>Cargando…</p></section>';
  const loading=main.firstElementChild;
  const {rows,error}=await fetchOwnNotifications(supabase,userId);
  if(!onRefresh()||main.firstElementChild!==loading||!loading.isConnected)return;

  const card=document.createElement('section');card.className='card';
  const current=()=>card.isConnected&&onRefresh();
  const back=document.createElement('button');back.type='button';back.className='back';
  back.dataset.back='';back.textContent='← Volver';card.append(back);
  const title=document.createElement('h2');title.textContent='Mis avisos';card.append(title);
  const intro=document.createElement('p');intro.className='notice';
  intro.textContent=isStaff?'Avisos de trabajos asignados, cambios de agenda y mensajes.':'Avisos de presupuestos, citas y mensajes del equipo.';
  card.append(intro);
  const feedback=document.createElement('p');feedback.dataset.feedback='';
  feedback.className='feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');card.append(feedback);
  if(error){
    const p=document.createElement('p');p.textContent='No se pudieron cargar tus avisos. Comprueba la conexión.';card.append(p);
    const retry=document.createElement('button');retry.type='button';
    retry.dataset.view='notifications';retry.textContent='Reintentar';card.append(retry);
  }else if(!rows.length){
    const p=document.createElement('p');p.textContent='Todavía no hay avisos.';card.append(p);
  }else for(const alert of rows){
    const article=document.createElement('article');article.className='request';
    const h=document.createElement('strong');h.textContent=alert.title;article.append(h);
    const state=document.createElement('span');state.textContent=alert.read?'Leído':'Nuevo';article.append(state);
    const body=document.createElement('p');body.textContent=alert.body;article.append(body);
    const date=document.createElement('small');
    const time=new Date(alert.created_at);
    date.textContent=Number.isFinite(time.getTime())?time.toLocaleString('es-ES'):'Fecha no disponible';
    article.append(date);
    if(!alert.read){
      const actions=document.createElement('div');actions.className='flex-actions';
      const button=document.createElement('button');button.type='button';
      button.textContent='Marcar como leído';actions.append(button);article.append(actions);
      button.addEventListener('click',async()=>{
        if(button.disabled||!current())return;
        button.disabled=true;
        feedback.textContent='';
        const saved=await markOwnNotificationRead(supabase,userId,alert.id);
        if(!current())return;
        if(!saved){
          feedback.textContent='No se pudo guardar el cambio. Comprueba la conexión y vuelve a intentarlo.';
          button.disabled=false;
          return;
        }
        state.textContent='Leído';
        actions.remove();
      });
    }
    card.append(article);
  }
  main.replaceChildren(card);
}
