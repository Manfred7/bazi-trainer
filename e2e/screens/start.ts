import { expect, type Locator, type Page } from '@playwright/test';

export type Mode = 'study' | 'trace' | 'recall' | 'quiz';

/** Стартовый экран: путь, свободная практика, навигация, тема */
export class StartScreen {
  readonly root: Locator;
  readonly free: Locator;

  /** Окно «Новое звание» — появляется само, когда прогресс поднимает звание (например, засеянный) */
  readonly rankUp: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('main[data-screen="start"]');
    this.free = page.getByTestId('free');
    this.rankUp = page.getByRole('dialog').filter({ hasText: 'Новое звание' });
  }

  /** Закрывать окно нового звания, если оно перекрывает экран перед действием теста */
  async dismissRankUp() {
    await this.page.addLocatorHandler(this.rankUp, async (dialog) => {
      await dialog.getByRole('button', { name: 'Продолжить' }).click();
    });
  }

  async open() {
    await this.page.goto('/');
    await expect(this.root).toBeVisible();
  }

  /** Развернуть «Свободную практику» (если свёрнута) */
  async openFree() {
    await expect(this.free).toBeVisible();
    if ((await this.free.getAttribute('open')) === null) await this.free.locator('summary').click();
    await expect(this.free).toHaveAttribute('open', '');
  }

  /** «Один знак — все шаги»: знак по id, например stem-geng */
  async pickDrill(charId: string) {
    await this.openFree();
    await this.free.locator(`[data-char="${charId}"]`).click();
  }

  /** Свободная практика: режим, колода, длина — и старт */
  async startFree(mode: Mode, opts: { deck?: string; length?: number } = {}) {
    await this.openFree();
    await this.free.locator(`[data-mode="${mode}"]`).click();
    if (opts.deck) await this.free.locator(`[data-deck="${opts.deck}"]`).click();
    if (opts.length) await this.free.locator(`[data-length="${opts.length}"], [data-quiz-length="${opts.length}"]`).click();
    await this.page.getByTestId('free-start').click();
  }

  async startPath() {
    await this.page.getByTestId('path-start').click();
  }

  async theme(option: 'system' | 'light' | 'dark') {
    await this.page.locator(`[data-theme-option="${option}"]`).click();
  }
}
