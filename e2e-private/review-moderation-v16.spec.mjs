import {test,expect} from '@playwright/test';

// Sesión y servidor TOTALMENTE FICTICIOS en navegador aislado de Playwright.
// Nunca llama al Supabase real ni almacena credenciales de clientes.
const fakeHost='https://reparado-test-placeholder.supabase.co';
const adminId='a0000000-0000-4000-8000-000000000001';
const reviewId='b0000000-0000-4000-8000-000000000002';
const admin={
 id:adminId,email:'administrador@ejemplo.invalid',aud:'authenticated',role:'authenticated',
 app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-10-22T00:00:00.000Z'
};
const pending={
 id:reviewId,rating:4,comment:'Servicio bien realizado y trato muy correcto.',
 status:'pending',created_at:'2026-10-22T13:00:00Z'
};
const approved={...pending,status:'approved'};
function token(){
 const encoded=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 return encoded({alg:'HS256',typ:'JWT'})+'.'+encoded({sub:adminId,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+7200})+'.fakesignature';
}
async function prepare(page, role){
 const session={
  access_token:token(),refresh_token:'fake-refresh-token',token_type:'bearer',expires_in:7200,
  expires_at:Math.floor(Date.now()/1000)+7200,user:admin
 };
 await page.addInitScript(({storageKey,session})=>{
   localStorage.setItem(storageKey,JSON.stringify(session));
 },{storageKey:'sb-reparado-test-placeholder-auth-token',session});
 const moderationRequests=[];
 await page.route(fakeHost+'/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   const p=url.pathname;
   const respond=(value,one=false)=>route.fulfill({
     status:200,contentType:one?'application/vnd.pgrst.object+json':'application/json',
     headers:{'content-range':'0-0/1'},body:JSON.stringify(value)
   });
   if(p==='/auth/v1/user')return respond(admin,true);
   if(p==='/rest/v1/profiles' && request.method()==='GET'){
     return respond({id:adminId,full_name:'Cuenta de prueba',phone:'',role},true);
   }
   if(p==='/rest/v1/customer_reviews' && request.method()==='GET'){
     if(url.searchParams.get('status')==='eq.pending'){
       moderationRequests.push('LIST');
       return respond([pending]);
     }
     if(url.searchParams.get('status')==='eq.approved')return respond([approved]);
   }
   if(p==='/rest/v1/customer_reviews' && request.method()==='PATCH'){
     moderationRequests.push('UPDATE');
     if(role!=='admin')return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'denied'})});
     if(!url.searchParams.get('id')?.includes(reviewId))return route.abort();
     return respond([{id:reviewId,status:'approved'}]);
   }
   if(p==='/rest/v1/service_requests')return respond([]);
   return route.fulfill({status:404,contentType:'application/json',body:'{}'});
 });
 return moderationRequests;
}
test('administrador invitado puede aprobar una reseña real pendiente',async({page})=>{
 const called=await prepare(page,'admin');
 await page.goto('/');
 await expect(page.locator('.customer-header')).toBeVisible();
 await page.locator('.customer-nav [data-view="profile"]').click();
 const link=page.locator('[data-view="review-moderation"]');
 await expect(link).toBeVisible();
 await link.click();
 await expect(page.locator('#review-moderation')).toBeVisible();
 await expect(page.locator('.review-moderation-card')).toHaveCount(1);
 await expect(page.locator('.review-moderation-card')).toContainText('Servicio bien realizado');
 await expect(page.locator('.review-moderation-card')).not.toContainText('Ejemplo ficticio');
 await page.getByRole('button',{name:'Aprobar y publicar'}).click();
 await expect(page.locator('[data-review-moderation-feedback]')).toContainText('Reseña aprobada');
 await expect(page.locator('.review-moderation-card')).toHaveCount(0);
 expect(called).toContain('UPDATE');
});
test('operario no recibe botones para moderar reseñas ni datos pendientes',async({page})=>{
 const called=await prepare(page,'operator');
 await page.goto('/');
 await page.locator('.customer-nav [data-view="profile"]').click();
 await expect(page.locator('[data-view="review-moderation"]')).toHaveCount(0);
 await expect(page.locator('#review-moderation')).toHaveCount(0);
 expect(called).not.toContain('LIST');
 expect(called).not.toContain('UPDATE');
});
