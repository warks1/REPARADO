import {test,expect} from '@playwright/test';

const approved=[
 {id:'12345678-0000-4000-8000-000000000001',rating:3,
  comment:'El servicio fue correcto y llegó a la hora indicada.',status:'approved',created_at:'2026-10-20T11:00:00Z'},
 {id:'12345678-0000-4000-8000-000000000002',rating:5,
  comment:'Personal atento y reparación muy bien terminada.',status:'approved',created_at:'2026-10-22T11:00:00Z'}
];

test('solo las dos opiniones aprobadas aparecen en la sección y media, sin ejemplos',async({page})=>{
 await page.route('https://reparado-test-placeholder.supabase.co/rest/v1/customer_reviews?**',route=>{
   const url=new URL(route.request().url());
   if(route.request().method()==='GET'&&url.searchParams.get('status')==='eq.approved'){
     return route.fulfill({status:200,contentType:'application/json',
       headers:{'content-range':'0-1/2','access-control-expose-headers':'Content-Range',
         'access-control-allow-origin':'*'},
       body:JSON.stringify(approved)});
   }
   return route.abort();
 });
 await page.goto('/');
 const section=page.locator('#reparado-reviews');
 await expect(section.locator('.review-real')).toHaveCount(2);
 await expect(section.locator('.review-card')).toHaveCount(2);
 await expect(section.locator('.review-demo')).toHaveCount(0);
 await expect(section.locator('[data-reviews-summary]')).toContainText('2 valoraciones reales');
 await expect(section.locator('[data-reviews-summary]')).toContainText('4/5 de media');
 await expect(section.locator('.review-card').first()).toContainText('Personal atento');
 await expect(section.locator('.review-card').nth(1)).toContainText('El servicio fue correcto');
 await expect(section.locator('[data-review-filter]')).toHaveCount(0);
 await expect(section.locator('[data-expand-reviews]')).toBeHidden();
});

test('V82: 53 reseñas aprobadas se pueden consultar por páginas sin una media global engañosa',async({page})=>{
 const all=Array.from({length:53},(_,i)=>({
   id:'d0000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
   rating:i<20?5:1,status:'approved',
   comment:'Valoración real aprobada sobre trabajo finalizado número '+(i+1)+'.',
   created_at:new Date(Date.UTC(2026,10,5,0,0,0)-i*60000).toISOString()
 }));
 const pages=[];
 await page.route('https://reparado-test-placeholder.supabase.co/rest/v1/customer_reviews?**',route=>{
   const url=new URL(route.request().url());
   if(route.request().method()!=='GET'||url.searchParams.get('status')!=='eq.approved')
     return route.abort();
   const offset=Number(url.searchParams.get('offset')||0);
   const limit=Number(url.searchParams.get('limit')||20);
   pages.push(offset);
   const items=all.slice(offset,offset+limit);
   return route.fulfill({status:200,contentType:'application/json',
     headers:{'content-range':offset+'-'+(offset+items.length-1)+'/'+all.length,
       'access-control-expose-headers':'Content-Range','access-control-allow-origin':'*'},
     body:JSON.stringify(items)});
 });
 await page.goto('/');
 const section=page.locator('#reparado-reviews');
 await expect(section.locator('[data-reviews-summary]')).toContainText('20 de 53 valoraciones reales mostradas');
 await expect(section.locator('[data-reviews-summary]')).toContainText('5/5 de media de las mostradas');
 await expect(section.locator('.review-card')).toHaveCount(20);
 await section.locator('[data-expand-reviews]').click();
 await expect(section.locator('[data-load-more-reviews]')).toBeVisible();
 await section.locator('[data-load-more-reviews]').click();
 await expect(section.locator('.review-card')).toHaveCount(40);
 await expect(section.locator('[data-reviews-summary]')).toContainText('40 de 53 valoraciones reales mostradas');
 await expect(section.locator('[data-reviews-summary]')).not.toContainText('5/5 de media de las mostradas');
 await section.locator('[data-load-more-reviews]').click();
 await expect(section.locator('.review-card')).toHaveCount(53);
 await expect(section.locator('[data-reviews-summary]')).toContainText('53 valoraciones reales');
 await expect(section.locator('[data-reviews-summary]')).not.toContainText('de las mostradas');
 await expect(section.locator('[data-load-more-reviews]')).toBeHidden();
 // La pantalla puede montarse dos veces al recuperar la sesión. Se admite
 // repetir la primera lectura, pero las páginas adicionales no se repiten.
 expect(pages.slice(-3)).toEqual([0,20,40]);
 expect(pages.filter(offset=>offset>0)).toEqual([20,40]);
});
