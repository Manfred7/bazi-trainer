import { expect, levelOf, test } from './fixtures';

test('путь с нуля: знакомство с 甲 → две чистые обводки → ступень пройдена, прогресс записан', async ({ page, start, path }) => {
  await start.open();
  await start.startPath();

  await test.step('знакомство', async () => {
    await expect(path.root).toHaveAttribute('data-char', 'stem-jia');
    await expect(path.root).toBeAtStep('intro');
    await path.next();
  });

  await test.step('обводка 1', async () => {
    await expect(path.root).toBeAtStep('trace');
    await path.board.writeAll();
    await expect(path.status).toHaveAttribute('data-state', 'ok');
    await expect.poll(() => levelOf(page, 'stem-jia', 'trace')).toBe(1);
    await path.next();
  });

  await test.step('обводка 2', async () => {
    await expect(path.root).toBeAtStep('trace');
    await expect(path.root).toHaveAttribute('data-char', 'stem-jia');
    await path.board.writeAll();
    await expect(path.status).toHaveAttribute('data-state', 'ok');
    await expect.poll(() => levelOf(page, 'stem-jia', 'trace')).toBe(2);
  });

  // Две чистые обводки — ступень пройдена: следующая ступень 甲 — полуконтур
  await expect(page.locator('.move--up')).toBeVisible();
  await path.exit();
  await expect(start.root).toBeVisible();
  await expect(page.locator('main[data-screen="start"]')).toContainText('Полуконтур');
});

test('ошибки на обводке: шаг не засчитан, уровень обводки — 0', async ({ page, start, path }) => {
  await start.open();
  await start.startPath();
  await path.next();
  await expect(path.root).toBeAtStep('trace');
  await path.board.draw(4);
  await path.board.draw(4);
  await path.board.writeAll();
  await expect(path.status).toHaveAttribute('data-state', 'fail');
  await expect.poll(() => levelOf(page, 'stem-jia', 'trace')).toBe(0);
});
