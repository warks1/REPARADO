export async function renderNotifications({main,supabase,session,backButton,onRefresh,isStaff=false}) {
  main.innerHTML='<section class="card">'+backButton+'<h2>Mis avisos</h2><p>Cargando…</p></section>';
  const {data,error}=await supabase.from('notifications').select('id,title,body,read,created_at')
    .eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(50);
  if(!onRefresh())return;
  const card=document.createElement('section'); card.className='card';
  const back=document.createElement('button');back.type='button';back.className='back';
  back.dataset.back='';back.textContent='← Volver';card.append(back);
  const title=document.createElement('h2');title.textContent='Mis avisos';card.append(title);
  const intro=document.createElement('p');intro.className='notice';
  intro.textContent=isStaff?'Avisos de trabajos asignados, cambios de agenda y mensajes.':'Avisos de presupuestos, citas y mensajes del equipo.';card.append(intro);
  if(error){const p=document.createElement('p');p.textContent=error.message;card.append(p);main.replaceChildren(card);return;}
  if(!data?.length){const p=document.createElement('p');p.textContent='Todavía no hay avisos.';card.append(p);}
  for(const alert of data||[]){
    const article=document.createElement('article');article.className='request';
    const h=document.createElement('strong');h.textContent=alert.title;article.append(h);
    const state=document.createElement('span');state.textContent=alert.read?'Leído':'Nuevo';article.append(state);
    const body=document.createElement('p');body.textContent=alert.body;article.append(body);
    const date=document.createElement('small');date.textContent=new Date(alert.created_at).toLocaleString('es-ES');article.append(date);
    if(!alert.read){
      const actions=document.createElement('div');actions.className='flex-actions';
      const button=document.createElement('button');button.type='button';button.textContent='Marcar como leído';
      actions.append(button);article.append(actions);
      button.addEventListener('click',async()=>{
        button.disabled=true;
        const {error:writeError}=await supabase.from('notifications').update({read:true})
          .eq('id',alert.id).eq('user_id',session.user.id);
        if(writeError){button.textContent='Error: '+writeError.message;button.disabled=false;return;}
        state.textContent='Leído';actions.remove();
      });
    }
    card.append(article);
  }
  main.replaceChildren(card);
}