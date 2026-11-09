import {test,expect} from '@playwright/test';

// Datos completamente ficticios: la prueba nunca usa Supabase real.
const host='https://reparado-test-placeholder.supabase.co';
const adminId='a0000000-0000-4000-8000-000000000001';
const clientId='b0000000-0000-4000-8000-000000000002';
const operatorId='c0000000-0000-4000-8000-000000000003';
const jobId='d0000000-0000-4000-8000-000000000004';

function jwt(id){
 const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 return enc({alg:'HS256',typ:'JWT'})+'.'+enc({
   sub:id,role:'authenticated',aud:'authenticated',
   exp:Math.floor(Date.now()/1000)+3600
 })+'.fake-signature';
}

async function setup(page,role='admin'){
 const id=role==='admin'?adminId:role==='operator'?operatorId:clientId;
 const user={id,email:role+'@example.invalid',role:'authenticated',aud:'authenticated',
   app_metadata:{provider:'email',providers:['email']},
   user_metadata:{},created_at:'2026-10-01T00:00:00Z'};
 const session={access_token:jwt(id),refresh_token:'fake-refresh',
   token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
 await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{
   key:'sb-reparado-test-placeholder-auth-token',session
 });
 const counts=[],updates=[],reads=[];
 let currentStatus='accepted',scheduledAt=null,assignedTo=null;
 const job=()=>({id:jobId,service_name:'Instalación de grifo',
   status:currentStatus,operator_id:assignedTo,
   operator_name:assignedTo?'Operario de pruebas':null,
   scheduled_at:scheduledAt,city:'Barcelona',price:180});
 await page.route(host+'/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname;
   const method=request.method();
   const output=(data,head=false,count=0,one=false)=>route.fulfill({
     status:200,
     contentType:one?'application/vnd.pgrst.object+json':'application/json',
     headers:{'content-range':head?'*/'+count:'0-'+Math.max(0,(Array.isArray(data)?data.length:1)-1)+'/'+count,
       'access-control-expose-headers':'Content-Range','access-control-allow-origin':'*'},
     body:head?'':JSON.stringify(data)
   });
   if(path==='/auth/v1/user')return output(user,false,1,true);
   if(method==='HEAD'){
     counts.push(path+'?'+url.searchParams.toString());
     return output(null,true,path.includes('service_requests')?1:0);
   }
   if(path==='/rest/v1/profiles'){
     if(url.searchParams.get('role')==='eq.customer')return output([{
       id:clientId,full_name:'Cliente de pruebas',phone:'600000000',role:'customer'
     }],false,1);
     if(url.searchParams.has('role'))return output([{
       id:operatorId,full_name:'Operario de pruebas',role:'operator'
     }],false,1);
     if(url.searchParams.has('id')&&url.searchParams.get('id').startsWith('in.'))
       return output([{id:clientId,full_name:'Cliente de pruebas'}],false,1);
     return output({id,full_name:'Perfil de pruebas',phone:'',role},false,1,true);
   }
   if(path==='/rest/v1/customer_reviews')return output([],false,0);
   if(path==='/rest/v1/support_reports')return output([],false,0);
   if(path==='/rest/v1/messages'&&method==='GET'){
     reads.push('messages');
     return output([{
       id:'e0000000-0000-4000-8000-000000000005',
       customer_id:clientId,sender_id:clientId,body:'¿Cuándo podéis venir?',
       created_at:'2026-11-09T10:00:00Z'
     }],false,1);
   }
   if(path==='/rest/v1/service_requests'&&method==='GET'){
     if(url.searchParams.has('operator_id'))return output([],false,0);
     if(url.searchParams.get('status')==='eq.accepted')
       return output(currentStatus==='accepted'?[job()]:[],false,currentStatus==='accepted'?1:0);
     if(String(url.searchParams.get('status')).startsWith('in.'))
       return output(currentStatus==='scheduled'?[job()]:[],false,currentStatus==='scheduled'?1:0);
     return output([],false,0);
   }
   if(path==='/rest/v1/service_requests'&&method==='PATCH'){
     updates.push(JSON.parse(request.postData()||'{}'));
     if(role!=='admin')return route.fulfill({
       status:403,contentType:'application/json',body:'{"code":"42501"}'
     });
     const next=updates.at(-1);
     currentStatus=next.status;scheduledAt=next.scheduled_at;assignedTo=next.operator_id;
     return output([{id:jobId,status:currentStatus,operator_id:assignedTo,
       scheduled_at:scheduledAt}],false,1);
   }
   return route.fulfill({status:404,contentType:'application/json',body:'{}'});
 });
 return {counts,updates,reads};
}

