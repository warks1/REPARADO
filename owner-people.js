// REPARADO V84 · Directorios privados de clientes y operarios.
// No expone auth.users ni direcciones de correo; solo perfiles visibles por RLS.
export const ownerPeoplePageSize=30;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);

export function ownerPeoplePageCount(count){
  return Number.isSafeInteger(count)&&count>=0?
    Math.max(1,Math.ceil(count/ownerPeoplePageSize)):0;
}

export async function fetchOwnerPeoplePage(supabase,role,page=0){
  if(!supabase||!['customer','operator'].includes(role)||
     !Number.isSafeInteger(page)||page<0||page>100000)
    return {data:null,count:null,error:true};
  try{
    const {data,count,error}=await supabase.from('profiles')
      .select('id,full_name,phone,role',{count:'exact'})
      .eq('role',role)
      .order('full_name',{ascending:true})
      .order('id',{ascending:true})
      .range(page*ownerPeoplePageSize,(page+1)*ownerPeoplePageSize-1);
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
      return {data:null,count:null,error:true};
    return {data:data.filter(p=>p?.role===role&&typeof p.id==='string'&&p.id.trim()!==''),
      count,error:false};
  }catch{return {data:null,count:null,error:true}}
}

export async function mountOwnerPeople({main,supabase,role,isActive,onBack,onChat,onCalendar}){
  if(!['customer','operator'].includes(role)||!isActive())return;
  let page=0,sequence=0,people=[];
  const customers=role==='customer';
  const title=customers?'Clientes':'Operarios';
  main.innerHTML='<section class="card owner-directory" id="reparado-owner-people">'+
    '<button type="button" class="screen-back" data-owner-people-back>← Panel del propietario</button>'+
    '<div class="owner-heading"><div><p class="owner-eyebrow">DIRECTORIO PRIVADO</p>'+
    '<h1>'+title+'</h1><p>Datos de contacto visibles para la cuenta administradora.</p></div>'+
    '<button type="button" data-owner-people-refresh>Actualizar</button></div>'+
    '<p role="status" aria-live="polite" data-owner-people-status>Consultando perfiles…</p>'+
    '<div data-owner-people-list></div>'+
    '<nav class="staff-new-pagination" aria-label="Páginas del directorio">'+
    '<span data-owner-people-page></span><div>'+
    '<button type="button" data-owner-people-prev disabled>← Anterior</button>'+
    '<button type="button" data-owner-people-next disabled>Siguiente →</button>'+
    '</div></nav>'+
    '<p class="owner-security">Los correos electrónicos de acceso se protegen por separado en Auth y no se muestran en este directorio. No permite cambiar roles de usuarios.</p>'+
    '</section>';
  const root=main.querySelector('#reparado-owner-people');
  const list=root.querySelector('[data-owner-people-list]');
  const status=root.querySelector('[data-owner-people-status]');
  const label=root.querySelector('[data-owner-people-page]');
  const prev=root.querySelector('[data-owner-people-prev]');
  const next=root.querySelector('[data-owner-people-next]');
  const active=()=>root.isConnected&&isActive();
  const load=async()=>{
    const id=++sequence;
    prev.disabled=true;next.disabled=true;
    status.textContent='Consultando '+(customers?'clientes':'operarios')+'…';
    const result=await fetchOwnerPeoplePage(supabase,role,page);
    if(!active()||id!==sequence)return;
    if(result.error){
      people=[];list.innerHTML='';
      label.textContent='Sin recuento';
      status.textContent='No se pudo consultar este directorio. Comprueba los permisos y reintenta.';
      return;
    }
    if(page>=ownerPeoplePageCount(result.count)&&page>0){
      page=ownerPeoplePageCount(result.count)-1;
      return load();
    }
    people=result.data;
    status.textContent=result.count+' '+(customers?'clientes':'operarios')+' en total.';
    label.textContent='Página '+(page+1)+' de '+ownerPeoplePageCount(result.count);
    prev.disabled=page===0;next.disabled=page+1>=ownerPeoplePageCount(result.count);
    list.innerHTML=people.length?people.map((p,i)=>
      '<article class="owner-person"><div><strong>'+esc(p.full_name||'Perfil sin nombre')+'</strong>'+
      '<small>Teléfono: '+esc(p.phone||'No indicado')+'</small></div>'+
      '<button type="button" data-owner-contact="'+i+'">'+
      (customers?'Abrir chat':'Ver calendario')+' →</button></article>').join(''):
      '<p>No hay perfiles en esta página.</p>';
  };
  root.addEventListener('click',event=>{
    const btn=event.target.closest('[data-owner-contact]');
    if(!btn||!active())return;
    const index=Number(btn.dataset.ownerContact);
    const person=Number.isSafeInteger(index)&&index>=0?people[index]:null;
    if(!person||person.role!==role||typeof person.id!=='string'||!person.id.trim())return;
    if(customers)onChat(person.id);
    else onCalendar();
  });
  root.querySelector('[data-owner-people-back]').addEventListener('click',onBack);
  root.querySelector('[data-owner-people-refresh]').addEventListener('click',()=>{page=0;void load()});
  prev.addEventListener('click',()=>{if(!prev.disabled&&active()){page--;void load()}});
  next.addEventListener('click',()=>{if(!next.disabled&&active()){page++;void load()}});
  await load();
}
