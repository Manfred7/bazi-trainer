import { expect, readProgress, test } from './fixtures';
import type { StartScreen } from './screens/start';
import type { StepsScreen } from './screens/steps';

/** Свободная практика → «Один знак — все шаги» → знак */
async function begin(start: StartScreen, drill: StepsScreen, charId: string) {
  await start.open();
  await start.pickDrill(charId);
  await expect(drill.root).toHaveAttribute('data-char', charId);
  await expect(drill.root).toBeAtStep('intro');
}

/** Знак чисто по всем шагам письма (после знакомства и вопроса о порядке) */
async function writeStepsClean(drill: StepsScreen, steps: string[]) {
  for (const step of steps) await test.step(step, () => drill.passWriteStep(step));
}

test('庚: все шаги, ошибки на полуконтуре → повтор шага → итог; прогресс пути не тронут', async ({ page, start, drill }) => {
  await begin(start, drill, 'stem-geng');
  const before = await readProgress(page);

  await test.step('знакомство', () => drill.next());

  await test.step('какая черта следующая', async () => {
    await expect(drill.root).toBeAtStep('order');
    await drill.answerOrder();
    await expect(drill.status).toHaveAttribute('data-mistakes', '0');
    await expect(drill.root).toHaveResult('ok');
    await drill.next();
  });

  await writeStepsClean(drill, ['trace']);

  await test.step('полуконтур: две ошибки — не засчитан, повтор — чисто', async () => {
    await expect(drill.root).toBeAtStep('half');
    await drill.board.draw(7);
    await drill.board.draw(7);
    await drill.board.writeAll();
    await expect(drill.root).toHaveResult('fail');
    await expect(page.getByTestId('next')).toHaveCount(0);
    await drill.retry();
    await expect(drill.root).toHaveAttribute('data-try', '2');
    await drill.board.writeAll();
    await expect(drill.root).toHaveResult('ok');
    await drill.next();
  });

  await writeStepsClean(drill, ['glance']);

  await test.step('финал: одна ошибка ещё засчитывается', async () => {
    await expect(drill.root).toBeAtStep('recall');
    await drill.board.draw(5);
    await drill.board.writeAll();
    await expect(drill.root).toHaveResult('ok');
    await expect(drill.status).toHaveAttribute('data-mistakes', '1');
    await drill.next();
  });

  await test.step('итог по шагам', async () => {
    const result = page.locator('main[data-screen="drill-result"]');
    await expect(result.locator('[data-step="half"]')).toHaveAttribute('data-tries', '2,0');
    await expect(result.locator('[data-step="trace"]')).toHaveAttribute('data-tries', '0');
    await expect(result.locator('[data-step="recall"]')).toHaveAttribute('data-tries', '1');
    await expect(page.getByTestId('drill-summary')).toContainText('с первого раза — 5 из 6');
  });

  expect(await readProgress(page)).toEqual(before);
});

test('отрицательный контроль: без рисования шаг не засчитан; ошибки сверх одной — не засчитан, нужен повтор', async ({
  page,
  start,
  drill,
}) => {
  await begin(start, drill, 'stem-jia');
  await drill.next();
  await drill.answerOrder();
  await drill.next();
  await expect(drill.root).toBeAtStep('trace');

  // Клетка готова, но ничего не нарисовано: шаг не засчитан и «Дальше» недоступна
  await drill.board.total();
  await expect(drill.root).toHaveResult('pending');
  await expect(page.getByTestId('next')).toBeDisabled();

  await drill.board.draw(4);
  await drill.board.draw(4);
  await drill.board.writeAll();
  await expect(drill.root).toHaveResult('fail');
  await expect(page.getByTestId('retry-step')).toBeVisible();
  await expect(drill.root).toBeAtStep('trace');
});

test('乙 (одна черта): вопроса о порядке нет, после знакомства сразу обводка', async ({ start, drill }) => {
  await begin(start, drill, 'stem-yi');
  await drill.next();
  await expect(drill.root).toBeAtStep('trace');
});

test('итоги: «Этот знак ещё раз» — тот же знак сначала; «Другой знак» — выбор; выход — старт', async ({ page, start, drill }) => {
  await begin(start, drill, 'stem-yi');
  await drill.next();
  await writeStepsClean(drill, ['trace', 'half', 'glance', 'recall']);
  await expect(page.getByTestId('drill-summary')).toContainText('каждый с первого раза');

  await page.getByTestId('drill-again').click();
  await expect(drill.root).toHaveAttribute('data-char', 'stem-yi');
  await expect(drill.root).toBeAtStep('intro');
  await expect(drill.root).toHaveAttribute('data-try', '1');

  // Чтобы дойти до «Другой знак», снова чисто до итогов
  await drill.next();
  await writeStepsClean(drill, ['trace', 'half', 'glance', 'recall']);
  await page.getByTestId('drill-other').click();
  await expect(page.locator('main[data-screen="drill-pick"]')).toBeVisible();
  await page.locator('[data-char="branch-zi"]').click();
  await expect(drill.root).toHaveAttribute('data-char', 'branch-zi');
  await expect(drill.root).toBeAtStep('intro');

  await drill.exit();
  await expect(start.root).toBeVisible();
});
