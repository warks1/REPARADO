// REPARADO V84 · Calendario privado del propietario, horario de Cataluña.
// Estado accepted significa presupuesto aceptado por el cliente. No programar
// solicitudes new/quoted; las comprobaciones SQL/RLS y V7 son autoritativas.
import {madridDateTimeInput,madridDateTimeText,madridLocalDateTimeToIso,
  madridVisitDateTimeToIso} from './staff-timezone.js';
import {sameOperatorSlot,staffVisitGapMinutes} from './staff-workflows.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
const pad=v=>String(v).padStart(2,'0');

function utcDate(day){
  const d=new Date(String(day)+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(day))||
     !Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==day)
    throw Error('Fecha de calendario no válida');
  return d;
}
function plusDays(day,delta){
  const date=utcDate(day);
  date.setUTCDate(date.getUTCDate()+delta);
  return date.toISOString().slice(0,10);
}
export function ownerWeekStart(day){
  const d=utcDate(day);
  return plusDays(day,-((d.getUTCDay()+6)%7));
}
export function moveOwnerWeek(start,steps){
  if(!Number.isSafeInteger(steps)||Math.abs(steps)>520)throw Error('Periodo no válido');
  return plusDays(ownerWeekStart(start),steps*7);
}
export function ownerTodayMadrid(now=new Date()){
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=type=>p.find(x=>x.type===type)?.value;
  return part('year')+'-'+part('month')+'-'+part('day');
}
export function ownerWeekDays(start){
  return Array.from({length:7},(_,i)=>plusDays(ownerWeekStart(start),i));
}

export async function fetchOwnerCalendar(supabase,start){
  if(!supabase)return {error:true};
  try{
    const monday=ownerWeekStart(start);
    const weekEnd=plusDays(monday,7);
    const after=madridLocalDateTimeToIso(monday+'T00:00');
    const before=madridLocalDateTimeToIso(weekEnd+'T00:00');
    if(after.error||before.error||!after.iso||!before.iso)throw Error('Fecha inválida');
    const [scheduled,accepted,operators]=await Promise.all([
      supabase.from('service_requests')
        .select('id,service_name,status,operator_id,operator_name,scheduled_at,city,price')
        .in('status',['scheduled','in_progress'])
        .gte('scheduled_at',after.iso).lt('scheduled_at',before.iso)
        .order('scheduled_at',{ascending:true}).limit(200),
      supabase.from('service_requests')
        .select('id,service_name,status,operator_id,operator_name,scheduled_at,city,price')
        .eq('status','accepted').order('created_at',{ascending:false}).limit(50),
      supabase.from('profiles').select('id,full_name,role')
        .eq('role','operator').order('full_name',{ascending:true})
    ]);
    if(scheduled?.error||accepted?.error||operators?.error||
       !Array.isArray(scheduled?.data)||!Array.isArray(accepted?.data)||
       !Array.isArray(operators?.data))throw Error('No se pudo cargar el calendario');
    return {error:false,scheduled:scheduled.data,accepted:accepted.data,
      operators:operators.data,start:monday,partialWeek:scheduled.data.length>=200,
      partialQueue:accepted.data.length>=50};
  }catch{return {error:true}}
}

