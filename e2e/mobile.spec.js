import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

test('portada real por categorías, imágenes y navegación sin desbordamiento',async({page},testInfo)=>{
  await page.goto('/');
  await expect(page.locator('.customer-header .brand-word')).toHaveText('Reparado');
  await expect(page.getByRole('heading',{name:/Tu hogar/})).toBeVisible();
  await expect(page.locator('.category-tile')).toHaveCount(5);
  await expect(page.locator('.customer-nav button')).toHaveCount(5);
  await expect(page.locator('.promo-banner')).toBeVisible();
  // La portada conserva los cinco dibujos 3D; cuatro PNG transparentes
  // y el SVG de Manitas sin modificar.
  const photos=page.locator('.category-tile img.category-photo');
  await expect(photos).toHaveCount(5);
  for (const photo of await photos.all()){
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(()=>photo.evaluate(img=>
      img.complete && img.naturalWidth>=200 && img.naturalHeight>=80
    ),{timeout:12000}).toBeTruthy();
  }
  const dims=await page.evaluate(()=>({
    documentWidth:document.documentElement.scrollWidth,
    viewportWidth:window.innerWidth,
    fixedNav:Math.round(document.querySelector('.customer-nav').getBoundingClientRect().bottom)
  }));
  expect(dims.documentWidth).toBeLessThanOrEqual(dims.viewportWidth+2);
  expect(dims.fixedNav).toBeLessThanOrEqual(testInfo.project.use.viewport.height+2);
  const atlas=await page.evaluate(async()=>{
    const image=document.querySelector('.category-tile img.category-photo')?.src;
    if(!image)return false;
    const response=await fetch(image);
    return response.ok && response.headers.get('content-type')?.includes('image/');
  });
  expect(atlas).toBeTruthy();
  const dir=join(testInfo.outputDir,'evidencia-visual');
  mkdirSync(dir,{recursive:true});
  await page.screenshot({path:join(dir,'inicio-'+testInfo.project.name+'.png'),fullPage:true});
});

test('filtros, categoría y formulario de cliente navegan y vuelven correctamente',async({page},testInfo)=>{
  await page.goto('/');
  const filter=page.locator('[data-toggle-filters]');
  await filter.click();
  await expect(filter).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#category-quick-filters')).toBeVisible();
  await page.locator('.category-tile[data-category-open="Fontanería"]').click();
  await expect(page.locator('.category-view h1')).toHaveText('Fontanería');
  const hero=page.locator('.category-view .hero-illustration');
  await expect(hero).toBeVisible();
  await expect.poll(()=>hero.evaluate(img=>img.complete && img.naturalWidth>=200)).toBe(true);
  await expect(page.locator('.category-services .catalog-service').first()).toBeVisible();
  await expect(page.locator('.category-services .catalog-service:visible')).toHaveCount(4);
  await expect.poll(()=>page.locator('.category-services .catalog-service:visible .service-photo').evaluateAll(items=>
    items.every(img=>img.complete&&img.naturalWidth>=100)
  ),{timeout:12000}).toBeTruthy();
  const photoSizes=await page.locator('.category-services .catalog-service:visible .service-photo').evaluateAll(items=>
    items.map(img=>({loaded:img.complete,width:img.naturalWidth}))
  );
  expect(photoSizes).toHaveLength(4);
  expect(photoSizes.every(img=>img.loaded && img.width>=100)).toBeTruthy();
  const allServices=page.locator('[data-expand-services]');
  await expect(allServices).toHaveAttribute('aria-expanded','false');
  await allServices.click();
  await expect(allServices).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('.category-services .catalog-service:visible')).toHaveCount(8);
  await allServices.click();
  await expect(page.locator('.category-services .catalog-service:visible')).toHaveCount(4);
  const imageDir=join(testInfo.outputDir,'evidencia-visual');
  mkdirSync(imageDir,{recursive:true});
  await page.screenshot({path:join(imageDir,'fontaneria-'+testInfo.project.name+'.png'),fullPage:true});
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(testInfo.project.use.viewport.width+2);
  await page.locator('.category-services [data-service]').first().click();
  await expect(page.locator('.request-screen h2')).toHaveText('Nueva solicitud');
  await expect(page.locator('#local-request')).toBeVisible();
  await page.locator('.request-screen [data-back]').click();
  await expect(page.locator('.category-view h1')).toHaveText('Fontanería');
  await page.locator('.category-view [data-back]').click();
  await expect(page.getByRole('heading',{name:/Tu hogar/})).toBeVisible();
  const doc=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(doc).toBeLessThanOrEqual(testInfo.project.use.viewport.width+2);
});

