import { test, expect } from '@playwright/test';

for (const query of ['', '?reparado_version=' + (process.env.REPARADO_SHA || 'actual')]) {
 test('GitHub Pages inicia desde el enlace público ' + (query ? 'sin caché' : 'normal'), async ({page},info)=>{
   const failed=[];
   page.on('pageerror',err=>failed.push('JavaScript: '+err.message));
   page.on('requestfailed',req=>failed.push('Red: '+req.url()+' '+(req.failure()?.errorText||'')));
   const response=await page.goto('./'+query,{waitUntil:'domcontentloaded',timeout:30000});
   expect(response?.status()).toBe(200);
   try {
     await expect(page.locator('.customer-page h1')).toContainText('Tu hogar',{timeout:20000});
     await expect(page.locator('.category-grid .category-tile')).toHaveCount(5);
     await expect(page.locator('.customer-nav [data-view]')).toHaveCount(5);
     expect(failed.filter(message=>/assets\/.*\.js|JavaScript:/.test(message))).toEqual([]);
   } finally {
     await info.attach('errores-de-carga', {body:failed.join('\n') || 'Sin errores registrados',contentType:'text/plain'});
     await info.attach('estado-html', {body:(await page.locator('body').innerText().catch(()=>'' )).slice(0,2500),contentType:'text/plain'});
   }
 });
}

test('las imágenes del repositorio publicado no devuelven error',async({page})=>{
 await page.goto('./');
 await expect(page.locator('.category-tile')).toHaveCount(5,{timeout:20000});
 // Los iconos originales recuperados cargan como PNG con transparencia.
 await expect(page.locator('.category-tile img.category-restored')).toHaveCount(4);
 const photos=page.locator('.category-tile img.category-photo');
 await expect(photos).toHaveCount(5);
 for(const photo of await photos.all()){
   await photo.scrollIntoViewIfNeeded();
   await expect.poll(()=>photo.evaluate(img=>img.complete && img.naturalWidth>0),{timeout:12000}).toBeTruthy();
 }
});

test('las 12 fotografías de Manitas están publicadas y cargan sin errores',async({page})=>{
 await page.goto('./');
 await expect(page.locator('.category-tile')).toHaveCount(5,{timeout:20000});
 await page.locator('.category-tile[data-category-open="Manitas"]').click();
 await page.locator('[data-expand-services]').click();
 const photos=page.locator('.category-services img.service-photo');
 await expect(photos).toHaveCount(12);
 for(const img of await photos.all()){
   await img.scrollIntoViewIfNeeded();
   await expect.poll(()=>img.evaluate(e=>e.complete && e.naturalWidth>=300),{timeout:12000}).toBeTruthy();
 }
 const credit=page.locator('.manitas-photo-credits a');
 await expect(credit).toHaveAttribute('href',/creditos-fotos-manitas[.]html/);
 const file=await page.request.get(await credit.getAttribute('href'));
 expect(file.ok()).toBeTruthy();
});


test('la web pública distingue demostración de modo conectado y protege moderación',async({page},info)=>{
 const testBackendRequests=[];
 page.on('request',request=>{
   if(request.url().includes('kpmmlzjvespenogqtujo.supabase.co')){
     testBackendRequests.push(request.method()+' '+new URL(request.url()).pathname);
   }
 });
 await page.goto('./',{waitUntil:'domcontentloaded'});
 const section=page.locator('#reparado-reviews');
 await expect(section).toBeVisible({timeout:20000});
 await expect(section.locator('[data-review-filter]')).toHaveCount(0);
 await expect(section.locator('.review-demo')).toHaveCount(0);
 await expect(section.locator('[data-review-feed]')).toContainText('Todavía no hay valoraciones reales publicadas.');
 await expect(page.locator('[data-review-decision]')).toHaveCount(0);
 await expect(page.locator('[data-view="review-moderation"]')).toHaveCount(0);
 const mode=await section.locator('[data-review-mode-info]').innerText();
 const demo=/Modo de demostración/.test(mode);
 const connected=/Para escribir una opinión real|Para publicar una opinión auténtica|Solo puedes valorar/.test(mode);
 expect(demo||connected, 'Mostrar un estado de conexión comprensible').toBeTruthy();
 expect(testBackendRequests,'REPARADO Test no debe conectarse a GitHub Pages público').toEqual([]);
 await info.attach('modo-publicado',{body:demo?'REPARADO público en modo local demostración':'Cliente conectado: comprobar que no sea REPARADO Test',contentType:'text/plain'});
});
