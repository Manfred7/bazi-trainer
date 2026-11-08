import { defineConfig, devices } from '@playwright/test';

// Тесты экранов (e2e/*.e2e.ts): собранное приложение из корня сайта, как на tiangan.ru, с service worker.
// Запуск: npm run e2e (отчёт — npm run e2e:report). Логика без браузера — npm test (vitest).
const PORT = 4176;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices['Pixel 7'],
    // Полный Chromium: облегчённой headless-оболочки в кэше Playwright может не быть
    channel: 'chromium',
    baseURL: `http://127.0.0.1:${PORT}`,
    // Детерминизм: язык, часовой пояс, тема, без анимаций интерфейса
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    // Пальцем рисуем мышью: Hanzi Writer слушает и mouse-, и touch-события; касания проверяются отдельно
    hasTouch: false,
    isMobile: false,
    // Service worker по умолчанию выключен: кэш и автообновление не мешают изоляции тестов.
    // Офлайн и PWA — отдельные тесты с тегом @offline и test.use({ serviceWorkers: 'allow' })
    serviceWorkers: 'block',
    trace: 'retain-on-failure-and-retries',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort --host 127.0.0.1`,
    env: { BASE_PATH: '/' },
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
