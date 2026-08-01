import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appVersion = process.env.npm_package_version ?? '1.0.0';

// The office app. Deliberately not a PWA: managers work at a desk on a
// connection, so there is no service worker, no offline cache and no install
// prompt. That keeps the bundle small and avoids a stale cache showing an old
// rota, which would be worse than a spinner.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: Number(process.env.PORT) || 5174,
    // Reachable from a phone or tablet on the same Wi-Fi for testing.
    host: true,
  },
});
