import {test,expect} from '@playwright/test';
import {services} from '../catalog-data.js';

const first=services.findIndex(s=>s[1]==='Sustitución de enchufe estándar');
const breaker=services.findIndex(s=>s[1]==='Sustitución de diferencial estándar');

test('V86: seis categorías visibles y acceso a Electricidad con fotos y precios',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.category-tile')).toHaveCount(6);
 await expect(page.locator('[data-category-open="Electricidad"].category-tile')).toBeVisible();
 const chosen=page.locator('[data-category-open="Electricidad"].category-tile');
 await expect(chosen).toContainText('Electricidad');
 await chosen.click();
 await expect(page.locator('.category-hero h1')).toContainText('Electricidad');
 await expect(page.locator('.catalog-price-policy')).toContainText('IVA del 21 %');
 await expect(page.locator('.category-services .catalog-service')).toHaveCount(10);
 await expect(page.locator('.category-services .catalog-service:visible')).toHaveCount(4);
 await page.locator('[data-expand-services]').click();
 await expect(page.locator('.category-services .catalog-service:visible')).toHaveCount(10);
 for(const item of services.filter(s=>s[0]==='Electricidad')){
   const index=services.findIndex(s=>s[1]===item[1]);
   const card=page.locator('[data-service="'+index+'"]');
   await expect(card).toContainText(item[1]);
   await expect(card.locator('img.service-photo')).toHaveCount(1);
   await expect(card.locator('img.service-photo')).toHaveAttribute('src',/images\.pexels\.com/);
   await expect(card).toContainText(String(item[2])+',00 €');
 }
 await page.locator('[data-service="'+breaker+'"]').click();
 await expect(page.locator('.form-service-summary')).toContainText('159,00 €');
 await expect(page.locator('.form-service-summary')).toContainText('Material estándar');
 await expect(page.locator('#local-request')).toBeVisible();
});

test('V86: precios actualizados y Manitas sin material se mantienen diferentes',async({page})=>{
 await page.goto('/');
 await page.locator('[data-category-open="Fontanería"].category-tile').click();
 await page.locator('[data-service="3"]').click();
 await expect(page.locator('.form-service-summary')).toContainText('189,00 €');
 await page.locator('[data-back]').first().click();
 await page.locator('[data-category-open="Manitas"].category-tile').click();
 await expect(page.locator('.catalog-price-policy')).toContainText('MATERIAL NO INCLUIDO');
 await page.locator('[data-service="25"]').click();
 await expect(page.locator('.form-service-summary')).toContainText('material NO incluido');
 await expect(page.locator('#local-request input[name=manitas_material]')).toHaveCount(2);
});
