import {vatIncluded} from './staff-workflows.js';

// Calculadora para presupuestos internos. Todas las entradas son cantidades
// y precios finales con IVA incluido. No crea documentos fiscales ni envíos.
const cents=(value,name,{allowZero=true,max=999999}={})=>{
 const raw=String(value??'').trim();
 if(!/^(?:0|[1-9]\d{0,5})(?:[.,]\d{1,2})?$/.test(raw))
   throw new Error(name+': indica un número válido con hasta dos decimales.');
 const n=Number(raw.replace(',','.'));
 if(!Number.isFinite(n)||n>max||(!allowZero&&n<=0))
   throw new Error(name+': importe o cantidad fuera del rango permitido.');
 return Math.round(n*100);
};
export function calculateQuoteLines(input){
 if(!Array.isArray(input)||!input.length||input.length>12)
   throw new Error('Añade entre 1 y 12 partidas al presupuesto.');
 let totalCents=0;
 const lines=input.map((item,index)=>{
   const name=String(item?.name??'').trim();
   if(!name||name.length>120)throw new Error('Partida '+(index+1)+': descripción obligatoria (máximo 120 caracteres).');
   const q=cents(item.quantity,'Cantidad de '+name,{allowZero:false,max:9999});
   const unit=cents(item.unitPrice,'Precio de '+name);
   const lineCents=Math.round(q*unit/100);
   totalCents+=lineCents;
   if(totalCents>99999900)throw new Error('El total supera el límite permitido.');
   return {name,quantity:q/100,unitPrice:unit/100,total:lineCents/100};
 });
 const total=totalCents/100;
 return {lines,...vatIncluded(total)};
}
