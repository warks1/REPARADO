import {test,expect} from '@playwright/test';

test('valoraciones agrupadas con filtros funcionales en móvil',async({page})=>{
  await page.goto('/');
  const reviews=page.locator('#reparado-reviews');
  await expect(reviews).toBeVisible();
  await expect(reviews.locator('.review-demo')).toHaveCount(32);
  await expect(reviews.locator('.review-real')).toHaveCount(0);
  await expect(reviews.locator('[data-reviews-summary]')).toContainText('32 ejemplos ficticios');
  await reviews.locator('[data-review-filter="real"]').click();
  await expect(reviews.locator('[data-review-feed]')).toContainText('Todavía no hay valoraciones reales aprobadas');
  await expect(reviews.locator('[data-review-feed] .review-demo')).toHaveCount(0);
  await reviews.locator('[data-review-filter="examples"]').click();
  await expect(reviews.locator('[data-review-feed] .review-demo')).toHaveCount(32);
  await expect(reviews.locator('.review-demo:visible')).toHaveCount(4);
  await reviews.locator('[data-expand-reviews]').click();
  await expect(reviews.locator('.review-demo:visible')).toHaveCount(32);
  await reviews.locator('[data-review-filter="all"]').click();
  await expect(reviews.locator('.review-demo:visible')).toHaveCount(4);
  await expect(reviews.locator('[data-review-filter="all"]')).toHaveAttribute('aria-pressed','true');
  await expect(reviews.locator('.reviews-disclaimer')).toContainText('No son testimonios reales');
});
