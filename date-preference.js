// REPARADO V64 · Fechas de solicitud en calendario de Cataluña.
// La fecha elegida es una PREFERENCIA, nunca confirma disponibilidad ni reserva.
import {validLocalDate} from './local-data.js';

const madrid=new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'
});

export function todayInCatalonia(instant=new Date()){
  const parts=madrid.formatToParts(instant);
  const part=type=>parts.find(item=>item.type===type)?.value||'';
  return [part('year'),part('month'),part('day')].join('-');
}

export function preferredDateIssue(rawDate,instant=new Date()){
  if(rawDate===null||rawDate===undefined||rawDate==='')return null;
  const date=String(rawDate);
  if(!validLocalDate(date))return 'Introduce una fecha preferida válida.';
  if(date<todayInCatalonia(instant))
    return 'La fecha preferida ya ha pasado. Elige hoy o una fecha posterior en Cataluña.';
  return null;
}

export function preferredDateField(){
  return '<label>Fecha preferida (opcional)'+
    '<input name="preferred_date" type="date" min="'+todayInCatalonia()+'">'+
    '</label><p class="notice date-preference-hint">Es una fecha orientativa. El equipo confirmará la visita y el horario.</p>';
}

export function preferredDateMinimum(input,instant=new Date()){
  // Al abrir un formulario a medianoche, el mínimo del HTML podría quedarse
  // desactualizado; actualizar antes del envío, además de validar.
  if(input)input.min=todayInCatalonia(instant);
}

export function validExistingPreferredDate(date){
  // Permitir ver fechas antiguas sin fingir que siguen disponibles.
  return validLocalDate(date)?date:'';
}
