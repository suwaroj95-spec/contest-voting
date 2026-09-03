import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/contest-voting/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['festival-icon.svg'],
      manifest: {
        name: 'Contest Voting',
        short_name: 'Voting',
        description: 'Offline-first iPad voting app for a music festival contest.',
        theme_color: '#151026',
        background_color: '#151026',
        display: 'standalone',
        orientation: 'landscape',
        scope: '/contest-voting/',
        start_url: '/contest-voting/',
        icons: [
          {
            src: 'festival-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/contest-voting/index.html'
      }
    })
  ]
});
