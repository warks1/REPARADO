import {test,expect} from '@playwright/test';

// V100 · Supabase completamente simulado. Ningún dato o imagen de cliente real.
const host='https://reparado-test-placeholder.supabase.co';
const operatorId='a0000000-0000-4000-8000-000000000001';
const requestId='b0000000-0000-4000-8000-000000000002';
function jwt(id){
 const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 return enc({alg:'HS256',typ:'JWT'})+'.'+enc({
   sub:id,role:'authenticated',aud:'authenticated',
   exp:Math.floor(Date.now()/1000)+3600
 })+'.fake-signature';
}
async function setup(page,initialStatus='scheduled',failedUploadOnAttempt=0){
 const user={id:operatorId,email:'operario@example.invalid',role:'authenticated',
   aud:'authenticated',app_metadata:{provider:'email',providers:['email']},
   user_metadata:{},created_at:'2026-10-01T00:00:00Z'};
 const session={access_token:jwt(operatorId),refresh_token:'fake-refresh',token_type:'bearer',
   expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
 await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{
   key:'sb-reparado-test-placeholder-auth-token',session
 });
 let status=initialStatus,description='',report=false,photoNames=[],uploads=0,attempts=0,finished=0;
 const requests=[];
 const job=()=>({
   id:requestId,customer_id:'c0000000-0000-4000-8000-000000000003',
   service_name:'Reparación de grifo',category:'Fontanería',status,
   street:'Calle de prueba',address_number:'12',postal_code:'08001',
   city:'Barcelona',phone:'600000000',description:'Revisar la instalación',
   scheduled_at:'2026-11-10T09:00:00Z',operator_id:operatorId,
   operator_name:'Operario de prueba',price:150,
   work_started_at:report?'2026-11-10T09:00:00Z':null,
   work_finished_at:status==='completed'?'2026-11-10T10:00:00Z':null
 });
 const respond=(route,data,count=1,object=false)=>route.fulfill({
   status:200,contentType:object?'application/vnd.pgrst.object+json':'application/json',
   headers:{'content-range':'0-'+Math.max(0,(Array.isArray(data)?data.length:1)-1)+'/'+count,
     'access-control-expose-headers':'Content-Range','access-control-allow-origin':'*'},
   body:JSON.stringify(data)
 });
 await page.route(host+'/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
   requests.push([method,path]);
   if(method==='OPTIONS')return route.fulfill({status:200,
     headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
   if(path==='/auth/v1/user')return respond(route,user,1,true);
   if(method==='HEAD')return route.fulfill({
     status:200,headers:{'content-range':'*/1','access-control-expose-headers':'Content-Range',
       'access-control-allow-origin':'*'},body:''
   });
   if(path==='/rest/v1/profiles')return respond(route,{
     id:operatorId,full_name:'Operario de prueba',phone:'',role:'operator'
   },1,true);
   if(path==='/rest/v1/customer_reviews')return respond(route,[],0);
   if(path==='/rest/v1/support_reports')return respond(route,[],0);
   if(path==='/rest/v1/service_requests'&&method==='GET'){
     if(url.searchParams.has('id'))return respond(route,job(),1,true);
     return respond(route,[job()],1);
   }
   if(path==='/rest/v1/work_reports'&&method==='GET')
     return respond(route,report?{
       request_id:requestId,operator_id:operatorId,description,
       created_at:'2026-11-10T09:00:00Z'
     }:null,report?1:0,true);
   if(path==='/rest/v1/work_reports'&&method==='PATCH'){
     description=JSON.parse(req.postData()||'{}').description;
     return respond(route,[{request_id:requestId}],1);
   }
   if(path==='/rest/v1/rpc/reparado_start_work'&&method==='POST'){
     status='in_progress';report=true;
     return respond(route,true);
   }
   if(path==='/rest/v1/rpc/reparado_complete_work'&&method==='POST'){
     const body=JSON.parse(req.postData()||'{}');
     if(!photoNames.length||body.p_description.length<20)return respond(route,false);
     status='completed';description=body.p_description;finished++;
     return respond(route,true);
   }
   if(path==='/storage/v1/object/list/work-photos'&&method==='POST')
     return respond(route,photoNames.map(name=>({name})),photoNames.length);
   if(path.startsWith('/storage/v1/object/work-photos/')&&method==='POST'){
     attempts++;
     if(attempts===failedUploadOnAttempt)return route.fulfill({
       status:500,contentType:'application/json',
       body:'{"statusCode":500,"error":"Temporary error","message":"Fallo de red simulado"}'
     });
     const name=path.split('/').at(-1);
     if(!photoNames.includes(name))photoNames.push(name);
     uploads++;
     return respond(route,{Key:path},1,true);
   }
   if(path.startsWith('/storage/v1/object/sign/work-photos/')&&method==='POST')
     return respond(route,{signedURL:'/storage/v1/object/sign/work-photos/imagen.jpg?token=fake'},1,true);
   if(path.includes('/storage/v1/object/sign/work-photos/')&&method==='GET')
     return route.fulfill({status:200,contentType:'image/png',
       body:Buffer.from([137,80,78,71,13,10,26,10])});
   return route.fulfill({status:404,contentType:'application/json',
     body:'{"message":"No existe en mock"}'});
 });
 return {requests,get:()=>({status,description,uploads,attempts,finished,report})};
}

test('V100: el operario abre su servicio, inicia, sube foto, describe y cierra',async({page})=>{
 const state=await setup(page);
 await page.goto('/');
 await page.locator('.customer-nav [data-view="profile"]').click();
 await page.locator('[data-view="admin"]').click();
 const button=page.locator('[data-work-detail]').first();
 await expect(button).toContainText('Abrir servicio');
 await button.click();
 const work=page.locator('#reparado-operator-work');
 await expect(work).toBeVisible();
 await expect(work.locator('[data-work-start]')).toBeVisible();
 await expect(work.locator('[data-work-finish]')).toHaveCount(0);
 await work.locator('[data-work-start]').click();
 await expect(work.locator('[data-work-finish]')).toBeVisible();
 await work.locator('[name="work_description"]')
   .fill('Se ha sustituido la junta del grifo y se ha comprobado que no hay fugas.');
 await work.locator('[data-work-files]').setInputFiles({
   name:'despues.png',mimeType:'image/png',
   buffer:Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])
 });
 await work.locator('[data-work-upload]').click();
 await expect(work.locator('[data-work-photo-count]')).toContainText('1 de 8');
 await work.locator('[data-work-finish]').click();
 await expect(work.locator('[data-work-feedback]')).toContainText('Servicio finalizado');
 await expect(work.locator('[data-work-finish]')).toHaveCount(0);
 await expect(work.locator('[data-work-description]'))
   .toContainText('Se ha sustituido la junta');
 expect(state.get().finished).toBe(1);
 expect(state.get().uploads).toBe(1);
 expect(state.requests.some(([method,path])=>
   method==='POST'&&path==='/rest/v1/rpc/reparado_complete_work')).toBeTruthy();
});

