import {vatIncluded} from './staff-workflows.js';

// V59: preparación local de una futura factura. NO crea ni emite facturas
// fiscales, no asigna números ni escribe en invoices o Storage.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const money=value=>new Intl.NumberFormat('es-ES',{
  minimumFractionDigits:2,maximumFractionDigits:2
}).format(value)+' €';
const text=(value,max=160)=>String(value??'').trim().slice(0,max);
const legalName=value=>text(value,160);
const taxId=value=>text(value,24).toUpperCase();
const validDate=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00.000Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
};
const row=(label,value)=>'<div class="receipt-row"><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>';

export function prepareBillingDraft(job,fields={}){
  if(!job||job.status!=='completed')
    throw new Error('Para preparar la factura, el trabajo debe estar terminado.');
  const raw=job.price;
  const price=Number(raw);
  if(raw===null||raw===undefined||String(raw).trim()===''||
     !Number.isFinite(price)||price<=0||Math.abs(price*100-Math.round(price*100))>1e-7)
    throw new Error('La solicitud necesita un total positivo confirmado con dos decimales.');
  const breakdown=vatIncluded(price);
  if(!breakdown)throw new Error('No se puede calcular la base y el IVA del servicio.');
  const issuerName=legalName(fields.issuer_name);
  const issuerTaxId=taxId(fields.issuer_nif);
  const issuerAddress=text(fields.issuer_address,240);
  const recipientName=legalName(fields.recipient_name);
  const recipientTaxId=taxId(fields.recipient_nif);
  const recipientAddress=text(fields.recipient_address,240);
  const description=text(fields.description,240);
  if(!issuerName||!recipientName||!issuerAddress||!recipientAddress||!description)
    throw new Error('Rellena los datos fiscales, las direcciones y el concepto del servicio.');
  const nifPattern=/^[A-Z0-9-]{5,24}$/;
  if(!nifPattern.test(issuerTaxId)||!nifPattern.test(recipientTaxId))
    throw new Error('Revisa los NIF o identificadores fiscales de emisor y cliente.');
  const operationDate=text(fields.operation_date,10);
  if(operationDate && !validDate(operationDate))
    throw new Error('La fecha de realización del servicio no es válida.');
  return {
    reference:String(job.id||''),
    issuer:{name:issuerName,nif:issuerTaxId,address:issuerAddress},
    recipient:{name:recipientName,nif:recipientTaxId,address:recipientAddress},
    description,operationDate,price:breakdown.total,base:breakdown.base,vat:breakdown.vat,
    taxPercent:21
  };
}

export function billingDraftFormMarkup(job){
  const customerAddress=[job?.street,job?.address_number,job?.postal_code,job?.city]
    .filter(Boolean).join(', ');
  const service=text(job?.service_name,240);
  return '<form data-billing-draft-form class="billing-draft-editor">'+
    '<p class="notice">Solo preparación local. No se guardan datos fiscales en REPARADO ni se crea ninguna factura oficial.</p>'+
    '<h4>Datos del emisor</h4>'+
    '<label>Nombre o razón social<input name="issuer_name" autocomplete="organization" maxlength="160" required></label>'+
    '<label>NIF del emisor<input name="issuer_nif" maxlength="24" required></label>'+
    '<label>Domicilio fiscal del emisor<input name="issuer_address" maxlength="240" required></label>'+
    '<h4>Datos del cliente</h4>'+
    '<label>Nombre o razón social<input name="recipient_name" maxlength="160" required></label>'+
    '<label>NIF del cliente<input name="recipient_nif" maxlength="24" required></label>'+
    '<label>Domicilio del cliente<input name="recipient_address" maxlength="240" value="'+esc(customerAddress)+'" required></label>'+
    '<label>Concepto del servicio<input name="description" maxlength="240" value="'+esc(service)+'" required></label>'+
    '<label>Fecha del servicio (opcional)<input type="date" name="operation_date"></label>'+
    '<button type="submit">Preparar borrador y desglose IVA</button>'+
    '<p role="status" data-billing-feedback></p></form>'+
    '<div class="billing-draft-preview" data-billing-preview></div>';
}

export function billingDraftDocument(job,fields){
  const d=prepareBillingDraft(job,fields);
  return '<section class="request-document-print billing-draft-print" aria-label="Borrador de factura sin validez fiscal">'+
    '<header><h1>REPARADO</h1><h2>Preparación de factura · BORRADOR</h2>'+
    '<p class="receipt-warning"><strong>NO ES UNA FACTURA EMITIDA NI UN JUSTIFICANTE FISCAL.</strong> No tiene número ni fecha de expedición; requiere validación, registro fiscal y emisión posterior.</p></header>'+
    '<dl>'+row('Referencia de trabajo',d.reference)+row('Número de factura','Pendiente de asignar por el emisor')+
    row('Fecha de expedición','Pendiente de emisión')+
    row('Emisor',d.issuer.name)+row('NIF emisor',d.issuer.nif)+
    row('Domicilio fiscal emisor',d.issuer.address)+row('Destinatario',d.recipient.name)+
    row('NIF destinatario',d.recipient.nif)+row('Domicilio destinatario',d.recipient.address)+
    row('Servicio realizado',d.description)+
    (d.operationDate?row('Fecha de realización del servicio',d.operationDate):'')+
    row('Precio unitario sin IVA · cantidad 1',money(d.base))+
    row('Base imponible',money(d.base))+row('Tipo de IVA','21 %')+
    row('Cuota de IVA',money(d.vat))+row('Total IVA incluido',money(d.price))+'</dl>'+
    '<p class="receipt-footer">Documento de preparación no registrado. No enviar al cliente como factura ni contabilizar hasta la emisión por un sistema fiscal habilitado.</p></section>';
}
