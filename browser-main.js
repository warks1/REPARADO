// Inicio compatible con GitHub Pages si sirve el repositorio sin pasar por Vite.
// Mantiene solicitudes, perfil, agenda y borradores existentes en localStorage.
// No finge disponer de backend ni de servicios de administración.
import {services} from './catalog-data.js';
import {mountLocal} from './local-preview.js';

export function startLocalBrowser(){
  const root=document.querySelector('#app');
  if(!root)throw new Error('No se encontró el contenedor de Reparado');
  if(window.__reparadoLocalStarted)return;
  for(const [selector,href] of [
    ['link[rel="icon"]','public/icon.svg'],
    ['link[rel="apple-touch-icon"]','public/apple-touch-icon.png'],
    ['link[rel="manifest"]','public/manifest.webmanifest']
  ]){
    const link=document.querySelector(selector);
    if(link)link.href=new URL(href,document.baseURI).href;
  }
  for(const path of ['style.css','customer-theme.css','vivid-theme.css']){
    const href=new URL(path,document.baseURI).href;
    if(!document.querySelector('link[data-reparado-css="'+path+'"]')){
      const link=document.createElement('link');
      link.rel='stylesheet';link.href=href;
      link.dataset.reparadoCss=path;
      document.head.append(link);
    }
  }
  mountLocal({app:root,services});
  window.__reparadoLocalStarted=true;
  window.__reparadoBoot?.ready();
  const notice=document.querySelector('#main');
  if(notice){
    const p=document.createElement('p');
    p.className='notice browser-fallback-notice';
    p.textContent='Modo local: puedes probar y guardar solicitudes en este dispositivo. No se enviarán al equipo hasta activar la conexión.';
    notice.prepend(p);
  }
}