export async function saveOwnerVisit(supabase,{job,operatorId,datetime,operators,allowed=()=>true}){
  if(!allowed())return {ok:false,message:'Sesión de administración no disponible.'};
  if(!job||!UUID.test(String(job.id))||
     !['accepted','scheduled','in_progress'].includes(job.status))
    return {ok:false,message:'El cliente debe aceptar el presupuesto antes de programar.'};
  const operator=Array.isArray(operators)?
    operators.find(x=>x.id===operatorId&&x.role==='operator'&&UUID.test(String(x.id))):null;
  if(!operator)return {ok:false,message:'Selecciona un operario autorizado.'};
  const time=madridVisitDateTimeToIso(datetime,job.scheduled_at);
  if(time.error||!time.iso)
    return {ok:false,message:time.error||'Selecciona una fecha y hora de Cataluña.'};
  if(!allowed())return {ok:false,message:'Sesión de administración no disponible.'};
  try{
    const gap=staffVisitGapMinutes*60000;
    const middle=new Date(time.iso).getTime();
    const earliest=new Date(middle-gap).toISOString();
    const latest=new Date(middle+gap).toISOString();
    const existing=await supabase.from('service_requests')
      .select('id,operator_id,scheduled_at,status')
      .eq('operator_id',operatorId)
      .in('status',['scheduled','in_progress'])
      .gte('scheduled_at',earliest).lt('scheduled_at',latest);
    if(!allowed())return {ok:false,message:'Sesión de administración no disponible.'};
    if(existing.error||!Array.isArray(existing.data))
      return {ok:false,message:'No se pudo verificar el calendario. No se guardó el cambio.'};
    if(sameOperatorSlot(existing.data,{
      requestId:job.id,operatorId,scheduledAt:time.iso
    }).length)
      return {ok:false,message:'El operario tiene otra cita a menos de 60 minutos.'};
    if(!allowed())return {ok:false,message:'Sesión de administración no disponible.'};
    const targetStatus=job.status==='accepted'?'scheduled':job.status;
    const updated=await supabase.from('service_requests')
      .update({status:targetStatus,operator_id:operator.id,
        operator_name:operator.full_name||null,scheduled_at:time.iso})
      .eq('id',job.id).eq('status',job.status)
      .select('id,status,operator_id,scheduled_at');
    if(!allowed())return {ok:false,message:'Sesión de administración no disponible.'};
    if(updated?.error){
      if(updated.error.code==='23P01'||
         String(updated.error.message||'').includes('REPARADO_SCHEDULE_CONFLICT'))
        return {ok:false,message:'Conflicto de agenda. Otra visita ocupa esa franja.'};
      return {ok:false,message:'No se pudo guardar el cambio. Comprueba los permisos.'};
    }
    if(!Array.isArray(updated?.data)||updated.data.length!==1||
       updated.data[0].id!==job.id||
       updated.data[0].status!==targetStatus||
       updated.data[0].operator_id!==operator.id||
       Date.parse(updated.data[0].scheduled_at)!==Date.parse(time.iso))
      return {ok:false,message:'La solicitud cambió durante la edición. Actualiza antes de reintentar.'};
    return {ok:true,message:'Visita guardada y operario asignado. Comprueba la confirmación con el cliente.'};
  }catch{return {ok:false,message:'Error de conexión. Revisa el calendario antes de repetir el guardado.'}}
}

function dayLabel(day){
  return new Intl.DateTimeFormat('es-ES',{timeZone:'UTC',weekday:'short',
    day:'numeric',month:'short'}).format(new Date(day+'T12:00:00Z'));
}

