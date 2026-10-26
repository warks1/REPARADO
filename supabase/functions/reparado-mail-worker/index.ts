// Worker privado: una solicitud se guarda en Supabase antes de generar el aviso.
// Llamar con una tarea programada segura (Supabase Cron) cada 2-5 minutos.
// Nunca activar desde el navegador ni poner secretos en VITE_*.
import { createClient } from 'npm:@supabase/supabase-js@2';

const REQUESTS_TO='reparado_clientes@outlook.es';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json','cache-control':'no-store'}
});

function constantTimeMatch(actual:string,expected:string):boolean{
  if(!expected||actual.length!==expected.length)return false;
  let mismatch=0;
  for(let i=0;i<actual.length;i++)mismatch|=actual.charCodeAt(i)^expected.charCodeAt(i);
  return mismatch===0;
}

Deno.serve(async(request:Request)=>{
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  const secret=Deno.env.get('REPARADO_MAIL_WORKER_SECRET')||'';
  if(secret.length<32)return json({error:'worker_not_configured'},503);
  if(!constantTimeMatch(request.headers.get('x-reparado-worker-secret')||'',secret)){
    return json({error:'unauthorized'},401);
  }
  const apiKey=Deno.env.get('RESEND_API_KEY')||'';
  const sender=Deno.env.get('REPARADO_EMAIL_FROM')||'';
  const url=Deno.env.get('SUPABASE_URL')||'';
  const roleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  // Misconfiguración: no reclamar una tarea si todavía no podemos entregar.
  if(!apiKey||!sender||!url||!roleKey)return json({error:'mail_delivery_not_configured'},503);

  const db=createClient(url,roleKey,{auth:{persistSession:false}});
  const claim=await db.rpc('reparado_claim_request_email');
  if(claim.error)return json({error:'claim_failed'},503);
  const item=claim.data?.[0];
  if(!item)return json({processed:0});
  const id=String(item.outbox_id),jobId=String(item.job_id);
  const attempt=Number(item.try_number)||1;

  const fail=async(reason:string)=>{
    const retry=attempt<5;
    await db.from('request_email_outbox').update({
      state:retry?'pending':'failed',
      next_attempt_at:new Date(Date.now()+Math.min(attempt*attempt*120000,1800000)).toISOString(),
      claimed_at:null,
      last_error:reason.slice(0,180)
    }).eq('id',id).eq('state','sending');
    return json({processed:0,error:reason,retry},502);
  };

  const {data:job,error:jobError}=await db.from('service_requests')
    .select('id,service_name,category,city,created_at')
    .eq('id',jobId).maybeSingle();
  if(jobError||!job)return fail('request_not_available');

  // Minimización de datos: no enviar nombres, direcciones, teléfonos,
  // descripciones ni fotos por correo; el personal los consulta en la app.
  const service=String(job.service_name||'Servicio').slice(0,140);
  const city=String(job.city||'No indicado').slice(0,100);
  const subject='REPARADO · Nueva solicitud registrada';
  const body=[
    'Se ha registrado una nueva solicitud de reparación.',
    'Referencia: '+jobId,
    'Servicio: '+service,
    'Municipio: '+city,
    'Consulta el panel privado de REPARADO para ver los datos completos.',
    'Este mensaje no incluye datos de contacto ni fotos del cliente.'
  ].join('\n');

  try{
    const res=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+apiKey,
        'Content-Type':'application/json',
        'Idempotency-Key':'reparado-request-'+jobId
      },
      body:JSON.stringify({from:sender,to:[REQUESTS_TO],subject,text:body})
    });
    if(!res.ok)return fail('mail_provider_http_'+res.status);
    const {error:updateError}=await db.from('request_email_outbox').update({
      state:'sent',sent_at:new Date().toISOString(),claimed_at:null,last_error:null
    }).eq('id',id).eq('state','sending');
    if(updateError)return json({processed:1,warning:'status_update_failed'},202);
    return json({processed:1});
  }catch{
    return fail('mail_provider_unreachable');
  }
});