test('la búsqueda encuentra un servicio fuera de los cuatro destacados',async({page})=>{
 await page.goto('/');
 const input=page.locator('#category-search');
 await input.fill('cisterna');
 await expect(page.locator('.popular-list [data-service="4"]')).toBeVisible();
 await page.locator('.popular-list [data-service="4"]').click();
 await expect(page.locator('#local-request')).toBeVisible();
 await expect(page.locator('.form-service-summary')).toContainText('Mecanismo de cisterna');
 await page.locator('[data-back]').first().click();
 await input.fill('servicio inexistente único');
 await expect(page.locator('.no-results')).toBeVisible();
});

test('la versión compilada inicia y no se queda en blanco',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await expect(page.locator('.customer-page h1')).toContainText('Tu hogar');
 await expect(page.locator('.customer-nav button')).toHaveCount(5);
 expect(errors).toEqual([]);
});

test('si falla el JavaScript se muestra una pantalla de recuperación',async({page})=>{
 await page.route('**/assets/*.js',route=>route.abort('failed'));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'No hemos podido abrir Reparado'})).toBeVisible({timeout:11000});
 await expect(page.getByRole('button',{name:'Volver a intentar'})).toBeVisible();
});

test('un perfil local guardado como null no rompe el arranque',async({page})=>{
 await page.addInitScript(()=>{
   localStorage.setItem('reparado-local-profile','null');
   localStorage.setItem('reparado-local-requests','null');
 });
 await page.goto('/');
 await expect(page.locator('.customer-page h1')).toContainText('Tu hogar');
 await page.locator('.customer-nav [data-view="profile"]').click();
 await expect(page.getByRole('heading',{name:'Mi perfil'})).toBeVisible();
 await page.locator('.customer-nav [data-view="requests"]').click();
 await expect(page.getByRole('heading',{name:'Mis solicitudes'})).toBeVisible();
});

test('reintentar desde error no reutiliza HTML en caché',async({page})=>{
 await page.route('**/assets/*.js',route=>route.abort('failed'));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'No hemos podido abrir Reparado'})).toBeVisible({timeout:17000});
 await expect(page.locator('#reparado-cause')).toContainText(/DIAGNÓSTICO|Diagnóstico/);
 const click=page.waitForURL(url=>url.searchParams.has('reparado_reload'),{timeout:12000});
 await page.locator('#reparado-retry').click();
 await click;
 expect(new URL(page.url()).searchParams.get('reparado_reload')).toMatch(/^[0-9]+$/);
});

test('Solicitudes y Agenda permiten modificar preferencias y borrar una solicitud local',async({page})=>{
 await page.goto('/');
 await page.locator('.category-tile[data-category-open="Fontanería"]').click();
 await page.locator('.category-services [data-service="2"]').click();
 const form=page.locator('#local-request');
 await form.locator('[name="street"]').fill('Calle del Test');
 await form.locator('[name="address_number"]').fill('12, 1º 2ª');
 await form.locator('[name="postal_code"]').fill('08001');
 await form.locator('[name="city"]').fill('Barcelona');
 await form.locator('[name="phone"]').fill('600000000');
 await form.locator('[name="description"]').fill('Pérdida de agua en el grifo de la cocina');
 await form.locator('[name="preferred_date"]').fill('2026-11-12');
 await form.locator('button[type="submit"]').click();
 await expect(page.getByRole('heading',{name:'Solicitud guardada en este dispositivo'})).toBeVisible();
 await page.locator('.request-confirm [data-view="requests"]').click();
 await expect(page.locator('[data-local-item]')).toHaveCount(1);
 await page.locator('[data-local-detail]').click();
 await expect(page.getByRole('heading',{name:'Detalle de la solicitud'})).toBeVisible();
 await expect(page.locator('.local-module')).toContainText('Calle del Test');
 const edit=page.locator('#local-edit-request');
 await edit.locator('[name="preferred_date"]').fill('2026-11-18');
 await edit.locator('[name="preferred_period"]').selectOption('Indiferente');
 await edit.locator('button[type="submit"]').click();
 await expect(page.locator('[data-feedback]')).toContainText('Preferencias actualizadas');
 await page.locator('.customer-nav [data-view="agenda"]').click();
 await expect(page.getByRole('heading',{name:'Mi agenda'})).toBeVisible();
 await expect(page.locator('[data-local-item]')).toHaveCount(1);
 await expect(page.locator('[data-local-item]')).toContainText('18/11/2026');
 await page.locator('[data-local-detail]').click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-local-delete]').click();
 await expect(page.getByRole('heading',{name:'Mi agenda'})).toBeVisible();
 await page.locator('.customer-nav [data-view="requests"]').click();
 await expect(page.locator('#local-request-list')).toContainText('Todavía no has guardado ninguna solicitud');
});

