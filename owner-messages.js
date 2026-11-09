// REPARADO V91 · Bandeja de MENSAJES DENTRO DE LA APP, no correo Outlook.
// Consultas restringidas por RLS a la cuenta administradora autenticada.
export const ownerMessagesPageSize=30;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
const localTime=value=>{
  const d=new Date(value);
  return Number.isFinite(d.getTime())?
    new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',
      dateStyle:'short',timeStyle:'short'}).format(d):'Sin fecha';
};

export async function fetchOwnerMessagesPage(supabase,page=0){
  if(!supabase||!Number.isSafeInteger(page)||page<0||page>100000)
    return {error:true};
  try{
    const {data,count,error}=await supabase.from('messages')
      .select('id,customer_id,sender_id,body,created_at',{count:'exact'})
      .order('created_at',{ascending:false})
      .order('id',{ascending:false})
      .range(page*ownerMessagesPageSize,(page+1)*ownerMessagesPageSize-1);
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
      return {error:true};
    const ids=[...new Set(data.map(r=>r.customer_id).filter(id=>UUID.test(String(id))))];
    let names={};
    if(ids.length){
      const info=await supabase.from('profiles')
        .select('id,full_name').in('id',ids);
      if(info?.error||!Array.isArray(info?.data))return {error:true};
      names=Object.fromEntries(info.data.map(p=>[p.id,p.full_name||'Cliente']));
    }
    return {data,count,names,error:false};
  }catch{return {error:true}}
}


/** Bandeja real: una fila por cliente ordenada por su último mensaje.
 * SECURITY INVOKER en SQL; RLS del servidor limita a la cuenta admin.
 * No mostrar como «no leído»: el esquema no registra esa información. */
export async function fetchOwnerConversationsPage(supabase,page=0){
  if(!supabase||!Number.isSafeInteger(page)||page<0||page>100000)
    return {error:true,unavailable:false};
  if(typeof supabase.rpc!=='function')
    return {error:true,unavailable:true};
  try{
    const {data,error}=await supabase.rpc('reparado_owner_conversations',{
      p_offset:page*ownerMessagesPageSize,p_limit:ownerMessagesPageSize
    });
    if(error)return {error:true,unavailable:['PGRST202','42883'].includes(error.code)};
    if(!data||!Array.isArray(data.rows)||
       !Number.isSafeInteger(data.total)||data.total<0||
       data.rows.length>ownerMessagesPageSize)
      return {error:true,unavailable:false};
    if(data.rows.some(r=>!UUID.test(String(r.customer_id))||
       !UUID.test(String(r.last_message_id))||
       !UUID.test(String(r.sender_id))||
       typeof r.last_body!=='string'))
      return {error:true,unavailable:false};
    const rows=data.rows.map(r=>({
      id:r.last_message_id,customer_id:r.customer_id,
      sender_id:r.sender_id,body:r.last_body,created_at:r.last_message_at,
      unread:typeof r.has_unread==='boolean'?r.has_unread:null
    }));
    const ids=[...new Set(rows.map(r=>r.customer_id))];
    let names={};
    if(ids.length){
      const result=await supabase.from('profiles')
        .select('id,full_name').in('id',ids);
      if(result?.error||!Array.isArray(result?.data))
        return {error:true,unavailable:false};
      names=Object.fromEntries(result.data.map(p=>[p.id,p.full_name||'Cliente']));
    }
    return {data:rows,count:data.total,names,error:false,mode:'conversations'};
  }catch{return {error:true,unavailable:false}}
}

/** Compatibilidad: la versión anterior solo se usa si falta la RPC V90.
 * Un error de permisos 42501 NO habilita la alternativa. */
export async function fetchOwnerInboxPage(supabase,page=0){
  const grouped=await fetchOwnerConversationsPage(supabase,page);
  if(!grouped.error)return grouped;
  if(!grouped.unavailable)return {error:true};
  const legacy=await fetchOwnerMessagesPage(supabase,page);
  return legacy.error?legacy:{...legacy,mode:'messages'};
}

export function ownerMessagePageCount(count){
  return Number.isSafeInteger(count)&&count>=0?
    Math.max(1,Math.ceil(count/ownerMessagesPageSize)):0;
}

