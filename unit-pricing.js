// REPARADO V63 · Las tarifas por m² o metro lineal no son importes de trabajos completos.
// Solo genera orientación comercial. El presupuesto final se confirma por separado.
export const minimumQuantityByService = Object.freeze({
  'Alicatado': 8,
  'Solado de gres': 8,
  'Rejuntado': 8,
  'Tabique de Pladur': 10,
  'Trasdosado de Pladur': 10,
  'Techo de Pladur': 10,
  'Instalación de parquet/laminado': 15,
  'Acuchillado/lijado': 20,
  'Barnizado': 20,
  'Retirada de pavimento': 15,
  'Colocación de rodapié': 15
});

const money = value => Number(value).toFixed(2).replace('.',',') + ' €';
const quantityText = quantity => Number(quantity).toLocaleString('es-ES',{maximumFractionDigits:2});
const html = value => String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function unitQuote(service,rawQuantity=''){
  if(!service?.[3])return null;
  const [category,name,price,unit]=service;
  const minimum=minimumQuantityByService[name];
  if(!['m²','m'].includes(unit)||!(minimum>0)||!(Number.isFinite(price)&&price>0))
    return {status:'unavailable',unit,minimum,unitPrice:price};
  const base={unit,minimum,unitPrice:price};
  const raw=String(rawQuantity??'').trim();
  if(!raw)return {...base,status:'empty'};
  // Máximo dos decimales; no permitir signos, notación exponencial ni 0.
  if(!/^\d{1,5}(?:[.,]\d{1,2})?$/.test(raw))return {...base,status:'invalid'};
  const quantity=Number(raw.replace(',','.'));
  if(!Number.isFinite(quantity)||quantity<=0||quantity>10000)
    return {...base,status:'invalid'};
  if(quantity<minimum)return {...base,status:'below-minimum',quantity};
  const cents=Math.round(Math.round(price*100)*Math.round(quantity*100)/100);
  return {...base,status:'estimate',quantity,total:cents/100};
}

export function unitQuoteText(quote){
  if(!quote)return '';
  if(quote.status==='unavailable')return 'Este servicio necesita presupuesto personalizado.';
  if(quote.status==='invalid')
    return 'Introduce una cantidad positiva válida, con hasta dos decimales y máximo 10.000.';
  const threshold=quantityText(quote.minimum)+' '+quote.unit;
  if(quote.status==='empty')
    return 'Tarifa orientativa desde '+money(quote.unitPrice)+' / '+quote.unit+
      '. Indica una cantidad aproximada para calcular o deja el campo vacío. Referencia para trabajos desde '+threshold+'.';
  if(quote.status==='below-minimum')
    return 'Para '+quantityText(quote.quantity)+' '+quote.unit+' (menos de '+threshold+
      ') prepararemos un presupuesto específico. No se multiplica la tarifa automáticamente.';
  return 'Estimación desde '+money(quote.total)+' para '+quantityText(quote.quantity)+' '+quote.unit+
    ', con material estándar, mano de obra e IVA incluidos. No es un presupuesto aceptado; comprobaremos las medidas.';
}

export function unitQuantityMarkup(service){
  const quote=unitQuote(service);
  if(!quote)return '';
  const unit=html(quote.unit);
  const label=service[3]==='m²'?'Superficie aproximada (m²)':'Longitud aproximada (metros lineales)';
  return '<div class="unit-quote-fields">'+
    '<label>'+label+'<input type="text" name="estimated_quantity" inputmode="decimal" maxlength="10" '+
    'autocomplete="off" placeholder="Ej. 20" aria-describedby="unit-estimate-status"></label>'+
    '<p class="notice unit-estimate" id="unit-estimate-status" data-unit-estimate role="status" aria-live="polite">'+
      html(unitQuoteText(quote))+'</p>'+
    '<small class="unit-estimate-hint">Cantidad orientativa en '+unit+
    '. No sustituye la medición ni el presupuesto confirmado por REPARADO.</small></div>';
}

export function bindUnitQuantity(form,service){
  const input=form?.querySelector?.('[name="estimated_quantity"]');
  const output=form?.querySelector?.('[data-unit-estimate]');
  if(!input||!output)return ()=>null;
  const read=()=>{
    const quote=unitQuote(service,input.value);
    output.textContent=unitQuoteText(quote);
    return quote;
  };
  input.addEventListener('input',read);
  read();
  return read;
}

export function unitQuantityDescription(quote){
  if(!quote||!Number.isFinite(quote.quantity))return '';
  if(!['estimate','below-minimum'].includes(quote.status))return '';
  // No se guarda el cálculo económico como precio de una solicitud o aceptación.
  return '\nCantidad aproximada indicada por el cliente: '+quantityText(quote.quantity)+
    ' '+quote.unit+'. Medición y presupuesto definitivo pendientes.';
}
