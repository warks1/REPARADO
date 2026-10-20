import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

test('portada real por categorías, imágenes y navegación sin desbordamiento',async({page},testInfo)=>{
  await page.goto('/');
  await expect(page.locator('.customer-header .brand-word')).toHaveText('Reparado');
  await expect(page.getByRole('heading',{name:/Tu hogar/})).toBeVisible();
  await expect(page.locator('.category-tile')).toHaveCount(4);
  await expect(page.locator('.customer-nav button')).toHaveCount(5);
  await expect(page.locator('.promo-banner')).toBeVisible();
  const cropStyle=await page.locator('.category-tile svg.reference-sprite').first()
    .evaluate(el=>({overflow:getComputedStyle(el).overflowX,contain:getComputedStyle(el).contain}));
  expect(cropStyle.overflow).toBe('hidden');
  expect(cropStyle.contain).toContain('paint');
  const dims=await page.evaluate(()=>({
    documentWidth:document.documentElement.scrollWidth,
    viewportWidth:window.innerWidth,
    fixedNav:Math.round(document.querySelector('.customer-nav').getBoundingClientRect().bottom)
  }));
  expect(dims.documentWidth).toBeLessThanOrEqual(dims.viewportWidth+2);
  expect(dims.fixedNav).toBeLessThanOrEqual(testInfo.project.use.viewport.height+2);
  const atlas=await page.evaluate(async()=>{
    const image=document.querySelector('.category-tile image')?.getAttribute('href');
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
  await expect(page.locator('.category-services .catalog-service').first()).toBeVisible();
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
