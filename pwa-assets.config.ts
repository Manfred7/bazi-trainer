import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Иконки приложения из public/pwa-icon.svg: `npm run icons`
const background = '#B23A2B';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ['public/pwa-icon.svg'],
});
