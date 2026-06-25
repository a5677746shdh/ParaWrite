import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'ParaWrite',
        short_name: 'ParaWrite',
        description: 'LLM-powered translation with DeepL-style alternatives',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['standalone', 'window-controls-overlay'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: '/screenshots/desktop-layout.jpg',
            sizes: '2702x1713',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Desktop layout with word panel',
          },
          {
            src: '/screenshots/tablet-layout.jpg',
            sizes: '2212x1638',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Tablet two-column layout',
          },
          {
            src: '/screenshots/main-interface.jpg',
            sizes: '1024x1457',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Main translation interface',
          },
          {
            src: '/screenshots/mobile-layout.jpg',
            sizes: '938x2027',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Mobile stacked layout',
          },
          {
            src: '/screenshots/login-dialog.jpg',
            sizes: '994x1087',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'User login dialog',
          },
          {
            src: '/screenshots/synonyms-panel.jpg',
            sizes: '1768x1590',
            type: 'image/jpeg',
            form_factor: 'wide',
            label: 'Synonyms and alternatives panel',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/.well-known/assetlinks.json': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
