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
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(approved)});
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
