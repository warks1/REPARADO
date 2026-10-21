import {test,expect} from '@playwright/test';

test('REPARADO conectado: acceso por invitación en lugar de alta pública',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.customer-header')).toBeVisible();
  await page.getByRole('button',{name:'Mi perfil'}).click();
  await expect(page.locator('.auth #login')).toBeVisible();
  await expect(page.getByText('Acceso privado: solicita una invitación al equipo de Reparado.')).toBeVisible();
  await expect(page.locator('#register')).toHaveCount(0);
  await expect(page.locator('#register-form')).toHaveCount(0);
  await expect(page.locator('#login input[name=email]')).toBeVisible();
  await expect(page.locator('#login input[name=password]')).toBeVisible();
  await expect(page.getByRole('button',{name:'Entrar'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('REPARADO conectado: navegar a un servicio sin sesión conduce a login privado',async({page})=>{
  await page.goto('/');
  await expect(page.locator('[data-service]').first()).toBeVisible();
  await page.locator('[data-service]').first().click();
  await expect(page.locator('.auth #login')).toBeVisible();
  await expect(page.locator('.auth-invite-notice')).toBeVisible();
  await expect(page.locator('#register-form')).toHaveCount(0);
});

test('Acceso privado: recuperar contraseña sin mostrar registro público',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Mi perfil'}).click();
  await expect(page.locator('#login')).toBeVisible();
  await page.getByRole('button',{name:'¿Has olvidado tu contraseña?'}).click();
  await expect(page.locator('#reset-form')).toBeVisible();
  await expect(page.locator('#login')).toBeHidden();
  await expect(page.locator('#register')).toHaveCount(0);
  await expect(page.locator('#reset-form input[name=email]')).toHaveAttribute('type','email');
  await page.getByRole('button',{name:'Volver a entrar'}).click();
  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('#reset-form')).toBeHidden();
});
