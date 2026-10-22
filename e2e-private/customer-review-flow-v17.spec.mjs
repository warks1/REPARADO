import {test,expect} from '@playwright/test';

// Simulación totalmente aislada de Supabase. No utiliza credenciales ni usuarios reales.
const host='https://reparado-test-placeholder.supabase.co';
const customerId='a0000000-0000-4000-8000-000000000021';
const completedId='b0000000-0000-4000-8000-000000000021';
const newId='b0000000-0000-4000-8000-000000000022';
const customer={id:customerId,email:'cliente@ejemplo.invalid',aud:'authenticated',
 role:'authenticated',app_metadata:{provider:'email',providers:['email']},
 user_metadata:{},created_at:'2026-10-22T00:00:00.000Z'};
function jwt(){
 const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 return enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:customerId,role:'authenticated',
  aud:'authenticated',exp:Math.floor(Date.now()/1000)+7200})+'.fake';
}
const jobs=[
 {id:completedId,service_name:'Cambio de grifo',status:'completed',price:89,
  street:'Calle de prueba',address_number:'1',city:'Barcelona',scheduled_at:null},
 {id:newId,service_name:'Cambio de sifón',status:'new',price:60,
  street:'Calle de prueba',address_number:'2',city:'Barcelona',scheduled_at:null}
];
async function setup(page){
 const session={access_token:jwt(),refresh_token:'fake-refresh',token_type:'bearer',expires_in:7200,
 expires_at:Math.floor(Date.now()/1000)+7200,user:customer};
 await page.addInitScript(({session})=>{
   localStorage.setItem('sb-reparado-test-placeholder-auth-token',JSON.stringify(session));
 },{session});
 const writes=[];
 await page.route(host+'/**',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname;
   const respond=(value,one=false,status=200)=>route.fulfill({
     status,contentType:one?'application/vnd.pgrst.object+json':'application/json',
     body:JSON.stringify(value)
   });
   if(p==='/auth/v1/user')return respond(customer,true);
   if(p==='/rest/v1/profiles')return respond({id:customerId,full_name:'Cuenta de prueba',
     phone:'',role:'customer'},true);
   if(p==='/rest/v1/service_requests'&&req.method()==='GET'){
     return respond(url.searchParams.get('status')==='eq.completed'?[jobs[0]]:jobs);
   }
   if(p==='/rest/v1/customer_reviews' && req.method()==='GET')return respond([]);
   if(p==='/rest/v1/customer_reviews' && req.method()==='POST'){
     writes.push(JSON.parse(req.postData()||'{}'));
     return respond([],false,201);
   }
   return route.fulfill({status:404,contentType:'application/json',body:'{}'});
 });
 return writes;
}

test('solo trabajos terminados ofrecen valoración; se preselecciona el correcto',async({page})=>{
 const writes=await setup(page);
 await page.goto('/');
 await expect(page.locator('.customer-header')).toBeVisible();
 await page.locator('.customer-nav [data-view="requests"]').click();
 await expect(page.locator('.request')).toHaveCount(2);
 const rate=page.locator('[data-rate-request]');
 await expect(rate).toHaveCount(1);
 await expect(rate).toHaveAttribute('data-rate-request',completedId);
 await rate.click();
 const section=page.locator('#reparado-reviews');
 await expect(section).toBeVisible();
 await expect(section.locator('#reparado-review-form')).toBeVisible();
 await expect(section.locator('select[name=request_id]')).toHaveValue(completedId);
 await expect(section.locator('[data-review-mode-info]')).toContainText('Cambio de grifo');
 await section.locator('select[name=rating]').selectOption('4');
 await section.locator('textarea[name=comment]').fill('Reparación correcta y servicio puntual.');
 await section.getByRole('button',{name:'Enviar valoración'}).click();
 await expect(section.locator('[data-review-feedback]')).toContainText('pendiente de revisión');
 expect(writes).toHaveLength(1);
 expect(writes[0]).toMatchObject({
   customer_id:customerId,request_id:completedId,rating:4,
   comment:'Reparación correcta y servicio puntual.'
 });
});
