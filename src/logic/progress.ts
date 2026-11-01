import type { BaziChar } from '../data/characters';

/** Уровни Лейтнера: 0 — не знаю, 5 — знаю твёрдо */
export const MAX_LEVEL = 5;
/** С этого уровня пара (знак × режим) считается освоенной */
export const MASTERED_LEVEL = 3;
/** Доля освоенных знаков, при которой открывается следующая колода */
export const UNLOCK_SHARE = 0.8;

/**
 * По чему ведётся прогресс: знакомство, письмо (обводка, полуконтур, точки, «взгляни и напиши», по памяти),
 * тетрадь, вопросы «какая черта следующая?» и каждое направление узнавания
 */
export type Track = 'study' | 'trace' | 'half' | 'dots' | 'glance' | 'recall' | 'paper' | 'order' | `quiz:${string}`;

export interface PairStats {
  level: number;
  seen: number;
  correct: number;
  /** Интервальное повторение (только «по памяти»): через сколько дней повторить и когда (мс) */
  interval?: number;
  due?: number;
}

const DAY_MS = 86_400_000;
/** Интервал повторения растёт так после верного ответа в срок: 1 → 3 → 8 → 20 → 50 → 60 дней */
const GROWTH = 2.5;
const MAX_INTERVAL = 60;

/** Следующий интервал после верного ответа, в днях */
export const nextInterval = (prev?: number) => (prev ? Math.min(MAX_INTERVAL, Math.round(prev * GROWTH)) : 1);

/** Когда знак ждёт повторения по памяти (мс); без истории — уже ждёт */
export const dueOf = (p: Progress, charId: string) => p.pairs[pairKey(charId, 'recall')]?.due ?? 0;

export interface Progress {
  pairs: Record<string, PairStats>;
  /** Колоды, открытые по порогу; раз открытая колода больше не закрывается */
  unlocked: string[];
}

export const EMPTY_PROGRESS: Progress = { pairs: {}, unlocked: [] };

const pairKey = (charId: string, track: Track) => `${charId}:${track}`;

export const levelOf = (p: Progress, charId: string, track: Track) => p.pairs[pairKey(charId, track)]?.level ?? 0;

/**
 * Верно — уровень растёт на 1, ошибка — пара возвращается на 0. У «по памяти» ещё и срок повторения:
 * верно — интервал растёт, ошибка — повторить сегодня же и начать интервалы заново
 */
export function recordResult(p: Progress, charId: string, track: Track, ok: boolean, now = Date.now()): Progress {
  const key = pairKey(charId, track);
  const prev = p.pairs[key] ?? { level: 0, seen: 0, correct: 0 };
  const next: PairStats = {
    level: ok ? Math.min(MAX_LEVEL, prev.level + 1) : 0,
    seen: prev.seen + 1,
    correct: prev.correct + (ok ? 1 : 0),
  };
  if (track === 'recall') {
    // Интервал растёт, только если повторили в срок: несколько верных раз за один вечер его не разгоняют
    const onTime = !prev.due || now >= prev.due - DAY_MS / 2;
    next.interval = !ok ? 0 : onTime ? nextInterval(prev.interval) : Math.max(1, prev.interval ?? 1);
    next.due = now + next.interval * DAY_MS;
  }
  return { ...p, pairs: { ...p.pairs, [key]: next } };
}

/** Уровень пары не выше max: так снимается засчитанная ступень пути */
export function capLevel(p: Progress, charId: string, track: Track, max: number): Progress {
  const key = pairKey(charId, track);
  const prev = p.pairs[key];
  if (!prev || prev.level <= max) return p;
  return { ...p, pairs: { ...p.pairs, [key]: { ...prev, level: max } } };
}

/** Уровень пары не ниже min: ступени до текущей считаются пройденными */
export function floorLevel(p: Progress, charId: string, track: Track, min: number): Progress {
  const key = pairKey(charId, track);
  const prev = p.pairs[key] ?? { level: 0, seen: 0, correct: 0 };
  if (prev.level >= min) return p;
  return { ...p, pairs: { ...p.pairs, [key]: { ...prev, level: min } } };
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
