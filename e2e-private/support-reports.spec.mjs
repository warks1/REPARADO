import {test,expect} from '@playwright/test';

// Únicamente identidades y servidor FICTICIOS: ningún dato sale a REPARADO Test.
const fakeHost='https://reparado-test-placeholder.supabase.co';
const customerId='a0000000-0000-4000-8000-000000000040';
const adminId='a0000000-0000-4000-8000-000000000041';
const reportId='b0000000-0000-4000-8000-000000000040';
const person=(id)=>({
  id,email:'cuenta@ejemplo.invalid',aud:'authenticated',role:'authenticated',
  app_metadata:{provider:'email',providers:['email']},user_metadata:{},
  created_at:'2026-10-26T08:00:00Z'
});
const jwt=id=>{
  const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  return enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,role:'authenticated',
    aud:'authenticated',exp:Math.floor(Date.now()/1000)+7200})+'.signature';
};
async function setup(page,role){
  const uid=role==='admin'?adminId:customerId;
  const session={access_token:jwt(uid),refresh_token:'fake',token_type:'bearer',expires_in:7200,
    expires_at:Math.floor(Date.now()/1000)+7200,user:person(uid)};
  await page.addInitScript(s=>{
    localStorage.setItem('sb-reparado-test-placeholder-auth-token',JSON.stringify(s));
  },session);
  const writes=[];
  const ownReports=[];
  await page.route(fakeHost+'/**',route=>{
    const request=route.request(),url=new URL(request.url());
    const p=url.pathname;
    const reply=(obj,status=200,one=false)=>route.fulfill({status,
      contentType:one?'application/vnd.pgrst.object+json':'application/json',
      body:JSON.stringify(obj)});
    if(p==='/auth/v1/user')return reply(person(uid),200,true);
    if(p==='/rest/v1/profiles')return reply({id:uid,full_name:'Prueba',phone:'',role},200,true);
    if(p==='/rest/v1/account_deletion_requests')return reply([],200);
    if(p==='/rest/v1/support_reports'&&request.method()==='POST'){
      const payload=JSON.parse(request.postData()||'{}');
      writes.push(payload);
      ownReports.unshift({
        id:reportId,subject:payload.subject,context:payload.context,
        status:'open',created_at:'2026-10-26T08:00:00Z'
      });
      return reply([],201);
    }
    if(p==='/rest/v1/support_reports'&&request.method()==='GET'){
      return reply(role==='admin'?[{id:reportId,subject:'No carga el chat',
        description:'El chat no abre tras pulsar Enviar.',context:'chat',
        status:'open',created_at:'2026-10-26T08:00:00Z'}]:ownReports);
    }
    if(p==='/rest/v1/support_reports'&&request.method()==='PATCH'){
      writes.push(JSON.parse(request.postData()||'{}'));return reply([{id:reportId,status:'resolved'}],200);
    }
    if(p==='/rest/v1/customer_reviews'&&request.method()==='GET')return reply([]);
    if(p==='/rest/v1/service_requests'&&request.method()==='GET')return reply([]);
    return reply({},404);
  });
  return writes;
}

test('cliente conectado registra una incidencia en soporte',async({page})=>{
  const writes=await setup(page,'customer');
  await page.goto('/');
  await page.locator('.customer-nav [data-view="profile"]').click();
  const form=page.locator('#reparado-issue-report');
  await expect(form).toBeVisible();
  const history=page.locator('#customer-support-history');
  await expect(history).toBeVisible();
  await expect(history.locator('[data-support-history-list]')).toContainText('Todavía no has comunicado ninguna incidencia');
  await form.locator('[name="context"]').selectOption('chat');
  await form.locator('[name="subject"]').fill('No carga el chat');
  await form.locator('[name="description"]').fill('El chat no abre tras pulsar Enviar.');
  await form.getByRole('button',{name:'Enviar incidencia a soporte'}).click();
  await expect(form.locator('[data-issue-feedback]')).toContainText('Incidencia registrada');
  await expect(history.locator('[data-support-history]')).toHaveCount(1);
  await expect(history.locator('[data-support-history]')).toContainText('No carga el chat');
  await expect(history.locator('[data-support-history]')).toContainText('Recibida');
  await expect(history.locator('[data-support-history]')).not.toContainText('El chat no abre tras pulsar');
  await history.getByRole('button',{name:'Actualizar estados'}).click();
  await expect(history.locator('[data-support-history]')).toHaveCount(1);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({user_id:customerId,context:'chat',
    subject:'No carga el chat',description:'El chat no abre tras pulsar Enviar.'});
  await expect(page.locator('[data-view="support-admin"]')).toHaveCount(0);
});

test('administrador ve y resuelve incidencias, el cliente no recibe controles',async({page})=>{
  const writes=await setup(page,'admin');
  await page.goto('/');
  await page.locator('.customer-nav [data-view="profile"]').click();
  await expect(page.locator('#customer-support-history')).toHaveCount(0);
  await page.locator('[data-view="support-admin"]').click();
  const list=page.locator('#reparado-support-admin');
  await expect(list).toBeVisible();
  await expect(list.locator('.support-ticket')).toHaveCount(1);
  await list.getByRole('button',{name:'Marcar resuelta'}).click();
  await expect.poll(()=>writes.some(item=>item.status==='resolved')).toBe(true);
});
