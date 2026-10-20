import {vatIncluded,jobStatusLabels} from './staff-workflows.js';
import {calculateQuoteLines} from './quote-calculator.js';

// Solo presentaciones de registros que la consulta autorizada ya ha devuelto.
// Ni este documento ni su impresión envían mensajes o generan facturas.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const amount=n=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const stages=['new','quoted','accepted','scheduled','in_progress','completed'];
export function staffProgress(status){
  if(status==='cancelled')return {status:'cancelled',label:'Cancelada',steps:[]};
  const current=stages.indexOf(status);
  return {status,label:jobStatusLabels[status]||'Estado desconocido',
    steps:stages.map((key,index)=>({id:key,label:jobStatusLabels[key],
      completed:current>index,current:current===index}))};
}
export function readableJobDate(value){
  if(!value)return 'Sin fecha programada';
  const time=new Date(value);
  if(!Number.isFinite(time.getTime()))return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(time);
}
export function staffProgressMarkup(status){
  const stage=staffProgress(status);
  if(!stage.steps.length)return '<p class="staff-cancelled">Trabajo cancelado. No existe un avance activo.</p>';
  return '<ol class="staff-stage-list" aria-label="Seguimiento del trabajo">'+
    stage.steps.map(step=>'<li class="'+(step.current?'is-current':step.completed?'is-completed':'is-future')+'"'+
      (step.current?' aria-current="step"':'')+'>'+esc(step.label)+'</li>').join('')+'</ol>'+
    '<p class="staff-stage-help">Etapas basadas en el estado actual. No representan fechas de ejecución.</p>';
}
export function staffDocument(job,{kind='order',price,items=null}={}){
  if(!job||!['order','quote'].includes(kind))throw new Error('Documento no válido');
  const quote=kind==='quote';
  const detail=quote&&items!==null?calculateQuoteLines(items):null;
  const breakdown=detail||vatIncluded(quote?price:job.price);
  if(quote&&!breakdown)throw new Error('Introduce un importe válido antes de previsualizar el presupuesto.');
  if(detail&&Math.round(detail.total*100)!==Math.round(Number(price)*100))
    throw new Error('El precio del formulario no coincide con el desglose. Aplica el total antes de previsualizar.');
  const row=(label,value)=>'<div class="staff-doc-row"><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>';
  const address=[job.street,job.address_number,job.city].filter(Boolean).join(', ');
  const disclaimer=quote
    ?'BORRADOR INTERNO DE PRESUPUESTO. No ha sido enviado ni aceptado por el cliente. No es una factura.'
    :'ORDEN DE TRABAJO INTERNA. El documento refleja la última consulta de esta solicitud; no es una factura.';
  const ref=String(job.id||'Sin referencia');
  return '<section class="request-document-print staff-document" aria-label="'+(quote?'Presupuesto informativo':'Orden de trabajo')+'">'+
    '<header><h2>Reparado</h2><h3>'+(quote?'Presupuesto informativo · borrador':'Orden de trabajo · uso interno')+'</h3>'+
    '<p class="staff-document-warning">'+esc(disclaimer)+'</p></header>'+
    '<dl>'+row('Referencia de solicitud',ref)+row('Servicio',job.service_name||'No indicado')+
    row('Dirección',address||'No indicada')+
    row('Teléfono de contacto',job.phone||'No indicado')+
    row('Descripción',job.description||'No indicada')+
    row('Operario',job.operator_name||'Sin asignar')+
    row('Estado',jobStatusLabels[job.status]||'No indicado')+
    row('Fecha registrada',readableJobDate(job.scheduled_at))+
    (detail?'<div class="staff-itemized-heading">Partidas del borrador</div>'+
      detail.lines.map(line=>row(line.name+' · '+line.quantity.toLocaleString('es-ES')+' × '+amount(line.unitPrice),amount(line.total))).join(''):'')+
    (breakdown?row('Base estimada',amount(breakdown.base))+row('IVA incluido · 21 %',amount(breakdown.vat))+
      row('Total IVA incluido',amount(breakdown.total)):row('Importe','Por presupuesto'))+
    '</dl>'+
    '<p class="staff-doc-footer">Documento generado para consulta e impresión interna. Los cambios del formulario pendientes de guardar no se consideran aplicados.</p>'+
    '</section>';
}
