import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Иконки приложения из public/pwa-icon.svg: `npm run icons`
// Ночное небо: на иконке 天干 — «небесные стволы», как домен tiangan.ru — в строку (scripts/build-icon.mjs)
const background = '#2E3A66';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Поля уже заложены в pwa-icon.svg (знаки в безопасной зоне), лишние отступы генератора делают их мелкими
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/pwa-icon.svg'],
});
