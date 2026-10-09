import type { BaziChar } from '../data/characters';
import { MAX_LEVEL } from './progress';

/** Сколько ошибок допустимо, чтобы знак был засчитан (обводка и по памяти) */
export const PASS_MISTAKES = 1;

export interface WriteResult {
  char: BaziChar;
  mistakes: number;
  ok: boolean;
}

export const isPass = (mistakes: number) => mistakes <= PASS_MISTAKES;

/**
 * Следующий знак сессии по памяти. Пока есть ещё не показанные в сессии — берём из них,
 * чтобы каждый выпал хотя бы раз; дальше с весом MAX_LEVEL + 1 − уровень (слабые чаще).
 * Один знак не выпадает дважды подряд, если есть из чего выбрать.
 */
export function pickNext(pool: BaziChar[], done: WriteResult[], levelOf: (charId: string) => number): BaziChar {
  const shown = new Set(done.map((r) => r.char.id));
  const fresh = pool.filter((c) => !shown.has(c.id));
  const prevId = done[done.length - 1]?.char.id;
  const base = fresh.length ? fresh : pool;
  const candidates = base.length > 1 ? base.filter((c) => c.id !== prevId) : base;
  const weighted = candidates.map((c) => ({ c, w: MAX_LEVEL + 1 - levelOf(c.id) }));
  let r = Math.random() * weighted.reduce((sum, x) => sum + x.w, 0);
  return (weighted.find((x) => (r -= x.w) < 0) ?? weighted[weighted.length - 1]).c;
}
