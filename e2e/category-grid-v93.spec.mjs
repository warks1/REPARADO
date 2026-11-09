import {test,expect} from '@playwright/test';

const categories=[
 ['plumbing','plumbing-transparent.png'],
 ['masonry','masonry-transparent.png'],
 ['parquet','parquet-transparent.png'],
 ['renovation','renovation-transparent.png'],
 ['handyman','handyman-transparent.svg'],
 ['electricity','electricity-transparent.svg']
];

test('V93: las seis tarjetas tienen la misma anchura, altura y cuadrícula 2×3',async({page})=>{
 await page.goto('/');
 const grid=page.locator('.category-grid');
 const cards=grid.locator('.category-tile');
 await expect(cards).toHaveCount(6);

 const rects=await cards.evaluateAll(nodes=>nodes.map(node=>{
   const b=node.getBoundingClientRect();
   const st=getComputedStyle(node);
   const art=node.querySelector('.category-art');
   const picture=art?.querySelector('img.category-restored');
   return {x:b.x,y:b.y,width:b.width,height:b.height,
     gridColumn:st.gridColumnStart,
     innerImage:!!picture,hasMotion:!!art?.querySelector('.category-motion'),
     text:node.querySelector('strong')?.textContent};
 }));
 for(const rect of rects){
   expect(rect.width).toBeGreaterThan(120);
   expect(rect.height).toBeGreaterThan(90);
   expect(Math.abs(rect.width-rects[0].width)).toBeLessThanOrEqual(2);
   expect(Math.abs(rect.height-rects[0].height)).toBeLessThanOrEqual(2);
   expect(rect.innerImage).toBe(true);
   expect(rect.hasMotion).toBe(true);
 }
 expect(Math.abs(rects[4].x-rects[0].x)).toBeLessThanOrEqual(2);
 expect(Math.abs(rects[5].x-rects[1].x)).toBeLessThanOrEqual(2);
 expect(Math.abs(rects[4].y-rects[5].y)).toBeLessThanOrEqual(2);
 expect(rects[4].y).toBeGreaterThan(rects[2].y);
 expect(rects[5].y).toBeGreaterThan(rects[3].y);

 for(const [slug,filename] of categories){
   const tile=page.locator('.category-tile.theme-'+slug);
   const image=tile.locator('img.category-restored');
   await image.scrollIntoViewIfNeeded();
   await expect(image).toBeVisible();
   await expect(image).toHaveAttribute('src',new RegExp(filename.replace('.','\\.')));
   await expect.poll(()=>image.evaluate(img=>img.complete && img.naturalWidth>0))
     .toBe(true);
   const motion=await tile.locator('.category-motion').evaluate(el=>{
     const css=getComputedStyle(el);
     return {duration:css.animationDuration,name:css.animationName};
   });
   expect(motion.name).toBe('illustration-bob');
   expect(motion.duration).toBe('3.6s');
 }
 const handyman=page.locator('.category-tile.theme-handyman img.category-restored');
 const electricity=page.locator('.category-tile.theme-electricity img.category-restored');
 for(const image of [handyman,electricity]){
   const css=await image.evaluate(el=>{
     const st=getComputedStyle(el);
     return {fit:st.objectFit,mask:st.webkitMaskImage||st.maskImage};
   });
   expect(css.fit).toBe('contain');
   expect(css.mask).toContain('radial-gradient');
 }

 await grid.screenshot({path:'test-results/v93-six-category-cards-'+test.info().project.name+'.png'});
});

test('V93: Manitas y Electricidad siguen abriendo sus servicios y se vuelve al inicio',async({page})=>{
 await page.goto('/');
 for(const name of ['Manitas','Electricidad']){
   await page.locator('.category-tile[data-category-open="'+name+'"]').click();
   await expect(page.locator('.category-hero h1')).toBeVisible();
   await expect(page.locator('.category-services .catalog-service').first()).toBeVisible();
   await page.locator('[data-back]').first().click();
   await expect(page.locator('.category-grid .category-tile')).toHaveCount(6);
 }
});
