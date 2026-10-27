import {vatIncluded} from './staff-workflows.js';

// Descarga local de una constancia informativa. No firma, no factura,
// no comunica nuevos datos a servidores ni consulta solicitudes ajenas.
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));
const euros=value=>Number(value).toLocaleString('es-ES',{
  minimumFractionDigits:2,maximumFractionDigits:2
})+' €';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function quoteAcceptanceSummary(record){
  if(!UUID.test(String(record?.id||'')))throw new Error('Referencia de solicitud no válida.');
  const dateRaw=String(record?.accepted_at||'');
  const date=new Date(dateRaw);
  const price=vatIncluded(record?.accepted_price);
  if(!/^\d{4}-\d\d-\d\d[T ]/.test(dateRaw) ||
     !Number.isFinite(date.getTime()) || price===null)
    throw new Error('La aceptación todavía no tiene un importe y fecha verificables.');
  const formattedDate=new Intl.DateTimeFormat('es-ES',{
    dateStyle:'long',timeStyle:'medium',timeZone:'Europe/Madrid'
  }).format(date);
  const row=(label,value)=>'<div class="line"><dt>'+escapeHtml(label)+
    '</dt><dd>'+escapeHtml(value)+'</dd></div>';
  return '<!doctype html><html lang="es"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>REPARADO · Resumen de aceptación</title>'+
    '<style>body{max-width:680px;margin:32px auto;padding:0 20px;font:16px/1.5 system-ui,sans-serif;color:#182432}'+
    'header{border-bottom:3px solid #ff662a;padding-bottom:12px}h1{margin:0}'+
    'dl{margin-top:28px}.line{border-bottom:1px solid #dde1e6;padding:13px 0}'+
    'dt{font-weight:700}dd{margin:2px 0 0}footer{margin-top:28px;font-size:14px;color:#475467}'+
    '@media print{body{margin:0;max-width:none}}</style></head><body>'+
    '<header><h1>REPARADO</h1><p>Resumen de aceptación de presupuesto</p></header>'+
    '<dl>'+row('Referencia de solicitud',record.id)+
    row('Servicio',record.service_name||'Sin descripción')+
    row('Fecha y hora de aceptación (España peninsular)',formattedDate)+
    row('Base imponible estimada',euros(price.base))+
    row('IVA incluido (21 %)',euros(price.vat))+
    row('Total aceptado, IVA incluido',euros(price.total))+
    '</dl><footer>Documento informativo generado desde los datos de la solicitud autenticada. '+
    'No es una factura, un pago acreditado ni una firma electrónica. '+
    'La fecha e importe proceden del registro de aceptación de REPARADO.</footer></body></html>';
}
export function quoteAcceptanceFilename(record){
  if(!UUID.test(String(record?.id||'')))throw new Error('Referencia de solicitud no válida.');
  return 'REPARADO-presupuesto-aceptado-'+String(record.id).toLowerCase()+'.html';
}
export function downloadQuoteAcceptanceSummary(record){
  const html=quoteAcceptanceSummary(record);
  const filename=quoteAcceptanceFilename(record);
  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  try{
    const link=document.createElement('a');
    link.href=url;link.download=filename;
    link.style.display='none';
    document.body.appendChild(link);
    try{link.click()}finally{link.remove()}
  }finally{
    // Dar tiempo a Safari / Android WebView para iniciar la descarga.
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
}
