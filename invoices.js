import {checkInvoiceAmounts,formatInvoiceEuro,invoiceStatusLabels} from './invoice-math.js';
// Lista de documentos emitidos al cliente. No crea facturas fiscales.
export async function renderInvoices({main,supabase,session,onRefresh}) {
  const loading=document.createElement('section');loading.className='card';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='back';
  cancel.dataset.back='';cancel.textContent='← Volver';loading.append(cancel);
  const wait=document.createElement('p');wait.textContent='Consultando mis facturas…';loading.append(wait);
  main.replaceChildren(loading);
  const userId=session?.user?.id;
  let data,error;
  try{
    if(!userId)throw new Error('Sesión no disponible');
    ({data,error}=await supabase.from('invoices')
      .select('number,subtotal,vat,total,status,created_at')
      .eq('customer_id',userId).neq('status','draft')
      .order('created_at',{ascending:false}).limit(50));
  }catch{error=new Error('No se pudo conectar');}
  if(!onRefresh()||main.firstElementChild!==loading||!loading.isConnected)return;
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
  main.replaceChildren(section);
}