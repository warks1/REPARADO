// REPARADO V105 · Privacidad: solicitudes de supresión, SOLO propietario.
// No elimina cuentas ni fotos; un estado "En revisión" no equivale a borrado.
export const ownerDeletionPageSize=30;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
const dateLabel=value=>{
  const d=new Date(value||'');
  return Number.isFinite(d.valueOf())?new Intl.DateTimeFormat('es-ES',{
    timeZone:'Europe/Madrid',dateStyle:'medium',timeStyle:'short'
  }).format(d):'Sin fecha';
};
const states=Object.freeze({
  requested:'Recibida',in_review:'En revisión',completed:'Completada por administración'
});

export function ownerDeletionPageCount(count){
  return Number.isSafeInteger(count)&&count>=0
    ?Math.max(1,Math.ceil(count/ownerDeletionPageSize)):0;
}
export async function fetchOwnerDeletionCount(supabase){
  if(!supabase?.from)return {count:null,error:true};
  try{
    const r=await supabase.from('account_deletion_requests')
      .select('id',{head:true,count:'exact'}).in('status',['requested','in_review']);
    return r?.error||!Number.isSafeInteger(r.count)||r.count<0
      ?{count:null,error:true}:{count:r.count,error:false};
  }catch{return {count:null,error:true}}
}
export async function fetchOwnerDeletionPage(supabase,page=0,filter='pending'){
  if(!supabase?.from||!Number.isSafeInteger(page)||page<0||page>100000||
     !['pending','completed'].includes(filter))
    return {data:null,count:null,error:true};
  try{
    let query=supabase.from('account_deletion_requests')
      .select('id,user_id,status,requested_at,completed_at',{count:'exact'});
    query=filter==='pending'
      ?query.in('status',['requested','in_review'])
      :query.eq('status','completed');
    const result=await query.order('requested_at',{ascending:filter!=='completed'})
      .order('id',{ascending:true})
      .range(page*ownerDeletionPageSize,(page+1)*ownerDeletionPageSize-1);
    if(result?.error||!Array.isArray(result?.data)||
       !Number.isSafeInteger(result.count)||result.count<0||
       result.data.some(row=>!UUID.test(String(row?.id||''))||
        !UUID.test(String(row.user_id||''))||
        (filter==='pending'?!['requested','in_review'].includes(row.status):
          row.status!=='completed')))
      return {data:null,count:null,error:true};
    let names=new Map();
    if(result.data.length){
      const ids=[...new Set(result.data.map(row=>row.user_id))];
      // El directorio ya está limitado al titular por su RLS. Si falla,
      // conservar las solicitudes visibles y mostrar solo la referencia.
      try{
        const profiles=await supabase.from('profiles')
          .select('id,full_name,phone,role').in('id',ids);
        if(!profiles?.error&&Array.isArray(profiles?.data))
          names=new Map(profiles.data
            .filter(p=>ids.includes(p?.id))
            .map(p=>[p.id,{name:p.full_name||'Perfil sin nombre',phone:p.phone||''}]));
      }catch{/* No revelar datos de otro origen ni ocultar solicitudes. */}
    }
    return {data:result.data,count:result.count,names,error:false};
  }catch{return {data:null,count:null,error:true}}
}

export async function beginOwnerDeletionReview({supabase,requestId,isActive}){
  if(!UUID.test(String(requestId||''))||!supabase?.from||
     typeof isActive!=='function'||!isActive())
    throw new Error('Sesión del propietario no disponible.');
  let response;
  try{
    response=await supabase.from('account_deletion_requests')
      .update({status:'in_review'})
      .eq('id',requestId).eq('status','requested')
      .select('id,status');
  }catch{throw new Error('No se pudo conectar con las solicitudes de privacidad.')}
  if(!isActive())throw new Error('La sesión cambió. Actualiza el panel.');
  if(response?.error||!Array.isArray(response?.data))
    throw new Error('No se pudo registrar el inicio de revisión. Comprueba los permisos.');
  if(response.data.length!==1||response.data[0].id!==requestId||
     response.data[0].status!=='in_review')
    throw new Error('La solicitud ya cambió o no existe. Actualiza antes de intervenir.');
  return true;
}

