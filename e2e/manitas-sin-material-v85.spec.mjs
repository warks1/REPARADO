import {test,expect} from '@playwright/test';
import {services} from '../catalog-data.js';

const tvIndex=services.findIndex(item=>item[1]==='Instalación de soporte de TV en pared');
const sinkIndex=services.findIndex(item=>item[1]==='Sustitución de grifo');

test('V85: Manitas muestra tarifas sin material, IVA incluido y accesorios del cliente',async({page})=>{
 await page.goto('/');
 await page.locator('[data-category-open="Manitas"]').click();
 const notice=page.locator('.catalog-price-policy');
 await expect(notice).toContainText('MATERIAL NO INCLUIDO');
 await expect(notice).toContainText('IVA del 21 %');
 await expect(page.locator('[data-service="'+tvIndex+'"]')).toContainText('109,00 €');
 await page.locator('[data-service="'+tvIndex+'"]').click();
 const form=page.locator('#local-request');
 await expect(form).toBeVisible();
 await expect(page.locator('.form-service-summary')).toContainText('material NO incluido');
 await expect(page.locator('.form-service-summary')).toContainText('109,00 €');
 await expect(page.locator('.service-includes')).toContainText('aportados por el cliente');
 await expect(form.locator('input[name=manitas_material][value=client]')).toBeChecked();
 await form.locator('input[name=manitas_material][value=quote]').check();
 await expect(form.locator('input[name=manitas_material][value=quote]')).toBeChecked();
 await expect(page.locator('.request-screen .notice').last()).toContainText('MATERIAL NO INCLUIDO');
});

test('V85: Fontanería sigue indicando materiales incluidos',async({page})=>{
 await page.goto('/');
 await page.locator('[data-category-open="Fontanería"]').click();
 await expect(page.locator('.catalog-price-policy')).toContainText('materiales estándar descritos');
 await page.locator('[data-service="'+sinkIndex+'"]').click();
 await expect(page.locator('.form-service-summary')).toContainText('Material estándar, mano de obra e IVA incluidos');
 await expect(page.locator('#local-request input[name=manitas_material]')).toHaveCount(0);
});
