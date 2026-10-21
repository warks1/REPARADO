import './style.css'
import './customer-theme.css'
import './vivid-theme.css'
import { supabase, isConfigured, authLinkIntent } from './supabase.js'
import { mountLocal } from './local-preview.js'
import { services } from './catalog-data.js'

// Catálogo mostrado por categorías. Los importes son orientativos, IVA incluido.
// Los trabajos sin importe publicado pasan por presupuesto del equipo.

const app=document.querySelector('#app');

function startupFailed(error) {
  console.error('Reparado: fallo de arranque',error);
  window.__reparadoBoot?.fail();
}
if(isConfigured){
  import('./connected.js')
    .then(({mountConnected})=>{
      mountConnected({app,services,supabase,authLinkIntent});
      window.__reparadoBoot?.ready();
    })
    .catch(startupFailed);
}else{
  try {
    // Se conserva el catálogo funcional sin simular envíos a operarios.
    mountLocal({app,services});
    window.__reparadoBoot?.ready();
  } catch (error) {
    startupFailed(error);
  }
}
