import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_VERSION, VERSION_RELEASE_NOTES } from './src/version';

/**
 * Writes dist/version.json on every build.
 * Firebase Hosting is static, so there is no /api/version endpoint; this file
 * lets an installed app detect that a newer version has been published.
 */
function emitVersionFile(): Plugin {
  return {
    name: 'emit-version-file',
    apply: 'build',
    closeBundle() {
      const payload = {
        version: APP_VERSION,
        releaseNotes: VERSION_RELEASE_NOTES[APP_VERSION] || [],
        builtAt: new Date().toISOString(),
      };
      fs.mkdirSync('dist', { recursive: true });
      fs.writeFileSync(path.resolve('dist', 'version.json'), JSON.stringify(payload, null, 2));
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      emitVersionFile(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'manifest.json'],
        manifest: {
          name: 'Student Expense Tracker',
          short_name: 'ALU Expense',
          description: 'Student Expense Tracker & Budget Manager for African Leadership University (ALU)',
          start_url: '/',
          scope: '/',
          id: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#ffffff',
          theme_color: '#0f4c3a',
          dir: 'ltr',
          lang: 'en',
          prefer_related_applications: false,
          categories: ['finance', 'education'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          // Never serve a stale app shell: navigations always try the network
          // first and only fall back to the last cached page when offline.
          // index.html is excluded from the precache for the same reason.
          navigateFallback: null,
          globIgnores: ['**/index.html'],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          // Only save the app's basic display files (HTML, JS, CSS, icons, fonts) for faster loading
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
          // Never cache student records, financial information, login details, or API endpoints
          navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
          runtimeCaching: [
            {
              // App pages: network first so a published build appears immediately
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: `app-pages-v${APP_VERSION}`,
                networkTimeoutSeconds: 4,
              },
            },
            {
              // Google Fonts stylesheets (display files)
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: `display-fonts-stylesheets-v${APP_VERSION}`,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Google Fonts webfont files (display files)
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: `display-fonts-webfonts-v${APP_VERSION}`,
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Any backend/auth/financial endpoint is strictly Network-Only and never saved in cache
              urlPattern: ({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'),
              handler: 'NetworkOnly',
              method: 'POST',
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'),
              handler: 'NetworkOnly',
              method: 'GET',
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      port: 3000,
      hmr: true,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