test('V100: no se puede cerrar desde la pantalla sin descripción válida',async({page})=>{
 const state=await setup(page);
 await page.goto('/');
 await page.locator('.customer-nav [data-view="profile"]').click();
 await page.locator('[data-view="admin"]').click();
 await page.locator('[data-work-detail]').first().click();
 await page.locator('[data-work-start]').click();
 const work=page.locator('#reparado-operator-work');
 await work.locator('[name="work_description"]').fill('Muy breve');
 await work.locator('[data-work-finish]').click();
 await expect(work.locator('[data-work-feedback]')).toContainText('al menos 20');
 expect(state.get().finished).toBe(0);
});

test('V100: servicio antiguo ya en curso permite preparar parte sin reiniciar su estado',async({page})=>{
 const state=await setup(page,'in_progress');
 await page.goto('/');
 await page.locator('.customer-nav [data-view="profile"]').click();
 await page.locator('[data-view="admin"]').click();
 await page.locator('[data-work-detail]').first().click();
 const work=page.locator('#reparado-operator-work');
 await expect(work.locator('[data-work-start]')).toContainText('Preparar parte de trabajo');
 await expect(work.locator('[data-work-finish]')).toHaveCount(0);
 await work.locator('[data-work-start]').click();
 await expect(work.locator('[name="work_description"]')).toBeVisible();
 await expect(work.locator('[data-work-finish]')).toBeVisible();
 expect(state.get().status).toBe('in_progress');
});


test('V101: subida parcial muestra fotos realmente guardadas y reintenta sin duplicados',async({page})=>{
  const state=await setup(page,'scheduled',2);
  await page.goto('/');
  await page.locator('.customer-nav [data-view="profile"]').click();
  await page.locator('[data-view="admin"]').click();
  await page.locator('[data-work-detail]').first().click();
  const work=page.locator('#reparado-operator-work');
  await work.locator('[data-work-start]').click();
  await work.locator('[name="work_description"]')
    .fill('Se ha sustituido la pieza y comprobado el funcionamiento de la instalación.');
  const images=[
    {name:'antes.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10,1,0,0,0])},
    {name:'despues.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10,2,0,0,0])}
  ];
  await work.locator('[data-work-files]').setInputFiles(images);
  await work.locator('[data-work-upload]').click();
  await expect(work.locator('[data-work-photo-count]')).toContainText('1 de 8');
  await expect(work.locator('[data-work-feedback]')).toContainText('1 fallida(s)');
  await expect(work.locator('[name="work_description"]')).toHaveValue(/Se ha sustituido/);
  expect(state.get().uploads).toBe(1);

  await work.locator('[data-work-files]').setInputFiles(images);
  await work.locator('[data-work-upload]').click();
  await expect(work.locator('[data-work-photo-count]')).toContainText('2 de 8');
  await expect(work.locator('[data-work-feedback]')).toContainText('ya existentes: 1');
  expect(state.get().uploads).toBe(2);
  expect(state.get().attempts).toBe(3);

  await work.locator('[data-work-refresh]').click();
  await expect(work.locator('[data-work-photo-count]')).toContainText('2 de 8');
  await expect(work.locator('[name="work_description"]')).toHaveValue(/Se ha sustituido/);
  await work.locator('[data-work-finish]').click();
  await expect(work.locator('[data-work-feedback]')).toContainText('Servicio cerrado correctamente');
  expect(state.get().finished).toBe(1);
});
