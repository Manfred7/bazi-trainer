import { expect as base, type Locator } from '@playwright/test';

/**
 * Матчеры экранов с шагами (прогон знака, путь). Состояние экрана — атрибуты data-* на <main>:
 * data-step (data-stage у пути), data-result (pending · ok · fail), data-try.
 * Оба матчера ждут (web-first), как toHaveAttribute.
 */
async function attr(locator: Locator, name: string, value: string, timeout?: number) {
  try {
    await base(locator).toHaveAttribute(name, value, { timeout });
    return { pass: true, message: () => `${name} = ${value}` };
  } catch {
    const got = await locator.getAttribute(name).catch(() => null);
    return { pass: false, message: () => `ожидался ${name}="${value}", на экране "${got}"` };
  }
}

export const expect = base.extend({
  /** Экран на шаге: прогон знака — data-step, путь — data-stage */
  async toBeAtStep(locator: Locator, step: string, options?: { timeout?: number }) {
    const name = (await locator.getAttribute('data-stage').catch(() => null)) !== null ? 'data-stage' : 'data-step';
    return attr(locator, name, step, options?.timeout);
  },
  /** Итог текущей попытки шага: pending · ok · fail */
  async toHaveResult(locator: Locator, result: 'pending' | 'ok' | 'fail', options?: { timeout?: number }) {
    return attr(locator, 'data-result', result, options?.timeout);
  },
});
