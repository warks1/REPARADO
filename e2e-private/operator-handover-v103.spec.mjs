import {test,expect} from '@playwright/test';

// V103: pruebas con Supabase simulado, sin llamadas a clientes reales.
const endpoint='https://reparado-test-placeholder.supabase.co';
const adminId='a0000000-0000-4000-8000-000000000001';
const oldOp='b0000000-0000-4000-8000-000000000002';
const newOp='c0000000-0000-4000-8000-000000000003';
const customerId='d0000000-0000-4000-8000-000000000004';
const jobId='e0000000-0000-4000-8000-000000000005';
const picture='foto-'+('ab'.repeat(32))+'.jpg';
function jwt(uid){
 const e=obj=>Buffer.from(JSON.stringify(obj)).toString('base64url');
 return e({alg:'HS256',typ:'JWT'})+'.'+e({
  sub:uid,role:'authenticated',aud:'authenticated',
  exp:Math.floor(Date.now()/1000)+3600
 })+'.signature-fake';
}
async function fakeOwner(page){
 const user={id:adminId,email:'owner@example.invalid',role:'authenticated',aud:'authenticated',
  app_metadata:{provider:'email',providers:['email']},user_metadata:{},
  created_at:'2026-10-01T00:00:00Z'};
 const session={access_token:jwt(adminId),refresh_token:'fake',
  token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
 await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{
  key:'sb-reparado-test-placeholder-auth-token',session
 });
 const job={
  id:jobId,customer_id:customerId,service_name:'Instalación eléctrica',
  category:'Electricidad',status:'in_progress',
  operator_id:newOp,operator_name:'Operario sustituto',scheduled_at:'2026-11-10T09:00:00Z',
  street:'Calle Ficticia',address_number:'7',postal_code:'08001',
  city:'Barcelona',phone:'600000000',description:'Revisar instalación',price:180,
  work_started_at:'2026-11-10T09:00:00Z',work_finished_at:null
 };
 const history=[
  {request_id:jobId,operator_id:oldOp,
   description:'Se ha revisado el cuadro antiguo y detectado el fallo.',
   created_at:'2026-11-10T09:00:00Z'},
  {request_id:jobId,operator_id:newOp,
   description:'Se ha reparado la conexión y probado el cuadro.',
   created_at:'2026-11-10T10:00:00Z'}
 ];
 const transfers=[{request_id:jobId,previous_operator_id:oldOp,
  next_operator_id:newOp,changed_by:adminId,
  changed_at:'2026-11-10T09:50:00Z',status_at_transfer:'in_progress'}];
 const fulfill=(route,data,count=1,one=false)=>route.fulfill({
  status:200,contentType:one?'application/vnd.pgrst.object+json':'application/json',
  headers:{'content-range':'0-'+Math.max(0,(Array.isArray(data)?data.length:1)-1)+'/'+count,
   'access-control-expose-headers':'Content-Range','access-control-allow-origin':'*'},
  body:JSON.stringify(data)
 });
 await page.route(endpoint+'/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  const method=request.method(),path=url.pathname;
  if(method==='OPTIONS')return route.fulfill({status:200,headers:{
   'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
  if(path==='/auth/v1/user')return fulfill(route,user,1,true);
  if(method==='HEAD')return route.fulfill({status:200,headers:{
   'content-range':'*/1','access-control-expose-headers':'Content-Range',
   'access-control-allow-origin':'*'},body:''});
  if(path==='/rest/v1/profiles'){
   if(url.searchParams.has('role')&&url.searchParams.get('role')==='eq.operator')
    return fulfill(route,[{id:oldOp,role:'operator',full_name:'Operario anterior'},
      {id:newOp,role:'operator',full_name:'Operario sustituto'}],2);
   if(url.searchParams.has('id')&&url.searchParams.get('id')?.startsWith('in.'))
    return fulfill(route,[{id:customerId,full_name:'Cliente simulado'}],1);
   return fulfill(route,{id:adminId,full_name:'Propietario simulado',
    phone:'',role:'admin'},1,true);
  }
  if(path==='/rest/v1/service_requests'&&method==='GET')
   return url.searchParams.has('id')?
    fulfill(route,job,1,true):fulfill(route,[job],1);
  if(path==='/rest/v1/work_reports'&&method==='GET')
   return fulfill(route,history,2);
  if(path==='/rest/v1/work_operator_transfers'&&method==='GET')
   return fulfill(route,transfers,1);
  if(path==='/storage/v1/object/list/work-photos'&&method==='POST')
   return fulfill(route,[{name:picture}],1);
  if(path.startsWith('/storage/v1/object/sign/work-photos/')&&method==='POST')
   return fulfill(route,{signedURL:'/storage/v1/object/sign/work-photos/foto.jpg?token=mock'},1,true);
  // La URL firmada debe devolver una imagen real: de otro modo el navegador
  // simula un enlace caducado y activa la recuperación V108 sin necesidad.
  if(method==='GET'&&url.searchParams.get('token')==='mock')
   return route.fulfill({status:200,contentType:'image/png',
    body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC','base64')});
  if(path==='/rest/v1/customer_reviews'||path==='/rest/v1/support_reports')
   return fulfill(route,[],0);
  return route.fulfill({status:404,contentType:'application/json',
   body:'{"message":"Endpoint no previsto en el simulador"}'});
 });
}

test('V103: el propietario conserva los partes y fotografías de ambos operarios',async({page})=>{
 await fakeOwner(page);
 await page.goto('/');
 await page.locator('.customer-nav [data-view="profile"]').click();
 await page.locator('[data-view="admin"]').click();
 const card=page.locator('.job-card').filter({hasText:'Instalación eléctrica'});
 await expect(card.locator('[data-work-detail]')).toContainText('Ver parte de trabajo');
 await card.locator('[data-work-detail]').click();
 const part=page.locator('#reparado-operator-work');
 await expect(part).toBeVisible();
 const previous=part.locator('[data-work-report-operator="'+oldOp+'"]');
 const current=part.locator('[data-work-report-operator="'+newOp+'"]');
 await expect(previous).toContainText('detectado el fallo');
 await expect(current).toContainText('probado el cuadro');
 await expect(part.locator('[data-work-photo-count]')).toContainText('2 fotografías del historial');
 await expect(part.locator('.operator-work-gallery a')).toHaveCount(2);
 await expect(previous.locator('[data-work-gallery-operator="'+oldOp+'"] a')).toHaveCount(1);
 await expect(current.locator('[data-work-gallery-operator="'+newOp+'"] a')).toHaveCount(1);
 await expect(previous.locator('[data-work-gallery-operator="'+newOp+'"]')).toHaveCount(0);
 await expect(current.locator('[data-work-gallery-operator="'+oldOp+'"]')).toHaveCount(0);
 await expect(previous.locator('img')).toHaveAttribute('alt',/Foto del trabajo de/);
 await expect(current.locator('img')).toHaveAttribute('alt',/Foto del trabajo de/);
 await expect(part.locator('[data-work-gallery]')).toHaveCount(0);
 await expect(part.locator('.operator-work-transfer')).toContainText('De '+oldOp+' a '+newOp);
 await expect(part.locator('[data-work-finish]')).toHaveCount(0);
});
