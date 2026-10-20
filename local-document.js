// Resguardos informativos y copias locales. NO son facturas ni citas confirmadas.
const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fields=['id','category','service','street','address','postal_code','city','phone','description','date','period','price','status','created_at','updated_at'];
export function readableTimestamp(value){
  const ms=Date.parse(value||'');
  if(!Number.isFinite(ms))return 'Sin fecha registrada';
  return new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',dateStyle:'medium',timeStyle:'short'}).format(new Date(ms));
}
export function historicalEvents(record){
  return (Array.isArray(record?.history)?record.history:[])
    .filter(e=>e && ['created','preferences_changed'].includes(e.type) && Number.isFinite(Date.parse(e.at||'')))
    .slice(-30).reverse().map(e=>({
      label:e.type==='created'?'Solicitud guardada en el dispositivo':'Preferencias de visita actualizadas',
      at:e.at
    }));
}
export function localReceipt(record){
  const r=record||{};
  const price=Number(r.price)>0&&Number.isFinite(Number(r.price))
    ?Number(r.price).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' € (IVA incluido, orientativo)'
    :'Pendiente de presupuesto';
  const row=(label,value)=>'<div class="receipt-row"><dt>'+escape(label)+'</dt><dd>'+escape(value||'No indicado')+'</dd></div>';
  const visit=(r.date||'')+' '+(r.period||'');
  return '<section class="request-document-print" aria-label="Resguardo local de solicitud">'+
    '<header><h1>Reparado</h1><h2>Resguardo de solicitud local</h2><p class="receipt-warning">Documento informativo. Esta solicitud NO ha sido enviada al equipo; NO es una factura ni una cita confirmada.</p></header>'+
    '<dl>'+row('Referencia local',r.id)+row('Servicio',r.service)+row('Categoría',r.category)+
    row('Dirección',[r.street,r.address,r.postal_code,r.city].filter(Boolean).join(', '))+
    row('Teléfono',r.phone)+row('Descripción',r.description)+row('Fecha de guardado',readableTimestamp(r.created_at))+
    row('Fecha preferida',visit.trim()||'Sin fecha preferida')+row('Precio orientativo',price)+'</dl>'+
    '<p class="receipt-footer">Los datos de este documento proceden únicamente del almacenamiento de este dispositivo.</p></section>';
}
export function localRequestBackup(record,exportedAt=new Date().toISOString()){
 const r=record||{},request={};
 for(const field of fields)if(Object.prototype.hasOwnProperty.call(r,field))request[field]=r[field];
 request.history=historicalEvents(r).slice().reverse().map(e=>({
   type:e.label==='Solicitud guardada en el dispositivo'?'created':'preferences_changed',at:e.at
 }));
 return {format:'reparado-local-request',version:1,exported_at:exportedAt,
   sent_to_company:false,appointment_confirmed:false,request};
}
export function localBackupName(record){
 const id=String(record?.id||'sin-id').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48)||'sin-id';
 return 'reparado-solicitud-'+id+'.json';
}
