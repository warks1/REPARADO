// Cálculos defensivos para mostrar importes que vienen del servidor.
// El total mostrado nunca se recalcula silenciosamente ni se considera
// un documento fiscal válido solo por estar presente en la tabla.
const cents=v=>{
  if(v===null||v===undefined||typeof v==='boolean'||String(v).trim()==='')return null;
  const n=Number(v);
  if(!Number.isFinite(n)||n<0||n>99999999.99)return null;
  return Math.round((n+Number.EPSILON)*100);
};
export function checkInvoiceAmounts({subtotal,vat,total}={}){
  const baseCents=cents(subtotal),vatCents=cents(vat),totalCents=cents(total);
  if([baseCents,vatCents,totalCents].some(v=>v===null))
    return {valid:false,reason:'Hay importes ausentes o no válidos.'};
  if(Math.abs(baseCents+vatCents-totalCents)>1)
    return {valid:false,reason:'La base imponible más el IVA no coincide con el total.'};
  const expectedVAT=Math.round(baseCents*.21);
  if(Math.abs(vatCents-expectedVAT)>1)
    return {valid:false,reason:'El IVA registrado no corresponde al 21 % de la base imponible.'};
  return {valid:true,reason:null};
}
export function formatInvoiceEuro(value){
  const n=Number(value);
  if(value===null||value===undefined||String(value).trim()===''||!Number.isFinite(n))
    return 'Importe no disponible';
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(n);
}
export const invoiceStatusLabels={
  issued:'Emitida',paid:'Pagada',cancelled:'Anulada'
};
