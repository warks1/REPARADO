import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.ams.reparado',
  appName: 'Reparado',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    PushNotifications: { presentationOptions: ['badge','sound','alert'] }
  }
};
export default config;