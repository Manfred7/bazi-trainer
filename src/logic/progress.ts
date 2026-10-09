import type { BaziChar } from '../data/characters';

/** Уровни Лейтнера: 0 — не знаю, 5 — знаю твёрдо */
export const MAX_LEVEL = 5;
/** С этого уровня пара (знак × режим) считается освоенной */
export const MASTERED_LEVEL = 3;
/** Доля освоенных знаков, при которой открывается следующая колода */
export const UNLOCK_SHARE = 0.8;

/** Режимы с проверкой, по которым ведётся прогресс */
export type Track = 'trace' | 'recall';

export interface PairStats {
  level: number;
  seen: number;
  correct: number;
}

export interface Progress {
  pairs: Record<string, PairStats>;
  /** Колоды, открытые по порогу; раз открытая колода больше не закрывается */
  unlocked: string[];
}

export const EMPTY_PROGRESS: Progress = { pairs: {}, unlocked: [] };

const pairKey = (charId: string, track: Track) => `${charId}:${track}`;

export const levelOf = (p: Progress, charId: string, track: Track) => p.pairs[pairKey(charId, track)]?.level ?? 0;

/** Верно — уровень растёт на 1, ошибка — пара возвращается на 0 */
export function recordResult(p: Progress, charId: string, track: Track, ok: boolean): Progress {
  const key = pairKey(charId, track);
  const prev = p.pairs[key] ?? { level: 0, seen: 0, correct: 0 };
  const next: PairStats = {
    level: ok ? Math.min(MAX_LEVEL, prev.level + 1) : 0,
    seen: prev.seen + 1,
    correct: prev.correct + (ok ? 1 : 0),
  };
  return { ...p, pairs: { ...p.pairs, [key]: next } };
}

/** Доля освоенных знаков колоды в режиме, 0…1 */
export function mastery(p: Progress, chars: BaziChar[], track: Track): number {
  if (!chars.length) return 0;
  return chars.filter((c) => levelOf(p, c.id, track) >= MASTERED_LEVEL).length / chars.length;
}

const KEY = 'bazi-trainer:progress';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      pairs: parsed.pairs && typeof parsed.pairs === 'object' ? parsed.pairs : {},
      unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // хранилище недоступно — прогресс живёт до перезагрузки
  }
}
