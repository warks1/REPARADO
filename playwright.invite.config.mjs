import {defineConfig} from '@playwright/test';

// Servidor aislado con URL y clave FICTICIAS. No toca Supabase Test ni
// usa claves reales: prueba exclusivamente la interfaz de inicio de sesión.
export default defineConfig({
  testDir:'./e2e-private',
  timeout:30000,
  reporter:[['list']],
  use:{baseURL:'http://127.0.0.1:4186'},
  projects:[
    {name:'iphone',use:{browserName:'webkit',viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:'android',use:{browserName:'chromium',viewport:{width:412,height:915},isMobile:true,hasTouch:true}}
  ],
  webServer:{
    command:'npm run build && npm run preview -- --host 127.0.0.1 --port 4186 --strictPort',
    url:'http://127.0.0.1:4186',
    reuseExistingServer:!process.env.CI,
    timeout:90000,
    env:{
      VITE_SUPABASE_URL:'https://reparado-test-placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY:'sb_publishable_fake_not_a_real_key',
      VITE_REPARADO_ALLOW_PUBLIC_REGISTRATION:'false'
    }
  }
});
