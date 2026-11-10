import {test,expect} from '@playwright/test';

// V105 · Simulación sin datos reales ni conexión al Supabase del usuario.
const host='https://reparado-test-placeholder.supabase.co';
const owner='a0000000-0000-4000-8000-000000000001';
const customer='b0000000-0000-4000-8000-000000000002';
const request='c0000000-0000-4000-8000-000000000003';
const issueDate='2026-11-09T09:00:00Z';
function jwt(id){
  const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  return enc({alg:'HS256',typ:'JWT'})+'.'+enc({
    sub:id,role:'authenticated',aud:'authenticated',
    exp:Math.floor(Date.now()/1000)+3600
  })+'.fake';
}
async function setup(page,role='admin'){
 const id=role==='admin'?owner:customer;
 const user={id,email:role+'@example.invalid',role:'authenticated',
  aud:'authenticated',app_metadata:{provider:'email',providers:['email']},
  user_metadata:{},created_at:'2026-10-01T00:00:00Z'};
 const session={access_token:jwt(id),refresh_token:'fake',token_type:'bearer',
  expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
 await page.addInitScript(({key,session})=>
   localStorage.setItem(key,JSON.stringify(session)),{
   key:'sb-reparado-test-placeholder-auth-token',session
 });
 let status='requested',updates=0,requestLists=0;
 const respond=(route,data,count=1,one=false)=>route.fulfill({
   status:200,contentType:one?'application/vnd.pgrst.object+json':'application/json',
   headers:{'content-range':'0-'+Math.max(0,(Array.isArray(data)?data.length:1)-1)+'/'+count,
    'access-control-expose-headers':'Content-Range','access-control-allow-origin':'*'},
   body:JSON.stringify(data)
 });
 await page.route(host+'/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  if(method==='OPTIONS')return route.fulfill({
    status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}
  });
  if(path==='/auth/v1/user')return respond(route,user,1,true);
  if(method==='HEAD')return route.fulfill({
    status:200,headers:{'content-range':'*/'+(
      path==='/rest/v1/account_deletion_requests'&&status!=='completed'?1:0
    ),'access-control-expose-headers':'Content-Range',
    'access-control-allow-origin':'*'},body:''
  });
  if(path==='/rest/v1/profiles'&&method==='GET'){
    if(url.searchParams.get('id')?.startsWith('in.'))return respond(route,[{
      id:customer,full_name:'Cliente de pruebas',phone:'600000000',role:'customer'
    }],1);
    return respond(route,{id,full_name:role==='admin'?'Titular':'Cliente',
      phone:'',role},1,true);
  }
  if(path==='/rest/v1/account_deletion_requests'){
    if(role!=='admin')return route.fulfill({
      status:403,contentType:'application/json',body:'{"code":"42501"}'
    });
    if(method==='PATCH'){
      const data=JSON.parse(req.postData()||'{}');
      if(data.status!=='in_review')return route.fulfill({
        status:403,contentType:'application/json',body:'{"code":"42501"}'
      });
      status='in_review';updates++;
      return respond(route,[{id:request,status}],1);
    }
    if(method==='GET'){
      requestLists++;
      const isCompleted=url.searchParams.get('status')==='eq.completed';
      return respond(route,isCompleted?[]:[{
        id:request,user_id:customer,status,
        requested_at:issueDate,completed_at:null
      }],isCompleted?0:1);
    }
  }
  if(path==='/rest/v1/service_requests'||path==='/rest/v1/customer_reviews'||
     path==='/rest/v1/support_reports')
    return respond(route,[],0);
  if(path==='/rest/v1/rpc/reparado_owner_unread_conversations'&&method==='POST')
    return respond(route,0);
  return route.fulfill({
   status:404,contentType:'application/json',body:'{"message":"Mock: sin endpoint"}'
  });
 });
 return {get:()=>({status,updates,requestLists})};
}

test('V105: el propietario consulta solicitudes y abre revisión sin borrado',async({page})=>{
 const state=await setup(page,'admin');
 await page.goto('/');
 const ownerPanel=page.locator('#reparado-owner-dashboard');
 await expect(ownerPanel).toBeVisible();
 const entry=ownerPanel.locator('[data-owner-target="owner-deletions"]');
 await expect(entry).toContainText('1 pendiente(s)');
 await entry.click();
 const inbox=page.locator('#reparado-owner-deletions');
 await expect(inbox).toBeVisible();
 await expect(inbox.locator('.owner-deletion-item')).toHaveCount(1);
 await expect(inbox.locator('.owner-deletion-item')).toContainText('Cliente de pruebas');
 await expect(inbox.locator('.owner-deletion-item')).toContainText('Recibida');
 await expect(inbox).toContainText('no elimina datos');
 page.once('dialog',dialog=>dialog.accept());
 await inbox.locator('[data-owner-deletion-review]').click();
 await expect(inbox.locator('.owner-deletion-item')).toContainText('En revisión');
 await expect(inbox.locator('[data-owner-deletion-review]')).toHaveCount(0);
 await expect(inbox.locator('[data-owner-deletion-status]')).toContainText('No se han borrado datos');
 expect(state.get().status).toBe('in_review');
 expect(state.get().updates).toBe(1);
 // La revisión NO resuelve la supresión: el indicador del propietario
 // debe seguir mostrando el caso como pendiente al volver al panel.
 await inbox.locator('[data-owner-deletion-back]').click();
 await expect(ownerPanel).toBeVisible();
 await expect(ownerPanel.locator('[data-owner-target="owner-deletions"]'))
   .toContainText('1 pendiente(s)');
 await ownerPanel.locator('[data-owner-target="owner-deletions"]').click();
 await expect(inbox.locator('.owner-deletion-item')).toContainText('En revisión');
 await inbox.locator('[data-owner-deletion-filter="completed"]').click();
 await expect(inbox.locator('.owner-deletion-item')).toHaveCount(0);
 await expect(inbox).toContainText('No hay solicitudes');
 await inbox.locator('[data-owner-deletion-back]').click();
 await expect(ownerPanel).toBeVisible();
});

test('V105: el cliente no accede a la bandeja del propietario',async({page})=>{
 const state=await setup(page,'customer');
 await page.goto('/');
 await expect(page.locator('.owner-header-launch')).toBeHidden();
 await page.locator('.customer-nav [data-view="profile"]').click();
 await page.evaluate(()=>{
   const fake=document.createElement('button');
   fake.dataset.view='owner-deletions';
   document.querySelector('.shell')?.append(fake);
   fake.click();fake.remove();
 });
 await expect(page.locator('#reparado-owner-deletions')).toHaveCount(0);
 expect(state.get().updates).toBe(0);
 expect(state.get().requestLists).toBe(0);
});