export async function mountOwnerDeletionInbox({main,supabase,isActive,onBack}){
  if(!isActive())return;
  main.innerHTML='<section class="card owner-deletion-inbox" id="reparado-owner-deletions">'+
    '<button type="button" class="screen-back" data-owner-deletion-back>← Panel del propietario</button>'+
    '<p class="owner-eyebrow">PRIVACIDAD · GESTIÓN INTERNA</p>'+
    '<h1>Solicitudes de eliminación de cuenta</h1>'+
    '<p class="notice">Bandeja privada del titular para consultar solicitudes de clientes y operarios. '+
    'Marcar «En revisión» no elimina datos ni confirma que se haya completado la supresión.</p>'+
    '<div class="owner-deletion-filters" role="group" aria-label="Filtrar solicitudes de privacidad">'+
    '<button type="button" data-owner-deletion-filter="pending">Pendientes</button>'+
    '<button type="button" data-owner-deletion-filter="completed">Histórico completado</button>'+
    '<button type="button" data-owner-deletion-refresh>Actualizar</button></div>'+
    '<p role="status" aria-live="polite" data-owner-deletion-status>Consultando solicitudes…</p>'+
    '<div data-owner-deletion-list></div>'+
    '<nav class="staff-new-pagination" aria-label="Páginas de solicitudes de privacidad">'+
    '<span data-owner-deletion-page></span><div>'+
    '<button type="button" data-owner-deletion-prev disabled>← Anterior</button>'+
    '<button type="button" data-owner-deletion-next disabled>Siguiente →</button></div></nav>'+
    '<p class="owner-security">Para tramitar la eliminación efectiva debes verificar la identidad, '+
    'revisar obligaciones fiscales y retirar los datos y fotografías que corresponda mediante '+
    'un procedimiento administrativo seguro. REPARADO todavía no automatiza ese borrado '+
    'y esta pantalla no puede marcar solicitudes como completadas.</p>'+
    '</section>';
  const root=main.querySelector('#reparado-owner-deletions');
  const status=root.querySelector('[data-owner-deletion-status]');
  const list=root.querySelector('[data-owner-deletion-list]');
  const pageLabel=root.querySelector('[data-owner-deletion-page]');
  const previous=root.querySelector('[data-owner-deletion-prev]');
  const next=root.querySelector('[data-owner-deletion-next]');
  const active=()=>root.isConnected&&isActive();
  let page=0,filter='pending',sequence=0,busy=false;

  const load=async()=>{
    if(!active())return;
    const request=++sequence;
    previous.disabled=true;next.disabled=true;
    status.textContent='Consultando las solicitudes del servidor…';
    const result=await fetchOwnerDeletionPage(supabase,page,filter);
    if(!active()||request!==sequence)return;
    if(result.error){
      list.innerHTML='';pageLabel.textContent='Sin recuento';
      status.textContent='No se pudieron consultar las solicitudes de privacidad. Revisa la conexión o la migración V105.';
      return;
    }
    if(page>=ownerDeletionPageCount(result.count)&&page>0){
      page=ownerDeletionPageCount(result.count)-1;
      return load();
    }
    status.textContent=result.count+' solicitud(es) en '+(filter==='pending'?'la bandeja pendiente.':'el histórico.');
    pageLabel.textContent='Página '+(page+1)+' de '+ownerDeletionPageCount(result.count);
    previous.disabled=busy||page===0;
    next.disabled=busy||page+1>=ownerDeletionPageCount(result.count);
    for(const button of root.querySelectorAll('[data-owner-deletion-filter]'))
      button.setAttribute('aria-pressed',String(button.dataset.ownerDeletionFilter===filter));
    list.innerHTML=result.data.length?result.data.map(row=>{
      const p=result.names.get(row.user_id);
      return '<article class="owner-deletion-item">'+
        '<div><strong>'+esc(p?.name||'Cuenta '+row.user_id.slice(0,8))+'</strong>'+
        '<p>Solicitud: '+esc(row.id)+' · '+esc(states[row.status])+'</p>'+
        '<p>Registrada: '+esc(dateLabel(row.requested_at))+
        (row.completed_at?' · Completada: '+esc(dateLabel(row.completed_at)):'')+'</p>'+
        (p?.phone?'<p>Contacto del perfil: '+esc(p.phone)+'</p>':'')+
        '</div>'+
        (row.status==='requested'
          ?'<button type="button" data-owner-deletion-review="'+esc(row.id)+'" '+
            (busy?'disabled':'')+'>Marcar en revisión</button>':'')+
        '</article>';
    }).join(''):'<p>No hay solicitudes en esta sección.</p>';
  };
  const changeFilter=to=>{
    if(!active()||busy||!['pending','completed'].includes(to))return;
    filter=to;page=0;void load();
  };
  root.addEventListener('click',async event=>{
    const button=event.target.closest('[data-owner-deletion-review]');
    if(!button||!active()||busy)return;
    const requestId=button.dataset.ownerDeletionReview;
    if(!UUID.test(String(requestId||'')))return;
    if(!window.confirm('¿Marcar esta solicitud de eliminación como EN REVISIÓN? '+
      'Esto no borra la cuenta ni sus archivos. Debes completar la supresión por el procedimiento seguro.'))return;
    busy=true;
    for(const b of root.querySelectorAll('[data-owner-deletion-review]'))b.disabled=true;
    previous.disabled=true;next.disabled=true;
    status.textContent='Registrando el inicio de revisión…';
    let outcome='';
    try{
      await beginOwnerDeletionReview({supabase,requestId,isActive:active});
      outcome='Solicitud marcada En revisión. No se han borrado datos.';
    }catch(error){outcome=error.message||'No se pudo registrar la revisión.'}
    finally{
      busy=false;
      if(active()){
        await load();
        if(active()&&!status.textContent.startsWith('No se pudieron'))
          status.textContent=outcome;
      }
    }
  });
  root.querySelector('[data-owner-deletion-back]').addEventListener('click',onBack);
  root.querySelector('[data-owner-deletion-refresh]').addEventListener('click',()=>{
    if(!busy)void load();
  });
  for(const button of root.querySelectorAll('[data-owner-deletion-filter]'))
    button.addEventListener('click',()=>changeFilter(button.dataset.ownerDeletionFilter));
  previous.addEventListener('click',()=>{if(active()&&!busy&&!previous.disabled){page--;void load()}});
  next.addEventListener('click',()=>{if(active()&&!busy&&!next.disabled){page++;void load()}});
  await load();
}
