import type { Page } from '@playwright/test';

/** Ключи localStorage приложения */
export const KEYS = {
  progress: 'bazi-trainer:progress',
  settings: 'bazi-trainer:settings',
} as const;

/** Что положить в localStorage до первой загрузки (test.use({ storage })) */
export interface SeedStorage {
  progress?: unknown;
  settings?: Record<string, unknown>;
}

/** Прогресс: { 'stem-jia:trace': 2, … } → формат приложения */
export function progressOf(levels: Record<string, number>, unlocked: string[] = []) {
  const pairs = Object.fromEntries(
    Object.entries(levels).map(([key, level]) => [key, { level, seen: level, correct: level }]),
  );
  return { pairs, unlocked };
}

export async function readProgress(page: Page): Promise<{ pairs: Record<string, { level: number }>; unlocked: string[] } | null> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), KEYS.progress);
  return raw ? JSON.parse(raw) : null;
}

/** Уровень пары «знак × дорожка» (0, если пары ещё нет) */
export async function levelOf(page: Page, charId: string, track: string) {
  return (await readProgress(page))?.pairs[`${charId}:${track}`]?.level ?? 0;
}
