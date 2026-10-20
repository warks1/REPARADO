import './style.css'
import './customer-theme.css'
import './vivid-theme.css'
import { supabase, isConfigured } from './supabase.js'
import { mountLocal } from './local-preview.js'

// Catálogo mostrado por categorías. Los importes son orientativos, IVA incluido.
// Los trabajos sin importe publicado pasan por presupuesto del equipo.
const services=[
 ['Fontanería','Desatasco de lavabo o fregadero',89],
 ['Fontanería','Cambio de sifón',79],
 ['Fontanería','Reparación de fuga',115],
 ['Fontanería','Sustitución de grifo',105],
 ['Fontanería','Mecanismo de cisterna',119],
 ['Fontanería','Cambio de llave de paso',99],
 ['Fontanería','Instalación de termo eléctrico',0],
 ['Fontanería','Revisión de instalación de agua',0],
 ['Albañilería','Reposición de azulejos',95],
 ['Albañilería','Alicatado',42,'m²'],
 ['Albañilería','Solado de gres',45,'m²'],
 ['Albañilería','Rejuntado',32,'m²'],
 ['Albañilería','Tabique de Pladur',58,'m²'],
 ['Albañilería','Trasdosado de Pladur',52,'m²'],
 ['Albañilería','Techo de Pladur',55,'m²'],
 ['Albañilería','Reparación de enlucidos',0],
 ['Parquet','Instalación de parquet/laminado',34,'m²'],
 ['Parquet','Reparación de tablas',110],
 ['Parquet','Acuchillado/lijado',38,'m²'],
 ['Parquet','Barnizado',31,'m²'],
 ['Parquet','Retirada de pavimento',17,'m²'],
 ['Parquet','Colocación de rodapié',0],
 ['Reformas integrales','Reforma integral de baño',0],
 ['Reformas integrales','Reforma integral de cocina',0],
 ['Reformas integrales','Reforma de vivienda',0]
];
const app=document.querySelector('#app');

if(isConfigured){
  import('./connected.js')
    .then(({mountConnected})=>mountConnected({app,services,supabase}))
    .catch(error=>{
      console.error('Reparado: fallo de arranque',error);
      app.innerHTML='<section class="card" style="max-width:600px;margin:8vh auto"><h1>Reparado</h1><p>No hemos podido iniciar el servicio. Comprueba tu conexión e inténtalo de nuevo.</p><button onclick="location.reload()">Reintentar</button></section>';
    });
}else{
  // No se simula un backend: la interfaz es real, pero guardará solo en local.
  mountLocal({app,services});
}
