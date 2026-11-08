import { expect, progressOf, test } from './fixtures';

test('стартовый экран и вспомогательные экраны открываются без ошибок и возвращают на старт', async ({ page, start }) => {
  await start.open();
  for (const [button, screen] of [
    ['charts', 'charts'],
    ['cycle', 'cycle'],
    ['stats', 'stats'],
    ['history', 'history'],
  ] as const) {
    await test.step(screen, async () => {
      await page.getByTestId(button).click();
      await expect(page.locator(`main[data-screen="${screen}"]`)).toBeVisible();
      await page.getByRole('button', { name: 'В меню' }).click();
      await expect(start.root).toBeVisible();
    });
  }
});

test('тема: «Тёмная» сразу и после перезагрузки, «Светлая» обратно', async ({ page, start }) => {
  await start.open();
  const html = page.locator('html');
  await start.theme('dark');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await start.theme('light');
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test.describe('засеянный прогресс', () => {
  // 8 из 10 стволов освоены по памяти — колода «Земные ветви» по памяти доступна
  test.use({
    storage: {
      progress: progressOf(
        Object.fromEntries(['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin'].map((id) => [`stem-${id}:recall`, 3])),
        ['branches'],
      ),
    },
  });

  test('засев доходит до приложения: новое звание, ветви по памяти открыты, засев не затирается перезагрузкой', async ({
    page,
    start,
  }) => {
    await start.open();
    // 8 стволов на «Тетради» поднимают звание — приложение показывает окно
    await expect(start.rankUp).toContainText('Любитель');
    await start.dismissRankUp();
    await start.openFree();
    await start.free.locator('[data-mode="recall"]').click();
    await expect(start.free.locator('[data-deck="branches"]')).toBeEnabled();
    await page.reload();
    await start.openFree();
    await expect(start.free.locator('[data-deck="branches"]')).toBeEnabled();
  });
});

test.describe('PWA @offline', () => {
  test.use({ serviceWorkers: 'allow' });

  test('после первой загрузки приложение открывается без сети', async ({ page, context, start }) => {
    await start.open();
    // Service worker установлен и управляет страницей (после установки — со следующей загрузки)
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(start.root).toBeVisible();
    await start.pickDrill('stem-jia');
    await expect(page.locator('main[data-screen="drill"]')).toBeVisible();
  });
});
