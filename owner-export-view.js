// REPARADO V97 · Exportación operativa privada del propietario.
// No expone facturas fiscales, ni teléfonos o direcciones en el CSV.
import {buildOwnerWorkCsv,shareOwnerWorkCsv,ownerExportStatuses} from './owner-work-export.js';

const options=Object.freeze([
 ['all','Todos los trabajos'],['new','Nuevas solicitudes'],
 ['quoted','Presupuestadas'],['accepted','Presupuestos aceptados'],
 ['scheduled','Programadas'],['in_progress','En curso'],
 ['completed','Terminadas'],['cancelled','Canceladas']
]);

export async function mountOwnerWorkExport({main,supabase,ownerId,isActive,onBack}){
  if(!isActive())return;
  main.innerHTML='<section class="card owner-work-export" id="reparado-owner-work-export">'+
    '<button type="button" class="screen-back" data-owner-export-back>← Panel del propietario</button>'+
    '<div class="owner-heading"><div><p class="owner-eyebrow">GESTIÓN PRIVADA</p>'+
    '<h1>Exportar historial de trabajos</h1>'+
    '<p>Informe CSV compatible con Excel, no es una factura fiscal</p></div></div>'+
    '<p>Descarga exclusivamente la referencia, el servicio, la categoría, el estado, '+
    'la población, el precio con IVA incluido, el operario y las fechas. '+
    'No incluye datos de contacto, direcciones ni nombres de clientes.</p>'+
    '<form data-owner-export-form class="owner-export-form">'+
    '<label>Seleccionar trabajos<select name="status">'+
    options.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+
    '</select></label><button type="submit" data-owner-export-prepare>Preparar CSV</button></form>'+
    '<p role="status" aria-live="polite" data-owner-export-status>'+
    'Selecciona un estado y prepara el informe privado.</p>'+
    '<button type="button" data-owner-export-download disabled>'+
    'Guardar o compartir CSV</button>'+
    '<p class="owner-security">El archivo contiene información interna. Guárdalo '+
    'en un lugar seguro. Máximo 10.000 trabajos por copia; si el historial es '+
    'mayor, prepara informes separados por estado. Se vuelve a comprobar '+
    'tu sesión antes de permitir la descarga.</p>'+
    '</section>';
  const root=main.querySelector('#reparado-owner-work-export');
  const active=()=>root.isConnected&&isActive();
  const form=root.querySelector('[data-owner-export-form]');
  const feedback=root.querySelector('[data-owner-export-status]');
  const prepare=root.querySelector('[data-owner-export-prepare]');
  const download=root.querySelector('[data-owner-export-download]');
  let prepared=null,working=false;
  const clear=()=>{
    prepared=null;download.disabled=true;
  };
  form.querySelector('[name="status"]').addEventListener('change',()=>{
    if(!active()||working)return;
    clear();
    feedback.textContent='El filtro ha cambiado. Prepara un nuevo CSV.';
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!active()||working)return;
    const selected=form.elements.namedItem('status')?.value;
    if(!ownerExportStatuses.includes(selected))return;
    working=true;prepare.disabled=true;
    clear();feedback.textContent='Comprobando sesión y leyendo trabajos…';
    try{
      const file=await buildOwnerWorkCsv({
        supabase,ownerId,isActive:active,status:selected,
        onProgress:(amount,total)=>{
          if(active())feedback.textContent='Leyendo '+amount+' de '+total+' trabajos…';
        }
      });
      if(!active())return;
      prepared=file;download.disabled=false;
      feedback.textContent=file.count+' trabajo(s) preparados para guardar en CSV. '+
        'No se ha emitido ninguna factura.';
    }catch(error){
      if(active()){
        clear();feedback.textContent=error?.message||
          'No se pudo preparar el informe privado.';
      }
    }finally{
      working=false;
      if(active())prepare.disabled=false;
    }
  });
  download.addEventListener('click',async()=>{
    if(!active()||working||!prepared)return;
    const current=prepared;
    working=true;download.disabled=true;
    try{
      const result=await shareOwnerWorkCsv(current,{
        ownerId,isActive:active
      });
      if(active())feedback.textContent=result.mode==='native'?
        'Se ha abierto la opción para guardar o compartir el informe privado.':
        'Se ha iniciado la descarga del informe CSV privado.';
    }catch(error){
      if(active())feedback.textContent=error?.message||
        'No se pudo guardar o compartir el archivo.';
    }finally{
      working=false;
      if(active())download.disabled=!prepared;
    }
  });
  root.querySelector('[data-owner-export-back]').addEventListener('click',()=>{
    if(!active())return;
    clear();onBack();
  });
}
