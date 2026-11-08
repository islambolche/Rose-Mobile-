import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yousuf.roseai',
  appName: 'Rose AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
