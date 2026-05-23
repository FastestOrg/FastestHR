import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fastesthr',
  appName: 'FastestHR',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
