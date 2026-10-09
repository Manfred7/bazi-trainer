import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const YEAR = 60 * 60 * 24 * 365

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    react(),
    VitePWA({
      // Новая версия ставится сама при следующем открытии
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Прописи БаЦзы',
        short_name: 'Прописи БаЦзы',
        description: 'Тренажёр написания знаков БаЦзы: 10 небесных стволов и 12 земных ветвей',
        lang: 'ru',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F5F0E6',
        theme_color: '#F5F0E6',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Всё приложение кладётся в кэш при установке — дальше работает без сети
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        runtimeCaching: [
          {
            // Шрифты Google: стили и файлы кэшируются при первом показе
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 200, maxAgeSeconds: YEAR },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // GitHub Pages отдаёт сайт из подпапки /bazi-trainer/ (и vite preview тоже); dev-сервер остаётся в корне
  base: command === 'build' || isPreview ? '/bazi-trainer/' : '/',
}))
