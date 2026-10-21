import {test,expect} from '@playwright/test';

/* Regresión del fallo enviado en vídeo: los PNG aprobados de Parquet y
   Reformas no pueden mostrar fondos rectangulares ni bandas en los bordes
   mientras oscilan. Comprobar transparencia visual por máscara CSS,
   sin sustituir sus imágenes ni modificar las otras categorías. */
test('Parquet y Reformas: borde difuminado, PNG existente y oscilación limitada',async({page})=>{
  await page.goto('/');
  for(const [theme,photo] of [['parquet','parquet-transparent.png'],['renovation','renovation-transparent.png']]){
    const tile=page.locator('.category-tile.theme-'+theme);
    const image=tile.locator('img.category-restored');
    await expect(tile).toBeVisible();
    await expect(image).toBeVisible();
    const visual=await image.evaluate(img=>{
      const style=getComputedStyle(img);
      const motion=getComputedStyle(img.closest('.category-motion'));
      const art=getComputedStyle(img.closest('.category-art'));
      const tile=img.closest('.category-tile').getBoundingClientRect();
      return {
        src:img.currentSrc,
        loaded:img.complete&&img.naturalWidth>0&&img.naturalHeight>0,
        mask:style.webkitMaskImage||style.maskImage,
        animation:motion.animationName,
        duration:motion.animationDuration,
        clipped:art.overflow==='hidden',
        maskRepeats:style.webkitMaskRepeat||style.maskRepeat,
        withinScreen:tile.left>=0&&tile.right<=innerWidth+2
      };
    });
    expect(visual.src).toContain(photo);
    expect(visual.loaded).toBe(true);
    expect(visual.mask).toContain('radial-gradient');
    // Los navegadores serializan 'transparent' como rgba(0,0,0,0).
    expect(visual.mask).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)/);
    expect(visual.maskRepeats).toContain('no-repeat');
    expect(visual.animation).toBe('illustration-bob');
    expect(visual.duration).toBe('3.6s');
    expect(visual.clipped).toBe(true);
    expect(visual.withinScreen).toBe(true);
  }
  // Manitas utiliza su dibujo SVG aprobado, intacto.
  const handyman=page.locator('.category-tile.theme-handyman img.category-photo');
  await expect(handyman).toBeVisible();
  const src=await handyman.getAttribute('src');
  expect(src).toContain('handyman.svg');
});
