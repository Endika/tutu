/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/tutu/',
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tutu',
        short_name: 'Tutu',
        description: 'A relaxing toy-car sliding puzzle game',
        theme_color: '#b9763a',
        background_color: '#e9d9bd',
        display: 'standalone',
        start_url: '/tutu/',
        scope: '/tutu/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB — covers Three.js bundle
      },
    }),
  ],
  build: { sourcemap: true, target: 'es2022' },
  test: {
    environment: 'jsdom',
  },
})
