import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Env vars must be prefixed with VITE_ to reach the client (see .env.example).
// Surfaced in the UI so a carer can tell support which build they are on.
const appVersion = process.env.npm_package_version ?? '1.0.0';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      // prompt: we surface our own "new version ready" bar instead of
      // silently swapping the app out from under a carer mid-shift.
      registerType: 'prompt',
      includeAssets: ['logo.png', 'icons/favicon.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Offline clock-in is a Must — navigation falls back to the cached shell.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // API GETs: serve fresh when online, fall back to cache offline.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        // Plain ASCII deliberately. This string is shown on the Android install
        // dialog and under the icon, and the em dash that was here came through
        // the build double encoded, so it read "Best Pinnacle Care â€" Carer".
        name: 'Best Pinnacle Care',
        // Under about 12 characters, or Android truncates it on the home screen.
        short_name: 'Pinnacle',
        description:
          'Clock in and out, view your shifts, capture GPS and message your team.',
        theme_color: '#10b3c6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        // A stable identity for the app. Without it Chrome derives one from
        // start_url, so changing that later would register as a different app
        // and installed copies would be orphaned.
        id: '/',
        categories: ['business', 'productivity', 'medical'],
        // Every entry must match the real file exactly. Android Chrome checks
        // the declared size against the image and rejects the icon when they
        // disagree; with no usable icon the app fails the installability check
        // and beforeinstallprompt never fires, so the Install button does
        // nothing. That is what was happening: these all pointed at the
        // 2667x1611 landscape logo while claiming to be 512x512.
        //
        // Regenerate with scripts/make-icons.mjs after changing the logo.
        icons: [
          { src: '/icons/icon-48.png', sizes: '48x48', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Separate artwork with the logo pulled well inside the safe zone,
          // because Android crops maskable icons to a circle or a squircle.
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press the installed icon to jump straight to a task.
        shortcuts: [
          {
            name: 'Clock in and out',
            short_name: 'Clock',
            url: '/clock',
            description: 'Open the shift timer',
            icons: [{ src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: "Today's shifts",
            short_name: 'Shifts',
            url: '/shifts',
            description: 'See your rota',
            icons: [{ src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Messages',
            short_name: 'Messages',
            url: '/messages',
            description: 'Talk to your team',
            icons: [{ src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
      devOptions: {
        // Lets us exercise install/offline behaviour without a production build.
        enabled: true,
        type: 'module',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Keep React and the router in their own chunk so screen chunks stay
        // small. Written as a function because Rolldown, which Vite 8 uses,
        // dropped support for the object form.
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
    port: Number(process.env.PORT) || 5173,
    // Listen on every interface, not just loopback, so a phone on the same
    // Wi-Fi can reach the dev server at http://<your-computer-ip>:5173.
    // Vite prints the address on start. On Windows the first connection may
    // also need an inbound firewall rule for Node on that port.
    host: true,
    allowedHosts: [
      'bestpinnaclecare.co.uk',
      'superscholarly-unpretermitted-sadye.ngrok-free.dev',
      // Private ranges, so a phone reaching the server by IP is not rejected
      // by the host check.
      '.local',
    ],
  },
});
