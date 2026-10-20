import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'live-production.spec.js',
  timeout: 45000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://warks1.github.io/REPARADO/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: false
  },
  projects: [
    {name:'publicado-iphone-webkit',use:{browserName:'webkit',viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:'publicado-android-chromium',use:{browserName:'chromium',viewport:{width:412,height:915},isMobile:true,hasTouch:true}}
  ]
});
