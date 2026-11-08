import { expect, type Locator, type Page } from '@playwright/test';
import { Board } from './board';

/**
 * Экран с шагами письма — прогон одного знака (data-screen="drill") и путь знака ("path").
 * Состояние — data-* на <main>; статус шага — [data-testid=step-status] (writing · peek · ok · fail · asking · done).
 */
export class StepsScreen {
  readonly root: Locator;
  readonly status: Locator;
  readonly board: Board;

  constructor(
    private readonly page: Page,
    screen: 'drill' | 'path',
  ) {
    this.root = page.locator(`main[data-screen="${screen}"]`);
    this.status = page.getByTestId('step-status');
    this.board = new Board(page);
  }

  next() {
    return this.page.getByTestId('next').click();
  }

  retry() {
    return this.page.getByTestId('retry-step').click();
  }

  exit() {
    return this.page.getByTestId('exit').click();
  }

  /**
   * «Какая черта следующая?»: отвечаем верно, пока вопросы не кончатся. Следующая черта = сколько уже
   * написано; после каждого ответа ждём, что счётчик вырос. Не больше, чем черт у знака.
   */
  async answerOrder() {
    const order = this.page.getByTestId('order-board');
    const total = (await this.board.medians('order')).length;
    for (let i = 0; i < total; i++) {
      if ((await this.status.getAttribute('data-state')) !== 'asking') return;
      const written = Number(await order.getAttribute('data-written'));
      await this.board.tapOrder(written);
      await expect(order).not.toHaveAttribute('data-written', String(written));
    }
  }

  /** «Взгляни и напиши»: знак виден PEEK_MS и исчезает — дальше пишем */
  async waitPeekOver() {
    await expect(this.status).toHaveAttribute('data-state', 'writing', { timeout: PEEK_WAIT_MS });
  }

  /** Шаг письма чисто: дождаться шага, на «Взгляни» — конца показа, написать знак, засчитано → «Дальше» */
  async passWriteStep(step: string, attr: 'data-step' | 'data-stage' = 'data-step') {
    await expect(this.root).toHaveAttribute(attr, step);
    if (step === 'glance') await this.waitPeekOver();
    await this.board.writeAll();
    await expect(this.root).toHaveAttribute('data-result', 'ok');
    await this.next();
  }
}

/**
 * Сколько ждать конца показа на «Взгляни и напиши»: знак виден до 3 с (GLANCE_FIRST_MS
 * в src/components/PathSteps.tsx) плюс запас на анимацию появления и медленную машину
 */
const PEEK_WAIT_MS = 10_000;
