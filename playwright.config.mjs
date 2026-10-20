import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'iphone-390', use: { browserName:'chromium', viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true } },
    { name: 'android-412', use: { browserName:'chromium', viewport:{width:412,height:915}, deviceScaleFactor:2.75, isMobile:true, hasTouch:true } },
    { name: 'tablet-820', use: { browserName:'chromium', viewport:{width:820,height:1180}, deviceScaleFactor:2, isMobile:true, hasTouch:true } }
  ],
  webServer: {
    command:'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:!process.env.CI,
    timeout:90000,
    env:{VITE_SUPABASE_URL:'',VITE_SUPABASE_ANON_KEY:''}
  }
});
