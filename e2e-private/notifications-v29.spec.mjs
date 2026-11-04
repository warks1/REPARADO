import {test,expect} from '@playwright/test';

// Pruebas aisladas: solo usan sesión y datos FICTICIOS; jamás contactan REPARADO Test.
const host='https://reparado-test-placeholder.supabase.co';
const userId='a0000000-0000-4000-8000-000000000029';
const noticeId='b0000000-0000-4000-8000-000000000029';
const customer={id:userId,email:'aviso@ejemplo.invalid',aud:'authenticated',
 role:'authenticated',app_metadata:{provider:'email',providers:['email']},
 user_metadata:{},created_at:'2026-10-26T00:00:00.000Z'};
function jwt(){
 const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 return enc({alg:'HS256',typ:'JWT'})+'.'+enc({
   sub:userId,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+7200
 })+'.fake';
}
async function setup(page,{history=null}={}){
 const session={access_token:jwt(),refresh_token:'fake-refresh',token_type:'bearer',
   expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200,user:customer};
 await page.addInitScript(({session})=>{
   localStorage.setItem('sb-reparado-test-placeholder-auth-token',JSON.stringify(session));
 },{session});
 let reads=0;
 const updates=[];
 await page.route(host+'/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname;
   const reply=(value,status=200,one=false,headers={})=>route.fulfill({
     status,contentType:one?'application/vnd.pgrst.object+json':'application/json',
     headers,body:JSON.stringify(value)
   });
   if(path==='/auth/v1/user')return reply(customer,200,true);
   if(path==='/rest/v1/profiles')return reply({id:userId,role:'customer',full_name:'Cliente de prueba',phone:''},200,true);
   if(path==='/rest/v1/customer_reviews')return reply([]);
   if(path==='/rest/v1/support_reports')return reply([]);
   if(path==='/rest/v1/account_deletion_requests')return reply(null,200,true);
   if(path==='/rest/v1/notifications'){
     if(request.method()==='GET'){
       reads++;
       // Error funcional 400 sin reintentos automáticos del SDK: comprueba el aviso y el botón Reintentar.
       if(reads===1)return reply({message:'INTERNAL_SECRET_DO_NOT_SHOW'},400);
       const rows=history||[{id:noticeId,user_id:userId,title:'Aviso de reparación',
         body:'Tu solicitud se ha actualizado.',read:false,created_at:'2026-10-26T12:00:00Z'}];
       const start=Number(url.searchParams.get('offset')||0);
       const limit=Number(url.searchParams.get('limit')||rows.length);
       const visible=rows.slice(start,start+limit);
       const contentRange=visible.length?start+'-'+(start+visible.length-1)+'/'+rows.length:'*/'+rows.length;
       return reply(visible,200,false,{
         'content-range':contentRange,
         'access-control-expose-headers':'content-range',
         'access-control-allow-origin':'*'
       });
     }
     if(request.method()==='PATCH'){
       updates.push({url:url.toString(),body:request.postDataJSON()});
       return reply({id:noticeId},200,true);
     }
   }
   return reply({},404);
 });
 return {readCount:()=>reads,updates};
}
test('V29: perfil permite abrir avisos, reintentar fallo de red y confirmar lectura',async({page})=>{
 const fake=await setup(page);
 await page.goto('/');
 await expect(page.locator('.customer-header')).toBeVisible();
 await page.getByRole('button',{name:'Mi perfil'}).click();
 await expect(page.locator('#profile-form')).toBeVisible();
 await page.getByRole('button',{name:/Mis avisos/}).click();
 await expect(page.locator('main')).toContainText('No se pudieron cargar tus avisos');
 await expect(page.locator('main')).not.toContainText('INTERNAL_SECRET_DO_NOT_SHOW');
 await page.getByRole('button',{name:'Reintentar'}).click();
 await expect(page.locator('main')).toContainText('Aviso de reparación');
 const mark=page.getByRole('button',{name:'Marcar como leído'});
 await mark.click();
 await expect(page.locator('main')).toContainText('Leído');
 expect(fake.readCount()).toBe(2);
 expect(fake.updates).toHaveLength(1);
 expect(fake.updates[0].url).toContain('user_id=eq.'+userId);
 expect(fake.updates[0].url).toContain('id=eq.'+noticeId);
 expect(fake.updates[0].body).toEqual({read:true});
});

test('V79: recuperar avisos anteriores en páginas de 50 sin mezclarlos',async({page})=>{
 const history=Array.from({length:52},(_,i)=>({
   id:'aviso-'+(i+1),title:'Notificación '+String(i+1).padStart(2,'0'),
   body:'Estado de la solicitud '+(i+1),read:true,created_at:'2026-10-26T12:00:00Z'
 }));
 await setup(page,{history});
 await page.goto('/');
 await page.getByRole('button',{name:'Mi perfil'}).click();
 await page.getByRole('button',{name:/Mis avisos/}).click();
 await expect(page.locator('main')).toContainText('No se pudieron cargar tus avisos');
 await page.getByRole('button',{name:'Reintentar'}).click();
 await expect(page.locator('main .request')).toHaveCount(50);
 await expect(page.locator('main')).toContainText('Página 1 de 2');
 await page.getByRole('button',{name:/Siguiente/}).click();
 await expect(page.locator('main .request')).toHaveCount(2);
 await expect(page.locator('main')).toContainText('Notificación 52');
 await page.getByRole('button',{name:/Anterior/}).click();
 await expect(page.locator('main .request')).toHaveCount(50);
 await expect(page.locator('main')).toContainText('Notificación 01');
});
