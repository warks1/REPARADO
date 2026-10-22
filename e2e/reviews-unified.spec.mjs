import {test,expect} from '@playwright/test';

test('sin valoraciones reales la portada muestra un estado vacío, nunca reseñas inventadas',async({page})=>{
 await page.goto('/');
 const section=page.locator('#reparado-reviews');
 await expect(section).toBeVisible();
 await expect(section.locator('.review-real')).toHaveCount(0);
 await expect(section.locator('.review-demo')).toHaveCount(0);
 await expect(section.locator('[data-review-feed]')).toContainText('Todavía no hay valoraciones reales publicadas.');
 await expect(section.locator('[data-reviews-summary]')).toContainText('Todavía no hay valoraciones reales publicadas.');
 await expect(section.locator('[data-review-filter]')).toHaveCount(0);
 await expect(section.locator('[data-expand-reviews]')).toBeHidden();
 await expect(section.locator('#reparado-review-form')).toBeVisible();
 await expect(section.locator('[data-review-mode-info]')).toContainText('Modo de demostración');
 await section.locator('textarea[name=comment]').fill('Todo muy bien en la prueba del formulario.');
 await section.getByRole('button',{name:'Enviar valoración'}).click();
 await expect(section.locator('[data-review-feedback]')).toContainText('no se ha enviado a REPARADO');
 await expect(section.locator('.review-card')).toHaveCount(0);
});