export async function mountOwnerMessages({main,supabase,isActive,onBack,onConversation}){
  if(!isActive())return;
  let page=0,sequence=0;
  main.innerHTML='<section class="card owner-inbox" id="reparado-owner-messages">'+
    '<button type="button" class="screen-back" data-owner-messages-back>← Panel del propietario</button>'+
    '<div class="owner-heading"><div><p class="owner-eyebrow">BANDEJA PRIVADA</p>'+
    '<h1>Mensajes de clientes</h1>'+
    '<p>Conversaciones recibidas dentro de REPARADO; no son emails de Outlook.</p></div>'+
    '<button type="button" data-owner-messages-refresh>Actualizar</button></div>'+
    '<p role="status" aria-live="polite" data-owner-messages-status>Cargando…</p>'+
    '<div data-owner-messages-list></div>'+
    '<nav class="staff-new-pagination" aria-label="Páginas de mensajes internos">'+
    '<span data-owner-messages-page></span><div>'+
    '<button type="button" data-owner-message-nav="prev" disabled>← Recientes</button>'+
    '<button type="button" data-owner-message-nav="next" disabled>Anteriores →</button>'+
    '</div></nav></section>';
  const root=main.querySelector('#reparado-owner-messages');
  const list=root.querySelector('[data-owner-messages-list]');
  const status=root.querySelector('[data-owner-messages-status]');
  const label=root.querySelector('[data-owner-messages-page]');
  const prev=root.querySelector('[data-owner-message-nav="prev"]');
  const next=root.querySelector('[data-owner-message-nav="next"]');
  const active=()=>root.isConnected&&isActive();
  let customers=[];
  const load=async()=>{
    const id=++sequence;
    status.textContent='Consultando mensajes privados…';
    prev.disabled=true;next.disabled=true;
    const data=await fetchOwnerInboxPage(supabase,page);
    if(!active()||id!==sequence)return;
    if(data.error){
      list.innerHTML='';
      status.textContent='No se pudieron comprobar los mensajes. Vuelve a intentarlo.';
      label.textContent='Sin recuento disponible';
      return;
    }
    if(page>=ownerMessagePageCount(data.count)&&page>0){
      page=Math.max(0,ownerMessagePageCount(data.count)-1);
      return load();
    }
    customers=data.data.filter(r=>UUID.test(String(r.customer_id)));
    status.textContent=data.mode==='conversations'?
      data.count+' conversaciones de clientes. Una fila por cliente, ordenadas por el último mensaje.':
      data.count+' mensajes internos. Instala la actualización V90 para agruparlos por cliente.';
    status.textContent+=data.mode==='conversations'&&
      data.data.some(row=>typeof row.unread==='boolean')?
      ' Los indicadores de lectura se actualizan al consultar correctamente el chat.':
      ' La lectura de Outlook y el estado no leído aún no están integrados.';
    label.textContent='Página '+(page+1)+' de '+ownerMessagePageCount(data.count);
    prev.disabled=page===0;
    next.disabled=page+1>=ownerMessagePageCount(data.count);
    list.innerHTML=customers.length?customers.map((row,i)=>
      '<button class="owner-message-row" type="button" data-owner-open-chat="'+esc(i)+'">'+
      (row.unread===true?'<span class="owner-unread-label">● Pendiente de leer</span>':
       row.unread===false?'<span class="owner-read-label">Leído</span>':'')+
      '<strong>'+esc(data.names[row.customer_id]||'Cliente')+
      ' · '+esc(row.sender_id===row.customer_id?'Cliente':'Equipo')+'</strong>'+
      '<small>'+esc(localTime(row.created_at))+'</small>'+
      '<span>'+esc(String(row.body||'').slice(0,180))+'</span>'+
      '<small>Ver conversación →</small></button>').join(''):
      '<p>No hay mensajes en esta página.</p>';
  };
  root.addEventListener('click',event=>{
    const el=event.target.closest('[data-owner-open-chat]');
    if(!el||!active())return;
    const idx=Number(el.dataset.ownerOpenChat);
    if(!Number.isSafeInteger(idx)||idx<0||idx>=customers.length)return;
    onConversation(customers[idx].customer_id);
  });
  root.querySelector('[data-owner-messages-back]').addEventListener('click',onBack);
  root.querySelector('[data-owner-messages-refresh]').addEventListener('click',()=>{page=0;void load()});
  prev.addEventListener('click',()=>{if(!prev.disabled&&active()){page--;void load()}});
  next.addEventListener('click',()=>{if(!next.disabled&&active()){page++;void load()}});
  await load();
}

export function ownerMailMarkup(){
  return '<section class="card owner-mail" id="reparado-owner-mail">'+
    '<button type="button" class="screen-back" data-owner-mail-back>← Panel del propietario</button>'+
    '<p class="owner-eyebrow">CORREO EXTERNO</p><h1>Correo de REPARADO</h1>'+
    '<p>Los buzones de Outlook no están conectados a la app. Para leer los emails, entra a Outlook con la cuenta correspondiente. No se mostrarán mensajes externos ni cifras inventadas.</p>'+
    '<div class="owner-mail-links">'+
    '<div><strong>Solicitudes comerciales</strong><p>reparado_clientes@outlook.es</p></div>'+
    '<div><strong>Soporte y fallos</strong><p>reparado_soporte@outlook.es</p></div></div>'+
    '<a class="owner-external-mail" href="https://outlook.live.com/mail/" target="_blank" rel="noopener noreferrer">Abrir Outlook para consultar correos ↗</a>'+
    '<p class="owner-security">Las solicitudes enviadas dentro de la aplicación se gestionan en Solicitudes, no en esta pantalla. Los avisos por email requieren el servicio de envío seguro configurado.</p></section>';
}
