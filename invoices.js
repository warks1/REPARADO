import {checkInvoiceAmounts,formatInvoiceEuro,invoiceStatusLabels} from './invoice-math.js';
// Lista de documentos emitidos al cliente. No crea facturas fiscales.
// V76: facturas visibles por páginas privadas; no truncar el historial a 50.
export const invoicePageSize=50;
export function invoicePageCount(count){
  return Number.isSafeInteger(count)&&count>=0 ? Math.max(1,Math.ceil(count/invoicePageSize)) : 0;
}
export function invoiceCanAdvance(page,count){
  return Number.isSafeInteger(page)&&page>=0&&page+1<invoicePageCount(count);
}
export async function fetchInvoicesPage(supabase,userId,page=0){
  if(!supabase||typeof userId!=='string'||!userId.trim()||
     !Number.isSafeInteger(page)||page<0||page>100000)
    return {data:null,count:null,error:true};
  try{
    const {data,count,error}=await supabase.from('invoices')
      .select('number,subtotal,vat,total,status,created_at',{count:'exact'})
      .eq('customer_id',userId).neq('status','draft')
      .order('created_at',{ascending:false})
      .order('id',{ascending:false})
      .range(page*invoicePageSize,(page+1)*invoicePageSize-1);
    if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)
      return {data:null,count:null,error:true};
    return {data,count,error:false};
  }catch{
    return {data:null,count:null,error:true};
  }
}
export async function renderInvoices({main,supabase,session,onRefresh,page=0}) {
  const loading=document.createElement('section');loading.className='card';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='back';
  cancel.dataset.back='';cancel.textContent='← Volver';loading.append(cancel);
  const wait=document.createElement('p');wait.textContent='Consultando mis facturas…';loading.append(wait);
  main.replaceChildren(loading);
  const userId=session?.user?.id;
  const {data,count,error}=await fetchInvoicesPage(supabase,userId,page);
  if(!onRefresh()||main.firstElementChild!==loading||!loading.isConnected)return;
  // Si se han eliminado registros de la última página, volver a la última existente.
  if(!error&&count>0&&page>=invoicePageCount(count))
    return renderInvoices({main,supabase,session,onRefresh,page:invoicePageCount(count)-1});
  const section=document.createElement('section');section.className='card';
  const back=document.createElement('button');back.type='button';back.className='back';
  back.dataset.back='';back.textContent='← Volver';section.append(back);
  const title=document.createElement('h2');title.textContent='Mis facturas';section.append(title);
  const note=document.createElement('p');note.className='notice';
  note.textContent='Consulta informativa de documentos registrados para tu cuenta. Los borradores no son visibles; la validez fiscal y los documentos descargables requieren la configuración definitiva de facturación.';
  section.append(note);
  if(error){
    const p=document.createElement('p');
    p.textContent='No se pudieron cargar tus documentos. Comprueba la conexión.';
    section.append(p);
    const retry=document.createElement('button');retry.type='button';
    retry.dataset.view='invoices';retry.textContent='Reintentar';section.append(retry);
  }
  else if(!data?.length){const p=document.createElement('p');p.textContent='Todavía no hay facturas emitidas.';section.append(p);}
  else for(const bill of data){
    const card=document.createElement('article');card.className='request';
    const name=document.createElement('strong');name.textContent='Factura '+bill.number;card.append(name);
    const st=document.createElement('span');st.textContent=invoiceStatusLabels[bill.status]||'Documento registrado';card.append(st);
    const date=document.createElement('p');
    const day=new Date(bill.created_at);
    date.textContent=Number.isFinite(day.getTime())?day.toLocaleDateString('es-ES'):'Fecha no disponible';
    card.append(date);
    const amounts=checkInvoiceAmounts(bill);
    for(const [label,value] of [['Base imponible',bill.subtotal],['IVA (21 %)',bill.vat],['Total',bill.total]]){
      const line=document.createElement('p');line.textContent=label+': '+formatInvoiceEuro(value);card.append(line);
    }
    if(!amounts.valid){
      const issue=document.createElement('p');issue.className='notice';
      issue.setAttribute('role','alert');
      issue.textContent='Importes pendientes de revisión: '+amounts.reason+' Contacta con Reparado.';
      card.append(issue);
    }
    section.append(card);
  }
  if(!error&&count>invoicePageSize){
    const pages=invoicePageCount(count);
    const nav=document.createElement('nav');
    nav.className='staff-new-pagination customer-invoices-pagination';
    nav.setAttribute('aria-label','Páginas de mis facturas');
    const info=document.createElement('span');
    info.textContent='Página '+(page+1)+' de '+pages+' · '+count+' documentos';
    const controls=document.createElement('div');
    const prev=document.createElement('button');
    prev.type='button';prev.textContent='← Anterior';prev.disabled=page===0;
    const next=document.createElement('button');
    next.type='button';next.textContent='Siguiente →';next.disabled=!invoiceCanAdvance(page,count);
    const changePage=nextPage=>{
      if(!onRefresh()||main.firstElementChild!==section||!section.isConnected)return;
      void renderInvoices({main,supabase,session,onRefresh,page:nextPage});
    };
    prev.addEventListener('click',()=>{if(page>0)changePage(page-1)});
    next.addEventListener('click',()=>{if(invoiceCanAdvance(page,count))changePage(page+1)});
    controls.append(prev,next);
    nav.append(info,controls);
    section.append(nav);
  }
  main.replaceChildren(section);
}