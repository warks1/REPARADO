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

async function setup(page,role='admin',inboxRpc=false,history=false){
 const id=role==='admin'?adminId:role==='operator'?operatorId:clientId;
 const user={id,email:role+'@example.invalid',role:'authenticated',aud:'authenticated',
   app_metadata:{provider:'email',providers:['email']},
   user_metadata:{},created_at:'2026-10-01T00:00:00Z'};
 const session={access_token:jwt(id),refresh_token:'fake-refresh',
   token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
 await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{
   key:'sb-reparado-test-placeholder-auth-token',session
 });
 const counts=[],updates=[],reads=[],peopleQueries=[],conversationReads=[];
 let currentStatus='accepted',scheduledAt=null,assignedTo=null,ownerHasRead=false;
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
     let count=path.includes('service_requests')?1:0;
     if(history&&path==='/rest/v1/service_requests'){
       const status=url.searchParams.get('status')||'';
       const unassigned=url.searchParams.get('operator_id')==='is.null';
       const operatorScoped=url.searchParams.get('operator_id')?.startsWith('eq.');
       const operatorCounts={all:24,new:0,pending:3,agenda:8,active:3,finished:13};
       const totals=operatorScoped?operatorCounts:
         {all:315,new:12,pending:62,agenda:37,active:19,finished:153};
       if(unassigned)count=9;
       else if(status==='eq.new')count=totals.new;
       else if(status==='eq.in_progress')count=totals.active;
       else if(status.includes('quoted')&&status.includes('accepted'))count=totals.pending;
       else if(status.includes('scheduled')&&status.includes('in_progress'))
         count=totals.agenda;
       else if(status.includes('completed')&&status.includes('cancelled'))
         count=totals.finished;
       else if(!status)count=totals.all;
       else count=0;
     }
     return output(null,true,count);
   }
   if(path==='/rest/v1/profiles'){
     peopleQueries.push(url.searchParams.toString());
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
   if(path==='/rest/v1/rpc/reparado_mark_owner_chat_read'&&method==='POST'){
     reads.push('owner-read');
     if(role!=='admin')return route.fulfill({status:403,
       contentType:'application/json',body:'{"code":"42501"}'});
     ownerHasRead=true;
     return output(true,false,1);
   }
   if(path==='/rest/v1/rpc/reparado_owner_conversations'&&method==='POST'){
     conversationReads.push('conversations');
     if(role!=='admin')return route.fulfill({status:403,contentType:'application/json',
       body:'{"code":"42501","message":"Acceso denegado"}'});
     if(!inboxRpc)return route.fulfill({status:404,contentType:'application/json',
       body:'{"code":"PGRST202","message":"No existe la función"}'});
     return output({total:1,rows:[{
       customer_id:clientId,last_message_id:'e0000000-0000-4000-8000-000000000005',
       sender_id:clientId,last_message_at:'2026-11-09T10:00:00Z',
       last_body:'¿Cuándo podéis venir?',has_unread:!ownerHasRead
     }]},false,1);
   }
   if(path==='/rest/v1/messages'&&method==='GET'){
     reads.push('messages');
     return output([{
       id:'e0000000-0000-4000-8000-000000000005',
       customer_id:clientId,sender_id:clientId,body:'¿Cuándo podéis venir?',
       created_at:'2026-11-09T10:00:00Z'
     }],false,1);
   }
   if(path==='/rest/v1/service_requests'&&method==='GET'){
     if(history&&String(url.searchParams.get('status')).includes('completed')&&
       String(url.searchParams.get('status')).includes('cancelled')){
       // Supabase usa offset/limit en la URL; Range es alternativa HTTP.
       const range=(request.headers()['range']||'').match(/(\d+)-(\d+)/);
       const start=Number(url.searchParams.get('offset')??range?.[1]??0);
       const limit=Number(url.searchParams.get('limit')??50);
       const end=url.searchParams.has('limit')?start+limit-1:
         range?Number(range[2]):start+49;
       const rows=Array.from({length:153},(_,i)=>({
         id:'e0000000-0000-4000-8000-'+String(i+100).padStart(12,'0'),
         customer_id:clientId,service_name:'Trabajo terminado '+(i+1),
         street:'Calle Ficticia',address_number:'1',postal_code:'08001',
         city:'Barcelona',phone:'600000000',description:'Trabajo de prueba',
         status:'completed',scheduled_at:null,operator_id:null,
         operator_name:null,price:180
       }));
       let filtered=rows;
       for(const field of ['service_name','city','phone']){
         const raw=url.searchParams.get(field);
         if(raw?.startsWith('ilike.')){
           const pattern=raw.slice(6).replace(/^%|%$/g,'').toLocaleLowerCase('es');
           filtered=filtered.filter(row=>String(row[field]||'')
             .toLocaleLowerCase('es').includes(pattern));
         }
       }
       return output(filtered.slice(start,end+1),false,filtered.length);
     }
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
 return {counts,updates,reads,peopleQueries,conversationReads};
}

test('V84: administrador entra al centro privado y abre las diez secciones',async({page})=>{
 const called=await setup(page,'admin');
 await page.goto('/');
 const owner=page.locator('#reparado-owner-dashboard');
 await expect(owner).toBeVisible();
 await expect(page.locator('.owner-header-launch')).toBeVisible();
 await expect(owner.locator('.owner-module')).toHaveCount(13);
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
 await page.locator('.owner-module[data-owner-target="owner-calendar"]').click();
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


test('V88: desde equipo abrir agenda filtrada, programar con técnico sugerido y saltar semana',async({page})=>{
 await setup(page,'admin');
 await page.goto('/');
 const owner=page.locator('#reparado-owner-dashboard');
 await owner.locator('[data-owner-target="owner-operators"]').click();
 const directory=page.locator('#reparado-owner-people');
 await expect(directory.locator('.owner-person')).toHaveCount(1);
 await directory.locator('[data-owner-contact]').click();
 const calendar=page.locator('#reparado-owner-calendar');
 await expect(calendar).toBeVisible();
 const filter=calendar.locator('[data-owner-operator-filter]');
 await expect(filter).toHaveValue(operatorId);
 await expect(calendar.locator('.owner-day')).toHaveCount(7);
 await expect(calendar.locator('.owner-accepted-job')).toHaveCount(1);
 await calendar.locator('.owner-accepted-job [data-owner-edit]').click();
 await expect(calendar.locator('[name="operator"]')).toHaveValue(operatorId);
 await calendar.locator('[data-owner-cancel]').click();
 await calendar.locator('[data-owner-date]').fill('2027-01-14');
 await calendar.locator('[data-owner-date]').dispatchEvent('change');
 await expect(calendar.locator('[data-owner-week-label]')).toContainText('ene');
 await expect(filter).toHaveValue(operatorId);
 await calendar.locator('[data-owner-today]').click();
 await expect(calendar.locator('.owner-day')).toHaveCount(7);
 await filter.selectOption('');
 await expect(filter).toHaveValue('');
 await calendar.locator('[data-owner-back]').click();
 await expect(owner).toBeVisible();
});


test('V89: titular busca contactos por nombre o teléfono y recupera el directorio entero',async({page})=>{
 const called=await setup(page,'admin');
 await page.goto('/');
 await page.locator('[data-owner-target="owner-customers"]').click();
 const people=page.locator('#reparado-owner-people');
 const form=people.locator('[data-owner-people-search]');
 await expect(form).toBeVisible();
 await form.locator('[name="term"]').fill('  Cli%ente  ');
 await form.getByRole('button',{name:'Buscar'}).click();
 await expect(form.locator('[name="term"]')).toHaveValue('Cliente');
 await expect(people.locator('[data-owner-people-status]')).toContainText('coincidencias');
 expect(called.peopleQueries.some(v=>v.includes('full_name=ilike.'))).toBeTruthy();
 await form.locator('[name="field"]').selectOption('phone');
 await form.locator('[name="term"]').fill('600');
 await form.getByRole('button',{name:'Buscar'}).click();
 expect(called.peopleQueries.some(v=>v.includes('phone=ilike.'))).toBeTruthy();
 await people.locator('[data-owner-people-clear]').click();
 await expect(form.locator('[name="term"]')).toHaveValue('');
 await expect(people.locator('[data-owner-people-status]')).toContainText('perfiles');
 expect(called.peopleQueries.at(-1).includes('ilike.')).toBe(false);
});

test('V90: inbox del propietario agrupa por conversación cuando hay RPC segura',async({page})=>{
 const called=await setup(page,'admin',true);
 await page.goto('/');
 await page.locator('[data-owner-target="owner-messages"]').click();
 const inbox=page.locator('#reparado-owner-messages');
 await expect(inbox.locator('.owner-message-row')).toHaveCount(1);
 await expect(inbox.locator('[data-owner-messages-status]')).toContainText('1 conversaciones');
 await expect(inbox).toContainText('¿Cuándo podéis venir?');
 expect(called.conversationReads.length).toBeGreaterThanOrEqual(1);
 expect(called.reads).toHaveLength(0); // no se consulta la lista legacy
 await inbox.locator('[data-owner-open-chat]').click();
 await expect(page.locator('#messages')).toContainText('¿Cuándo podéis venir?');
});

test('V91: al abrir chat real del propietario se guarda el estado y desaparece pendiente',async({page})=>{
 const calls=await setup(page,'admin',true);
 await page.goto('/');
 await page.locator('[data-owner-target="owner-messages"]').click();
 const inbox=page.locator('#reparado-owner-messages');
 await expect(inbox.locator('.owner-unread-label')).toContainText('Pendiente de leer');
 await inbox.locator('[data-owner-open-chat]').click();
 await expect(page.locator('#messages')).toContainText('¿Cuándo podéis venir?');
 await expect.poll(()=>calls.reads.includes('owner-read')).toBe(true);
 await page.locator('.back').first().click();
 await expect(page.locator('#reparado-owner-messages .owner-read-label')).toContainText('Leído');
 await expect(inbox.locator('.owner-unread-label')).toHaveCount(0);
});

test('V91: operario no puede navegar a la bandeja privada ni registrar lecturas',async({page})=>{
 const calls=await setup(page,'operator',true);
 await page.goto('/');
 await expect(page.locator('#reparado-owner-messages')).toHaveCount(0);
 await page.evaluate(()=>{
  const fake=document.createElement('button');
  fake.dataset.view='owner-messages';
  document.querySelector('.shell')?.append(fake);
  fake.click();fake.remove();
 });
 await expect(page.locator('#reparado-owner-messages')).toHaveCount(0);
 expect(calls.reads.includes('owner-read')).toBe(false);
});

test('V92: historial completo del titular muestra más de 150 mediante páginas reales',async({page})=>{
 await setup(page,'admin',false,true);
 await page.goto('/');
 const button=page.locator('[data-owner-target="admin"][data-owner-filter="finished"]');
 await button.click();
 await expect(page.locator('.job-card')).toHaveCount(50);
 const nav=page.locator('[aria-label="Páginas del historial de trabajos"]');
 await expect(nav).toContainText('153 trabajos en este filtro');
 for(let i=1;i<=3;i++){
  await nav.locator('[data-staff-work-page="next"]').click();
  await expect(nav).toContainText('Página '+(i+1)+' de 4');
 }
 await expect(page.locator('.job-card')).toHaveCount(3);
 await nav.locator('[data-staff-work-page="prev"]').click();
 await expect(page.locator('.job-card')).toHaveCount(50);
});

test('V94: propietario ve indicadores completos y filtros exactos con más de 150 trabajos',async({page})=>{
 const calls=await setup(page,'admin',false,true);
 await page.goto('/');
 await page.locator('[data-owner-target="admin"][data-owner-filter="finished"]').click();
 const summary=page.locator('.staff-summary');
 await expect(summary).toContainText('Trabajos totales');
 await expect(summary).toContainText('315');
 await expect(summary).toContainText('62');
 await expect(summary).toContainText('37');
 await expect(summary).toContainText('9');
 const filters=page.locator('.staff-filters');
 await expect(filters.locator('[data-admin-filter="all"]')).toContainText('315');
 await expect(filters.locator('[data-admin-filter="new"]')).toContainText('12');
 await expect(filters.locator('[data-admin-filter="pending"]')).toContainText('62');
 await expect(filters.locator('[data-admin-filter="agenda"]')).toContainText('37');
 await expect(filters.locator('[data-admin-filter="active"]')).toContainText('19');
 await expect(filters.locator('[data-admin-filter="finished"]')).toContainText('153');
 await expect(filters.locator('[data-admin-filter="unassigned"]')).toContainText('9');
 await expect(page.locator('.job-card')).toHaveCount(50);
 const history=page.locator('[aria-label="Páginas del historial de trabajos"]');
 await expect(history).toContainText('153 trabajos en este filtro');
 expect(calls.counts.filter(s=>s.includes('/service_requests?')).length).toBeGreaterThanOrEqual(6);
 expect(calls.counts.some(s=>s.includes('select=id'))).toBe(true);
});

test('V95: titular localiza la solicitud 151 sin recorrer 150 y conserva cifras globales',async({page})=>{
 await setup(page,'admin',false,true);
 await page.goto('/');
 await page.locator('[data-owner-target="admin"][data-owner-filter="finished"]').click();
 const search=page.locator('[data-staff-work-search]');
 await expect(search).toBeVisible();
 await search.locator('[name="term"]').fill('  Trabajo terminado 151  ');
 await search.getByRole('button',{name:'Buscar'}).click();
 await expect(page.locator('.job-card')).toHaveCount(1);
 await expect(page.locator('.job-card')).toContainText('Trabajo terminado 151');
 await expect(page.locator('[data-staff-search-status]')).toContainText('1 resultado(s)');
 await expect(page.locator('[data-admin-filter="finished"]')).toContainText('153');
 await expect(page.locator('[data-admin-filter="all"]')).toContainText('315');
 await search.locator('[name="field"]').selectOption('city');
 await search.locator('[name="term"]').fill('Barcelona');
 await search.getByRole('button',{name:'Buscar'}).click();
 await expect(page.locator('.job-card')).toHaveCount(50);
 await expect(page.locator('[data-staff-search-status]')).toContainText('153 resultado(s)');
 await search.locator('[data-staff-search-clear]').click();
 await expect(search.locator('[name="term"]')).toHaveValue('');
 await expect(page.locator('.job-card')).toHaveCount(50);
 await expect(page.locator('[data-staff-search-status]')).toContainText('Busca en todo el historial');
 await search.locator('[name="field"]').selectOption('phone');
 await search.locator('[name="term"]').fill('600000000');
 await search.getByRole('button',{name:'Buscar'}).click();
 await expect(page.locator('.job-card')).toHaveCount(50);
 await expect(page.locator('[data-staff-search-status]')).toContainText('153 resultado(s)');
});


test('V96: propietario ve prioridades auténticas, actualiza y abre la agenda',async({page})=>{
 const calls=await setup(page,'admin');
 await page.goto('/');
 const dashboard=page.locator('#reparado-owner-dashboard');
 await expect(dashboard).toBeVisible();
 const priorities=dashboard.locator('.owner-priorities');
 await expect(priorities.locator('.owner-priority-card')).toHaveCount(4);
 await expect(priorities.locator('[data-owner-target="owner-calendar"] .owner-priority-count'))
   .toHaveText('1');
 await expect(priorities.locator('[data-owner-target="admin"][data-owner-filter="agenda"] .owner-priority-count'))
   .toHaveText('1');
 await expect(priorities.locator('[data-owner-target="support-admin"] .owner-priority-count'))
   .toHaveText('0');
 await expect(priorities.locator('[data-owner-target="review-moderation"] .owner-priority-count'))
   .toHaveText('0');
 await expect(dashboard.locator('.owner-metric')).toHaveCount(10);
 const initial=calls.counts.length;
 await dashboard.locator('[data-owner-refresh]').click();
 await expect.poll(()=>calls.counts.length).toBeGreaterThan(initial);
 await priorities.locator('[data-owner-target="owner-calendar"]').click();
 await expect(page.locator('#reparado-owner-calendar')).toBeVisible();
 await expect(page.locator('#reparado-owner-calendar .owner-accepted-job')).toHaveCount(1);
 await page.locator('#reparado-owner-calendar [data-owner-back]').click();
 await expect(dashboard).toBeVisible();
 await dashboard.locator('.owner-priority-card[data-owner-target="admin"][data-owner-filter="agenda"]').click();
 await expect(page.locator('.staff-filters [data-admin-filter="agenda"]')).toHaveAttribute('aria-pressed','true');
});

test('V96: clientes y operarios no reciben prioridades privadas',async({page})=>{
 const calls=await setup(page,'operator');
 await page.goto('/');
 await expect(page.locator('#reparado-owner-dashboard')).toHaveCount(0);
 await expect(page.locator('.owner-priorities')).toHaveCount(0);
 expect(calls.counts).toHaveLength(0);
});