test('Perfil rellena la dirección y Chat conserva un borrador sin enviarlo',async({page})=>{
 await page.goto('/');
 await page.locator('.customer-nav [data-view="profile"]').click();
 const form=page.locator('#local-profile');
 await form.locator('[name="name"]').fill('Cliente de prueba');
 await form.locator('[name="phone"]').fill('611222333');
 await form.locator('[name="street"]').fill('Calle Pruebas');
 await form.locator('[name="address_number"]').fill('8');
 await form.locator('[name="postal_code"]').fill('08002');
 await form.locator('button[type="submit"]').click();
 await expect(page.locator('[data-feedback]')).toContainText('Perfil guardado');
 await page.locator('.customer-nav [data-view="home"]').click();
 await page.locator('.category-tile[data-category-open="Fontanería"]').click();
 await page.locator('.category-services [data-service="2"]').click();
 await expect(page.locator('#local-request [name="street"]')).toHaveValue('Calle Pruebas');
 await expect(page.locator('#local-request [name="phone"]')).toHaveValue('611222333');
 await page.locator('.customer-nav [data-view="chat"]').click();
 await page.locator('#contact-preview [name="body"]').fill('Consulta sobre una fuga');
 await page.locator('#contact-preview button[type="submit"]').click();
 await expect(page.locator('[data-feedback]')).toContainText('No se ha enviado');
 await page.locator('.customer-nav [data-view="home"]').click();
 await page.locator('.customer-nav [data-view="chat"]').click();
 await expect(page.locator('#contact-preview [name="body"]')).toHaveValue('Consulta sobre una fuga');
 await page.locator('[data-clear-chat-draft]').click();
 await expect(page.locator('#contact-preview [name="body"]')).toHaveValue('');
});

test('seguimiento local: historial, copia y resguardo imprimible',async({page})=>{
 await page.goto('/');
 await page.locator('.category-tile[data-category-open="Fontanería"]').click();
 await page.locator('.category-services [data-service="2"]').click();
 const form=page.locator('#local-request');
 await form.locator('[name="street"]').fill('Calle Historial');
 await form.locator('[name="address_number"]').fill('12');
 await form.locator('[name="postal_code"]').fill('08003');
 await form.locator('[name="city"]').fill('Barcelona');
 await form.locator('[name="phone"]').fill('611222333');
 await form.locator('[name="description"]').fill('Revisión del fregadero');
 await form.locator('button[type="submit"]').click();
 await page.locator('.request-confirm [data-view="requests"]').click();
 await page.locator('[data-local-detail]').click();
 await expect(page.locator('.local-timeline li')).toHaveCount(1);
 await expect(page.locator('.local-timeline')).toContainText('Solicitud guardada');
 await expect(page.locator('.request-document-print')).toContainText('NO es una factura');
 const downloadPromise=page.waitForEvent('download');
 await page.locator('[data-local-export]').click();
 const download=await downloadPromise;
 expect(download.suggestedFilename()).toMatch(/^reparado-solicitud-.*\.json$/);
 await page.locator('#local-edit-request [name="preferred_date"]').fill('2026-11-15');
 await page.locator('#local-edit-request button[type="submit"]').click();
 await expect(page.locator('.local-timeline li')).toHaveCount(2);
 await expect(page.locator('.request-document-print')).toContainText('2026-11-15');
});

test('mis solicitudes: exportar todas y restaurar una copia local sin perder datos',async({page})=>{
 await page.goto('/');
 await page.locator('.category-tile[data-category-open="Fontanería"]').click();
 await page.locator('.category-services [data-service="2"]').click();
 const form=page.locator('#local-request');
 await form.locator('[name="street"]').fill('Calle Copia');
 await form.locator('[name="address_number"]').fill('14');
 await form.locator('[name="postal_code"]').fill('08010');
 await form.locator('[name="city"]').fill('Barcelona');
 await form.locator('[name="phone"]').fill('611222333');
 await form.locator('[name="description"]').fill('Revisión de grifo');
 await form.locator('button[type="submit"]').click();
 await page.locator('.request-confirm [data-view="requests"]').click();
 const downloadEvent=page.waitForEvent('download');
 await page.locator('[data-export-all]').click();
 const download=await downloadEvent;
 expect(download.suggestedFilename()).toBe('reparado-solicitudes-locales.json');
 const {readFileSync}=await import('node:fs');
 const original=readFileSync(await download.path());
 const backup=JSON.parse(original.toString('utf8'));
 expect(backup.sent_to_company).toBe(false);
 expect(backup.requests).toHaveLength(1);
 await page.locator('[data-local-detail]').click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('[data-local-delete]').click();
 await expect(page.locator('#local-request-list')).toContainText('Todavía no has guardado ninguna solicitud');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#local-import-file').setInputFiles({name:'reparado-solicitudes-locales.json',
   mimeType:'application/json',buffer:original});
 await expect(page.locator('[data-backup-feedback]')).toContainText('Importadas 1 solicitudes locales');
 await expect(page.locator('[data-local-item]')).toHaveCount(1);
 await page.locator('#local-import-file').setInputFiles({name:'reparado-solicitudes-locales.json',
   mimeType:'application/json',buffer:original});
 await expect(page.locator('[data-backup-feedback]')).toContainText('ya estaban guardadas');
 await expect(page.locator('[data-local-item]')).toHaveCount(1);
});

