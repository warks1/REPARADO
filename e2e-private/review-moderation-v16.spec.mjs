import {test,expect} from '@playwright/test';

// Cuenta y respuestas de prueba exclusivamente ficticias: no se toca Supabase real.
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

function samplePending(n){
 return Array.from({length:n},(_,i)=>({
  ...pending,id:'f0000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
  comment:'Opinión auténtica simulada '+String(i+1)+' para comprobar la paginación.'
 }));
}

async function prepare(page,role,{pendingItems=[pending]}={}){
 const session={
  access_token:token(),refresh_token:'fake-refresh-token',token_type:'bearer',expires_in:7200,
  expires_at:Math.floor(Date.now()/1000)+7200,user:admin
 };
 await page.addInitScript(({storageKey,session})=>{
   localStorage.setItem(storageKey,JSON.stringify(session));
 },{storageKey:'sb-reparado-test-placeholder-auth-token',session});
 const moderationRequests=[];
 const queue=pendingItems.map(item=>({...item}));
 await page.route(fakeHost+'/**',async route=>{
   const request=route.request(),url=new URL(request.url()),p=url.pathname;
   const respond=(value,one=false,headers={})=>route.fulfill({
     status:200,contentType:one?'application/vnd.pgrst.object+json':'application/json',
     headers,body:JSON.stringify(value)
   });
   if(p==='/auth/v1/user')return respond(admin,true);
   if(p==='/rest/v1/profiles' && request.method()==='GET'){
     return respond({id:adminId,full_name:'Cuenta de prueba',phone:'',role},true);
   }
   if(p==='/rest/v1/customer_reviews' && request.method()==='GET'){
     if(url.searchParams.get('status')==='eq.pending'){
       moderationRequests.push('LIST');
       const rows=queue.filter(item=>item.status==='pending');
       const offset=Number(url.searchParams.get('offset')||0);
       const limit=Number(url.searchParams.get('limit')||rows.length);
       const result=rows.slice(offset,offset+limit);
       const range=result.length?offset+'-'+(offset+result.length-1)+'/'+rows.length:'*/'+rows.length;
       return respond(result,false,{'content-range':range,
         'access-control-expose-headers':'content-range','access-control-allow-origin':'*'});
     }
     if(url.searchParams.get('status')==='eq.approved')return respond([approved]);
   }
   if(p==='/rest/v1/customer_reviews' && request.method()==='PATCH'){
     moderationRequests.push('UPDATE');
     if(role!=='admin')return route.fulfill({
       status:403,contentType:'application/json',body:JSON.stringify({message:'denied'})
     });
     const id=(url.searchParams.get('id')||'').replace(/^eq\./,'');
     const row=queue.find(item=>item.id===id&&item.status==='pending');
     if(!row)return respond([]);
     const body=JSON.parse(request.postData()||'{}');
     row.status=body.status;
     return respond([{id:row.id,status:row.status}]);
   }
   if(p==='/rest/v1/service_requests')return respond([]);
   return route.fulfill({status:404,contentType:'application/json',body:'{}'});
 });
 return moderationRequests;
}

async function openModeration(page){
 await page.goto('/');
 await expect(page.locator('.customer-header')).toBeVisible();
 await page.locator('.customer-nav [data-view="profile"]').click();
 const link=page.locator('[data-view="review-moderation"]');
 await expect(link).toBeVisible();
 await link.click();
 await expect(page.locator('#review-moderation')).toBeVisible();
}

test('administrador invitado puede aprobar una reseña real pendiente',async({page})=>{
 const called=await prepare(page,'admin');
 await openModeration(page);
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

test('V81: 126 reseñas pendientes se pueden revisar por las tres páginas',async({page})=>{
 const calls=await prepare(page,'admin',{pendingItems:samplePending(126)});
 await openModeration(page);
 const section=page.locator('#review-moderation');
 await expect(section.locator('.review-moderation-card')).toHaveCount(50);
 await expect(section.locator('[data-review-moderation-feedback]')).toContainText('126 reseña(s)');
 await section.locator('[data-moderation-page="next"]').click();
 await expect(section.locator('[data-moderation-page-label]')).toContainText('Página 2 de 3');
 await expect(section.locator('.review-moderation-card')).toHaveCount(50);
 await section.locator('[data-moderation-page="next"]').click();
 await expect(section.locator('[data-moderation-page-label]')).toContainText('Página 3 de 3');
 await expect(section.locator('.review-moderation-card')).toHaveCount(26);
 await section.locator('[data-review-decision="rejected"]').first().click();
 await expect(section.locator('[data-review-moderation-feedback]')).toContainText('Reseña rechazada');
 await expect(section.locator('[data-review-moderation-feedback]')).toContainText('125 reseña(s)');
 await expect(section.locator('.review-moderation-card')).toHaveCount(25);
 await expect(section.locator('[data-moderation-page="next"]')).toBeDisabled();
 expect(calls).toContain('UPDATE');
});

test('V81: al aprobar el único registro de la última página, regresa a la anterior',async({page})=>{
 await prepare(page,'admin',{pendingItems:samplePending(51)});
 await openModeration(page);
 const section=page.locator('#review-moderation');
 await section.locator('[data-moderation-page="next"]').click();
 await expect(section.locator('.review-moderation-card')).toHaveCount(1);
 await section.locator('[data-review-decision="approved"]').first().click();
 await expect(section.locator('[data-review-moderation-feedback]')).toContainText('Reseña aprobada');
 await expect(section.locator('[data-moderation-page-label]')).toContainText('Página 1 de 1');
 await expect(section.locator('.review-moderation-card')).toHaveCount(50);
 await expect(section.locator('[data-moderation-page="prev"]')).toBeDisabled();
});
