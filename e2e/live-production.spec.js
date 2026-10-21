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
 // Los cuatro SVG son objetos locales sin recortes blancos ni descargas remotas.
 await expect(page.locator('.category-tile svg.clean-category-illustration')).toHaveCount(4);
 const photo=page.locator('.theme-handyman img.category-photo');
 await expect(photo).toHaveCount(1);
 await photo.scrollIntoViewIfNeeded();
 await expect.poll(()=>photo.evaluate(img=>img.complete && img.naturalWidth>0),{timeout:12000}).toBeTruthy();
});
