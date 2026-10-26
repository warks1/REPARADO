// Destinatarios oficiales de REPARADO. Solo son direcciones de contacto;
// nunca colocar aquí contraseñas, tokens SMTP ni claves privadas.
export const REPARADO_SUPPORT_EMAIL='reparado_soporte@outlook.es';
export const REPARADO_REQUESTS_EMAIL='reparado_clientes@outlook.es';

const subjectText=(subject)=>String(subject||'').slice(0,140);
export function mailto(to,subject,body=''){
  return 'mailto:'+to+'?subject='+encodeURIComponent(subjectText(subject))+
    (body?'&body='+encodeURIComponent(String(body).slice(0,1200)):'');
}

export function reportIssueHref(){
  return mailto(
    REPARADO_SUPPORT_EMAIL,
    'Incidencia o fallo en la app REPARADO',
    'Describe el problema detectado:\n\nPantalla o sección:\n\nQué ocurrió:\n\nDispositivo (opcional):\n\nNo incluyas contraseñas ni información personal de otros clientes.'
  );
}

export function repairInquiryHref(){
  return mailto(
    REPARADO_REQUESTS_EMAIL,
    'Consulta o solicitud de reparación · REPARADO',
    'Indica el servicio que necesitas:\n\nMunicipio:\n\nDescripción breve:\n\nPara solicitudes dentro de la app, utiliza el formulario de solicitud. No envíes documentos personales por este correo.'
  );
}

export function contactLinksMarkup(){
  return '<div class="reparado-contact-links" aria-label="Correos de contacto">'+
    '<a href="'+reportIssueHref()+'">🐞 Comunicar un fallo de la app</a>'+
    '<a href="'+repairInquiryHref()+'">✉️ Consultas y solicitudes de reparación</a>'+
    '</div>';
}
