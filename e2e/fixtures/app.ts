import { test as base } from '@playwright/test';
import { KEYS, type SeedStorage } from '../support/data';
import { initPage } from '../support/seed';

const EXTERNAL_FONTS = /fonts\.(googleapis|gstatic)\.com/;

type AppFixtures = {
  /** Зерно Math.random; test.use({ seed }) */
  seed: number;
  /** localStorage до первой загрузки; test.use({ storage }) */
  storage: SeedStorage;
  /** Ошибки страницы за тест (автофикстура): в конце теста их должно быть ноль */
  pageErrors: string[];
};

/**
 * Приложение под тестом:
 * - засев localStorage через storageState — применяется при создании контекста, перезагрузки его не затирают;
 * - тестовый мост и Math.random с зерном — до скриптов страницы;
 * - внешние шрифты отрезаны на уровне контекста (запросы service worker видит только контекст);
 * - ошибки страницы, упавшие запросы и ответы ≥ 400 (в том числе service worker) — провал теста;
 *   console.error — во вложение отчёта.
 */
export const test = base.extend<AppFixtures>({
  seed: [42, { option: true }],
  storage: [{}, { option: true }],

  storageState: async ({ storage, baseURL }, use) => {
    const localStorage = [
      ...(storage.progress ? [{ name: KEYS.progress, value: JSON.stringify(storage.progress) }] : []),
      ...(storage.settings ? [{ name: KEYS.settings, value: JSON.stringify(storage.settings) }] : []),
    ];
    await use({ cookies: [], origins: localStorage.length ? [{ origin: baseURL!, localStorage }] : [] });
  },

  context: async ({ context, seed }, use) => {
    await context.route(EXTERNAL_FONTS, (r) => r.abort());
    await context.addInitScript(initPage, seed);
    await use(context);
  },

  pageErrors: [
    async ({ context, page }, use, testInfo) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      context.on('requestfailed', (r) => {
        if (!EXTERNAL_FONTS.test(r.url())) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`);
      });
      context.on('response', (r) => {
        if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
      });
      page.on('console', (m) => {
        if (m.type() === 'error' && !EXTERNAL_FONTS.test(m.text())) warnings.push(m.text());
      });
      await use(errors);
      if (warnings.length) await testInfo.attach('console.error', { body: warnings.join('\n'), contentType: 'text/plain' });
      if (errors.length) throw new Error(`Ошибки страницы за тест:\n${errors.join('\n')}`);
    },
    { auto: true, box: true },
  ],
});
