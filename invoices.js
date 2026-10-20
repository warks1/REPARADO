// Lista de documentos emitidos al cliente. No crea facturas fiscales.
export async function renderInvoices({main,supabase,session,onRefresh}) {
  const loading=document.createElement('section');loading.className='card';
  loading.textContent='Consultando mis facturas…';main.replaceChildren(loading);
  const {data,error}=await supabase.from('invoices')
    .select('number,subtotal,vat,total,status,created_at')
    .eq('customer_id',session.user.id).neq('status','draft')
    .order('created_at',{ascending:false}).limit(50);
  if(!onRefresh())return;
  const section=document.createElement('section');section.className='card';
  const back=document.createElement('button');back.type='button';back.className='back';
  back.dataset.back='';back.textContent='← Volver';section.append(back);
  const title=document.createElement('h2');title.textContent='Mis facturas';section.append(title);
  const note=document.createElement('p');note.className='notice';
  note.textContent='Se muestran los documentos registrados y emitidos por Reparado. Las facturas borrador no se muestran al cliente.';
  section.append(note);
  if(error){const p=document.createElement('p');p.textContent='Error al consultar: '+error.message;section.append(p);}
  else if(!data?.length){const p=document.createElement('p');p.textContent='Todavía no hay facturas emitidas.';section.append(p);}
  else for(const bill of data){
    const card=document.createElement('article');card.className='request';
    const name=document.createElement('strong');name.textContent='Factura '+bill.number;card.append(name);
    const st=document.createElement('span');st.textContent=bill.status;card.append(st);
    const date=document.createElement('p');date.textContent=new Date(bill.created_at).toLocaleDateString('es-ES');card.append(date);
    for(const [label,value] of [['Base imponible',bill.subtotal],['IVA',bill.vat],['Total',bill.total]]){
      const line=document.createElement('p');line.textContent=label+': '+Number(value).toFixed(2)+' €';card.append(line);
    }
    section.append(card);
  }
  main.replaceChildren(section);
}