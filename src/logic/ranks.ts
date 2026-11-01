import { CHARACTERS } from '../data/characters';
import { STAGES, stageIndex, stageOf } from './path';
import type { Progress } from './progress';

/**
 * Звания ученика. Растут от двух вещей: пройденных ступеней пути (у 22 знаков по 5 ступеней — всего 110)
 * и дней, когда столп дня записан в тетрадь. Гранд мастер — все знаки освоены и столп дня записан
 * 60 дней: полный цикл 甲子 … 癸亥. Полученное звание не отнимается, даже если знак спустился на ступень.
 */
export interface Rank {
  id: string;
  title: string;
  /** Пройденных ступеней всего */
  steps: number;
  /** Дней со столпом дня */
  days: number;
}

export const MAX_STEPS = CHARACTERS.length * STAGES.length;

export const RANKS: Rank[] = [
  { id: 'novice', title: 'Новичок', steps: 0, days: 0 },
  { id: 'amateur', title: 'Любитель', steps: 10, days: 0 },
  { id: 'adept', title: 'Адепт', steps: 30, days: 3 },
  { id: 'master', title: 'Мастер', steps: 55, days: 10 },
  { id: 'magister', title: 'Магистр', steps: 85, days: 30 },
  { id: 'grandmaster', title: 'Гранд мастер', steps: MAX_STEPS, days: 60 },
];

/** Сколько ступеней пути пройдено всеми знаками */
export const pathSteps = (p: Progress) => CHARACTERS.reduce((sum, c) => sum + stageIndex(stageOf(p, c.id)), 0);

const reached = (r: Rank, steps: number, days: number) => steps >= r.steps && days >= r.days;

/** Номер звания по ступеням и дням, не ниже уже полученного best */
export function rankIndex(steps: number, days: number, best = 0): number {
  let i = 0;
  while (i + 1 < RANKS.length && reached(RANKS[i + 1], steps, days)) i++;
  return Math.max(i, Math.min(best, RANKS.length - 1));
}

export interface RankProgress {
  rank: Rank;
  index: number;
  next?: Rank;
  /** Доля пути к следующему званию, 0…1: среднее по ступеням и дням (если дни нужны) */
  share: number;
  steps: number;
  days: number;
}

export function rankProgress(p: Progress, days: number, best = 0): RankProgress {
  const steps = pathSteps(p);
  const index = rankIndex(steps, days, best);
  const rank = RANKS[index];
  const next = RANKS[index + 1];
  if (!next) return { rank, index, share: 1, steps, days };
  // Доля считается от порога текущего звания, но не меньше нуля: звание могло остаться после спуска знаков
  const part = (have: number, from: number, to: number) => (to <= from ? 1 : Math.min(1, Math.max(0, (have - from) / (to - from))));
  const parts = [part(steps, rank.steps, next.steps)];
  if (next.days > 0) parts.push(part(days, rank.days, next.days));
  return { rank, index, next, share: parts.reduce((a, b) => a + b, 0) / parts.length, steps, days };
}