test('Manitas navega, abre servicios y mantiene el ancho en móvil',async({page},testInfo)=>{
 await page.goto('/');
 await page.locator('.category-tile[data-category-open="Manitas"]').click();
 await expect(page.locator('.category-view h1')).toHaveText('Manitas');
 await expect(page.locator('.category-services .catalog-service:visible')).toHaveCount(4);
 await page.locator('[data-expand-services]').click();
 await expect(page.locator('.category-services .catalog-service:visible')).toHaveCount(12);
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(2);
 await page.locator('.category-services .catalog-service:visible').first().click();
 await expect(page.locator('.form-service-summary')).toContainText('Montaje de mueble');
 await page.locator('.request-screen [data-back]').click();
 await expect(page.locator('.category-view h1')).toHaveText('Manitas');
});

test('las cuatro ilustraciones tienen exactamente la oscilación suave de Manitas',async({page},testInfo)=>{
  await page.goto('/');
  const manitas=page.locator('.theme-handyman img.category-photo');
  await expect(manitas).toHaveAttribute('src',/handyman[.]svg/);
  // Se compara el nombre, la duración y el desplazamiento en fotogramas
  // renderizados de Manitas con cada uno de los otros cuatro iconos.
  const readMotion=async locator=>locator.evaluate(async el=>{
    const style=getComputedStyle(el);
    const anim=el.getAnimations().find(a=>a.animationName==='illustration-bob');
    if(!anim) return {name:style.animationName,duration:style.animationDuration,travel:-1};
    const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    anim.pause();anim.currentTime=0;await frame();
    const initial=new DOMMatrix(getComputedStyle(el).transform).m42;
    anim.currentTime=1800;await frame();
    const half=new DOMMatrix(getComputedStyle(el).transform).m42;
    anim.play();
    return {name:style.animationName,duration:style.animationDuration,travel:Math.abs(half-initial)};
  });
  const reference=await readMotion(manitas);
  expect(reference.name).toContain('illustration-bob');
  expect(reference.travel).toBeGreaterThan(5);
  expect(reference.travel).toBeLessThan(7);
  for(const slug of ['plumbing','masonry','parquet','renovation']){
    const card=page.locator('.category-tile.theme-'+slug);
    const restored=card.locator('img.category-restored');
    await expect(restored).toHaveAttribute('src',new RegExp(slug+'-transparent\\.png'));
    await restored.scrollIntoViewIfNeeded();
    await expect.poll(()=>restored.evaluate(img=>img.complete&&img.naturalWidth>=200),{timeout:12000}).toBeTruthy();
    const stats=await restored.evaluate(img=>{
      const c=document.createElement('canvas');
      c.width=img.naturalWidth;c.height=img.naturalHeight;
      const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
      const rgba=ctx.getImageData(0,0,c.width,c.height).data;
      let transparent=0;
      for(let i=3;i<rgba.length;i+=4) if(rgba[i]===0) transparent++;
      return {ratio:transparent/(c.width*c.height),
              mask:getComputedStyle(img).maskImage||getComputedStyle(img).webkitMaskImage};
    });
    expect(stats.ratio).toBeGreaterThan(.07);
    expect(stats.mask).toContain('linear-gradient');
    const current=await readMotion(card.locator('.category-motion'));
    expect(current.name).toContain('illustration-bob');
    expect(current.duration).toBe(reference.duration);
    expect(Math.abs(current.travel-reference.travel)).toBeLessThan(.5);
    expect(current.travel).toBeLessThan(7);
  }
  const dir=join(testInfo.outputDir,'evidencia-visual');
  mkdirSync(dir,{recursive:true});
  await page.screenshot({path:join(dir,'mismo-movimiento-manitas-'+testInfo.project.name+'.png'),fullPage:true});
});
