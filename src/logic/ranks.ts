import { CHARACTERS } from '../data/characters';
import { STAGES, stageIndex, stageOf } from './path';
import type { Progress } from './progress';

/**
 * Звания ученика. Растут от двух вещей: пройденных ступеней пути (у 22 знаков по 6 ступеней — всего 132)
 * и дней, когда столп дня записан в тетрадь. Гранд мастер — все знаки освоены, столп дня записан
 * 60 дней (полный цикл 甲子 … 癸亥) и знаки пишутся связками: дни с чистой цепочкой из четырёх столпов.
 * Полученное звание не отнимается, даже если знак спустился на ступень.
 */
export interface Rank {
  id: string;
  title: string;
  /** Пройденных ступеней всего */
  steps: number;
  /** Дней со столпом дня */
  days: number;
  /** Дней с чистой цепочкой столпов */
  chains: number;
}

export const MAX_STEPS = CHARACTERS.length * STAGES.length;

export const RANKS: Rank[] = [
  { id: 'novice', title: 'Новичок', steps: 0, days: 0, chains: 0 },
  { id: 'amateur', title: 'Любитель', steps: 10, days: 0, chains: 0 },
  { id: 'adept', title: 'Адепт', steps: 35, days: 3, chains: 0 },
  { id: 'master', title: 'Мастер', steps: 70, days: 10, chains: 0 },
  { id: 'magister', title: 'Магистр', steps: 110, days: 30, chains: 0 },
  { id: 'grandmaster', title: 'Гранд мастер', steps: MAX_STEPS, days: 60, chains: 12 },
];

/** Сколько ступеней пути пройдено всеми знаками */
export const pathSteps = (p: Progress) => CHARACTERS.reduce((sum, c) => sum + stageIndex(stageOf(p, c.id)), 0);

const reached = (r: Rank, steps: number, days: number, chains: number) => steps >= r.steps && days >= r.days && chains >= r.chains;

/** Номер звания по ступеням, дням столпа и дням цепочек, не ниже уже полученного best */
export function rankIndex(steps: number, days: number, best = 0, chains = 0): number {
  let i = 0;
  while (i + 1 < RANKS.length && reached(RANKS[i + 1], steps, days, chains)) i++;
  return Math.max(i, Math.min(best, RANKS.length - 1));
}

export interface RankProgress {
  rank: Rank;
  index: number;
  next?: Rank;
  /** Доля пути к следующему званию, 0…1: среднее по ступеням, дням и цепочкам (если они нужны) */
  share: number;
  steps: number;
  days: number;
  chains: number;
}

export function rankProgress(p: Progress, days: number, best = 0, chains = 0): RankProgress {
  const steps = pathSteps(p);
  const index = rankIndex(steps, days, best, chains);
  const rank = RANKS[index];
  const next = RANKS[index + 1];
  if (!next) return { rank, index, share: 1, steps, days, chains };
  // Доля считается от порога текущего звания, но не меньше нуля: звание могло остаться после спуска знаков
  const part = (have: number, from: number, to: number) => (to <= from ? 1 : Math.min(1, Math.max(0, (have - from) / (to - from))));
  const parts = [part(steps, rank.steps, next.steps)];
  if (next.days > 0) parts.push(part(days, rank.days, next.days));
  if (next.chains > 0) parts.push(part(chains, rank.chains, next.chains));
  return { rank, index, next, share: parts.reduce((a, b) => a + b, 0) / parts.length, steps, days, chains };
}
