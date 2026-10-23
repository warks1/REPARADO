import {test,expect} from '@playwright/test';

// Pruebas aisladas de red: no se envían solicitudes a REPARADO Test.
test.beforeEach(async({page})=>{
  await page.route('https://reparado-test-placeholder.supabase.co/rest/v1/customer_reviews?**',
    route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
});
test('V21: recuperar contraseña tras error de red permite reintentar',async({page})=>{
  let attempts=0;
  await page.route('https://reparado-test-placeholder.supabase.co/auth/v1/recover**',route=>{
    attempts++;
    return route.abort('failed');
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Mi perfil'}).click();
  await page.getByRole('button',{name:'¿Has olvidado tu contraseña?'}).click();
  const form=page.locator('#reset-form');
  await form.locator('input[name=email]').fill('prueba@ejemplo.invalid');
  const button=form.getByRole('button',{name:'Recibir enlace de recuperación'});
  await button.click();
  await expect(button).toBeEnabled();
  await expect(page.locator('[data-feedback]')).toContainText(/No se pudo/);
  await button.click();
  await expect(button).toBeEnabled();
  expect(attempts).toBe(2);
});