test('V84: administrador entra al centro privado y abre las diez secciones',async({page})=>{
 const called=await setup(page,'admin');
 await page.goto('/');
 const owner=page.locator('#reparado-owner-dashboard');
 await expect(owner).toBeVisible();
 await expect(page.locator('.owner-header-launch')).toBeVisible();
 await expect(owner.locator('.owner-module')).toHaveCount(12);
 await expect(owner.locator('.owner-metric')).toHaveCount(10);
 await expect(owner.locator('[data-owner-status]')).toContainText('Datos actualizados desde el servidor');
 expect(called.counts.length).toBeGreaterThanOrEqual(8);
 await owner.locator('[data-owner-target="owner-mail"]').click();
 await expect(page.locator('#reparado-owner-mail')).toContainText('no están conectados a la app');
 await expect(page.locator('#reparado-owner-mail')).toContainText('reparado_soporte@outlook.es');
 await page.locator('[data-owner-mail-back]').click();
 await expect(owner).toBeVisible();
});

for(const role of ['customer','operator']){
 test('V84: '+role+' no ve el panel ni puede forzarlo por la navegación',async({page})=>{
   const called=await setup(page,role);
   await page.goto('/');
   await expect(page.locator('.owner-header-launch')).toBeHidden();
   await expect(page.locator('#reparado-owner-dashboard')).toHaveCount(0);
   await page.locator('.customer-nav [data-view="profile"]').click();
   await expect(page.locator('[data-view="owner"]')).toBeHidden();
   await page.evaluate(()=>{
     const fake=document.createElement('button');
     fake.dataset.view='owner';
     document.querySelector('.shell')?.append(fake);
     fake.click();fake.remove();
   });
   await expect(page.locator('#reparado-owner-dashboard')).toHaveCount(0);
   expect(called.counts).toHaveLength(0);
   expect(called.updates).toHaveLength(0);
 });
}

test('V84: calendario asigna un trabajo aceptado, fecha y operario y permite consultar semanas',async({page})=>{
 const called=await setup(page,'admin');
 await page.goto('/');
 await page.locator('[data-owner-target="owner-calendar"]').click();
 const cal=page.locator('#reparado-owner-calendar');
 await expect(cal).toBeVisible();
 await expect(cal.locator('.owner-day')).toHaveCount(7);
 await expect(cal.locator('.owner-accepted-job')).toHaveCount(1);
 await cal.locator('[data-owner-edit]').first().click();
 await expect(cal.locator('[data-owner-editor]')).toBeVisible();
 await cal.locator('[name="operator"]').selectOption(operatorId);
 await cal.locator('[name="when"]').fill('2026-11-10T10:00');
 await cal.locator('[data-owner-visit-form] [type="submit"]').click();
 await expect(cal.locator('[data-owner-calendar-feedback]')).toContainText('Visita guardada');
 expect(called.updates).toHaveLength(1);
 expect(called.updates[0]).toEqual({
   status:'scheduled',operator_id:operatorId,operator_name:'Operario de pruebas',
   scheduled_at:'2026-11-10T09:00:00.000Z'
 });
 await cal.locator('[data-owner-week="next"]').click();
 await expect(cal.locator('.owner-day')).toHaveCount(7);
 await cal.locator('[data-owner-back]').click();
 await expect(page.locator('#reparado-owner-dashboard')).toBeVisible();
});

test('V84: inbox privado permite abrir conversaciones de la app, no emails externos',async({page})=>{
 const called=await setup(page,'admin');
 await page.goto('/');
 await page.locator('[data-owner-target="owner-messages"]').click();
 const messages=page.locator('#reparado-owner-messages');
 await expect(messages).toBeVisible();
 await expect(messages.locator('.owner-message-row')).toHaveCount(1);
 await expect(messages).toContainText('¿Cuándo podéis venir?');
 await messages.locator('[data-owner-open-chat]').click();
 await expect(page.locator('h2')).toContainText('Chat: Cliente');
 await expect(page.locator('#messages')).toContainText('¿Cuándo podéis venir?');
 await page.getByRole('button',{name:'← Mensajes del propietario'}).click();
 await expect(messages).toBeVisible();
 expect(called.reads.length).toBeGreaterThanOrEqual(2);
});

test('V84: propietario ve directorios de clientes y operarios, sin correos Auth',async({page})=>{
 await setup(page,'admin');
 await page.goto('/');
 const owner=page.locator('#reparado-owner-dashboard');
 await owner.locator('[data-owner-target="owner-customers"]').click();
 const people=page.locator('#reparado-owner-people');
 await expect(people).toContainText('Clientes');
 await expect(people.locator('.owner-person')).toHaveCount(1);
 await expect(people).toContainText('600000000');
 await expect(people).not.toContainText('example.invalid');
 await people.locator('[data-owner-contact]').click();
 await expect(page.locator('h2')).toContainText('Chat: Cliente');
 await page.getByRole('button',{name:'← Clientes'}).click();
 await expect(people).toBeVisible();
 await people.locator('[data-owner-people-back]').click();
 await owner.locator('[data-owner-target="owner-operators"]').click();
 await expect(people.locator('.owner-person')).toHaveCount(1);
 await expect(people).toContainText('Operario de pruebas');
 await people.locator('[data-owner-contact]').click();
 await expect(page.locator('#reparado-owner-calendar')).toBeVisible();
});
