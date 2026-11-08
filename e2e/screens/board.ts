import { expect, type Page } from '@playwright/test';

type Medians = [number, number][][];

/**
 * Клетка письма и клетка «Какая черта следующая?». Координаты черт отдаёт тестовый мост
 * приложения (window.__bazi, src/logic/e2e.ts); ведём настоящую мышь — так проверяется
 * и обработка ввода Hanzi Writer.
 */
export class Board {
  constructor(private readonly page: Page) {}

  /** Средние линии черт текущей клетки в пикселях окна; ждёт, пока клетка размещена */
  async medians(kind: 'write' | 'order' = 'write'): Promise<Medians> {
    let got: Medians | null = null;
    await expect
      .poll(
        async () => {
          got = await this.page.evaluate((k) => window.__bazi?.strokes(k)?.medians ?? null, kind);
          return !!got && got.flat().some(([x, y]) => x > 0 && y > 0);
        },
        { message: `клетка «${kind}» готова` },
      )
      .toBe(true);
    return got!;
  }

  /** Сколько черт у знака на клетке письма */
  async total() {
    return (await this.medians('write')).length;
  }

  /** Провести черту номер i (с 0) по её средней линии */
  async draw(i: number) {
    const m = (await this.medians('write'))[i];
    await this.page.mouse.move(m[0][0], m[0][1]);
    await this.page.mouse.down();
    // Средние линии и так подробные; каждый подшаг ждёт кадра (~16 мс), лишние только замедляют
    for (const [x, y] of m.slice(1)) await this.page.mouse.move(x, y, { steps: 2 });
    await this.page.mouse.up();
  }

  /** Черты from…to−1 подряд */
  async write(from: number, to: number) {
    for (let i = from; i < to; i++) await this.draw(i);
  }

  /** Знак целиком, все черты по порядку */
  async writeAll() {
    await this.write(0, await this.total());
  }

  /** Нажать черту номер i в вопросе о порядке */
  async tapOrder(i: number) {
    const m = (await this.medians('order'))[i];
    const [x, y] = m[Math.floor(m.length / 2)];
    await this.page.mouse.click(x, y);
  }
}
