import { expect, readProgress, test } from './fixtures';

test('«Узнавание» по стволам: неверный ответ — разбор и «Дальше», верные — сами дальше; итог и прогресс', async ({
  page,
  start,
}) => {
  await start.open();
  await start.startFree('quiz', { deck: 'stems', length: 10 });
  const quiz = page.locator('main[data-screen="quiz"]');

  /** Текущий вопрос показан: предыдущий ответ учтён (после верного новый вопрос приходит сам) */
  const question = async (done: number) => {
    await expect(quiz).toHaveAttribute('data-done', String(done));
    await expect(quiz).toHaveAttribute('data-revealed', 'false');
    return (await quiz.getAttribute('data-answer'))!;
  };

  await test.step('вопрос 1 — нарочно неверно: разбор и «Дальше»', async () => {
    const answer = await question(0);
    await quiz.locator(`[data-option]:not([data-option="${answer}"])`).first().click();
    await expect(quiz).toHaveAttribute('data-revealed', 'true');
    await page.getByTestId('next').click();
  });

  for (let i = 1; i < 10; i++) {
    await test.step(`вопрос ${i + 1} — верно`, async () => {
      const answer = await question(i);
      await quiz.locator(`[data-option="${answer}"]`).click();
    });
  }

  const result = page.locator('main[data-screen="result"]');
  await expect(result).toBeVisible();
  await expect(result.locator('.result__pct')).toHaveText('9/10');
  const progress = await readProgress(page);
  expect(Object.keys(progress?.pairs ?? {}).some((k) => k.includes(':quiz:'))).toBe(true);
});

test('«По памяти» по стволам, 5 знаков без ошибок → 5/5', async ({ page, start, board }) => {
  await start.open();
  await start.startFree('recall', { deck: 'stems', length: 5 });
  const recall = page.locator('main[data-screen="recall"]');

  for (let i = 0; i < 5; i++) {
    await test.step(`знак ${i + 1}`, async () => {
      await expect(recall).toBeVisible();
      await board.writeAll();
      const next = page.getByTestId('next');
      await expect(next).toBeEnabled();
      await next.click();
    });
  }
  await expect(page.locator('main[data-screen="result"] .result__pct')).toHaveText('5/5');
});