export async function mountOwnerCalendar({main,supabase,isActive,onBack,onNavigate}){
  if(!isActive())return;
  let monday=ownerWeekStart(ownerTodayMadrid()),activeData=null;
  let sequence=0,saving=false;
  main.innerHTML='<section class="card owner-calendar" id="reparado-owner-calendar">'+
    '<button type="button" class="screen-back" data-owner-back>← Panel del propietario</button>'+
    '<div class="owner-heading"><div><p class="owner-eyebrow">AGENDA PRIVADA</p>'+
    '<h1>Calendario de operarios</h1>'+
    '<p>Asignación y reprogramación en horario de Cataluña</p></div>'+
    '<button type="button" data-owner-reload>Actualizar</button></div>'+
    '<div class="owner-calendar-controls">'+
    '<button type="button" data-owner-week="prev">← Semana anterior</button>'+
    '<strong data-owner-week-label></strong>'+
    '<button type="button" data-owner-week="next">Semana siguiente →</button></div>'+
    '<p role="status" aria-live="polite" data-owner-calendar-feedback>Cargando agenda…</p>'+
    '<div class="owner-week-grid" data-owner-days></div>'+
    '<section class="owner-pending-visits"><h2>Aceptados por programar</h2>'+
    '<p>Solo se programa un presupuesto después de que el cliente lo acepte.</p>'+
    '<div data-owner-accepted></div></section>'+
    '<section class="owner-visit-editor" data-owner-editor hidden><h2>Asignar o cambiar visita</h2>'+
    '<form data-owner-visit-form><p data-owner-selected></p>'+
    '<label>Operario<select name="operator" required></select></label>'+
    '<label>Fecha y hora (Cataluña)<input type="datetime-local" name="when" required></label>'+
    '<div class="owner-calendar-actions"><button type="submit">Guardar cita y operario</button>'+
    '<button type="button" data-owner-cancel>Cancelar</button></div></form></section>'+
    '<p class="owner-security">Las reservas concurrentes se verifican también en la base de datos. Este calendario muestra hasta 200 visitas por semana y 50 presupuestos aceptados recientes.</p>'+
    '<button type="button" data-owner-all>Ver todos los trabajos →</button></section>';
  const root=main.querySelector('#reparado-owner-calendar');
  const feedback=root.querySelector('[data-owner-calendar-feedback]');
  const grid=root.querySelector('[data-owner-days]');
  const queue=root.querySelector('[data-owner-accepted]');
  const editor=root.querySelector('[data-owner-editor]');
  const form=root.querySelector('[data-owner-visit-form]');
  let selected=null;
  const active=()=>root.isConnected&&isActive();
  const show=async()=>{
    if(!active())return;
    const request=++sequence;
    selected=null;editor.hidden=true;
    feedback.textContent='Consultando la agenda…';
    root.querySelector('[data-owner-week-label]').textContent=
      dayLabel(monday)+' — '+dayLabel(plusDays(monday,6));
    const result=await fetchOwnerCalendar(supabase,monday);
    if(!active()||request!==sequence)return;
    if(result.error){
      activeData=null;grid.innerHTML='';queue.innerHTML='';
      feedback.textContent='No se pudo consultar el calendario. Usa Actualizar para reintentar.';
      return;
    }
    activeData=result;
    feedback.textContent=result.scheduled.length+' visitas esta semana · '+
      result.accepted.length+' trabajos aceptados sin programar'+
      (result.partialWeek||result.partialQueue?' · Hay más registros: revisa Todos los servicios.':'');
    const days=ownerWeekDays(monday);
    grid.innerHTML=days.map(day=>{
      const entries=result.scheduled.filter(item=>
        madridDateTimeInput(item.scheduled_at).slice(0,10)===day);
      return '<div class="owner-day"><h3>'+esc(dayLabel(day))+'</h3>'+
        (entries.length?entries.map(item=>
          '<button type="button" class="owner-appointment" data-owner-edit="'+esc(item.id)+'">'+
          '<b>'+esc(madridDateTimeInput(item.scheduled_at).slice(11))+'</b>'+
          '<span>'+esc(item.service_name)+'</span>'+
          '<small>'+esc(item.operator_name||'Sin operario')+' · '+esc(item.city||'')+'</small>'+
          '</button>').join(''):'<p class="owner-day-empty">Sin visitas</p>')+'</div>';
    }).join('');
    queue.innerHTML=result.accepted.length?result.accepted.map(item=>
      '<div class="owner-accepted-job"><div><strong>'+esc(item.service_name)+'</strong>'+
      '<small>'+esc(item.city||'')+' · Presupuesto aceptado</small></div>'+
      '<button type="button" data-owner-edit="'+esc(item.id)+'">Asignar fecha →</button></div>'
    ).join(''):'<p>Sin presupuestos aceptados pendientes de programación.</p>';
  };
  const edit=id=>{
    if(!active()||!activeData||saving)return;
    selected=[...activeData.scheduled,...activeData.accepted].find(x=>x.id===id)||null;
    if(!selected)return;
    const choices=activeData.operators.map(op=>
      '<option value="'+esc(op.id)+'" '+(selected.operator_id===op.id?'selected':'')+'>'+
      esc(op.full_name||'Operario')+'</option>').join('');
    form.elements.namedItem('operator').innerHTML='<option value="">Selecciona operario</option>'+choices;
    form.elements.namedItem('when').value=madridDateTimeInput(selected.scheduled_at);
    root.querySelector('[data-owner-selected]').textContent=selected.service_name+
      ' · '+(selected.status==='accepted'?'Aceptado: programar primera visita':'Cambiar operario o fecha');
    editor.hidden=false;
    editor.scrollIntoView({block:'nearest',behavior:'auto'});
  };
  root.addEventListener('click',event=>{
    if(!active())return;
    const editButton=event.target.closest('[data-owner-edit]');
    if(editButton){edit(editButton.dataset.ownerEdit);return}
    const weekButton=event.target.closest('[data-owner-week]');
    if(weekButton&&!saving){
      monday=moveOwnerWeek(monday,weekButton.dataset.ownerWeek==='prev'?-1:1);
      void show();return;
    }
  });
  root.querySelector('[data-owner-back]').addEventListener('click',onBack);
  root.querySelector('[data-owner-reload]').addEventListener('click',()=>{if(!saving)void show()});
  root.querySelector('[data-owner-cancel]').addEventListener('click',()=>{editor.hidden=true;selected=null});
  root.querySelector('[data-owner-all]').addEventListener('click',()=>onNavigate('admin','all'));
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!selected||!active()||saving||!activeData)return;
    saving=true;
    const submit=form.querySelector('[type=submit]');
    submit.disabled=true;
    feedback.textContent='Comprobando y guardando programación…';
    const result=await saveOwnerVisit(supabase,{
      job:selected,operators:activeData.operators,
      operatorId:form.elements.namedItem('operator').value,
      datetime:form.elements.namedItem('when').value,allowed:active
    });
    saving=false;
    if(!active())return;
    submit.disabled=false;
    if(result.ok){
      await show();
      if(active())feedback.textContent=result.message;
    }else feedback.textContent=result.message;
  });
  await show();
}
