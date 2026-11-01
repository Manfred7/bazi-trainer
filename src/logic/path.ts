import { type BaziChar, CHARACTERS } from '../data/characters';
import { MASTERED_LEVEL, type Progress, type Track, capLevel, floorLevel, levelOf, recordResult } from './progress';

/**
 * Путь знака: каждый знак проходит ступени от знакомства до письма в тетради.
 * Ступень засчитана, когда её уровень дошёл до need (столько верных раз подряд).
 * Пройденной считается и ступень, за которой есть засчитанная, — так старый прогресс
 * обводки и письма по памяти сразу продвигает знак по пути.
 */
export type Stage = 'intro' | 'trace' | 'half' | 'dots' | 'recall' | 'paper' | 'done';

export interface StageInfo {
  id: Exclude<Stage, 'done'>;
  label: string;
  track: Track;
  need: number;
}

export const STAGES: StageInfo[] = [
  { id: 'intro', label: 'Знакомство', track: 'study', need: 1 },
  { id: 'trace', label: 'Обводка', track: 'trace', need: 2 },
  { id: 'half', label: 'Полуконтур', track: 'half', need: 2 },
  // Ступень «Точки» пока выключена: визуально получилось слишком сложно. Подсказки для неё
  // (номера вдоль черт, изломы, «откуда и куда») остаются в StrokeGuide — вернуть можно этой строкой:
  // { id: 'dots', label: 'Точки', track: 'dots', need: 2 },
  { id: 'recall', label: 'По памяти', track: 'recall', need: MASTERED_LEVEL },
  { id: 'paper', label: 'Тетрадь', track: 'paper', need: 2 },
];

export const STAGE_LABEL: Record<Stage, string> = {
  ...(Object.fromEntries(STAGES.map((s) => [s.id, s.label])) as Record<StageInfo['id'], string>),
  dots: 'Точки',
  done: 'Освоен',
};

export const stageInfo = (stage: Stage) => STAGES.find((s) => s.id === stage);
export const stageIndex = (stage: Stage) => (stage === 'done' ? STAGES.length : STAGES.findIndex((s) => s.id === stage));

const met = (p: Progress, charId: string, s: StageInfo) => levelOf(p, charId, s.track) >= s.need;

/** Текущая ступень знака: первая после последней засчитанной */
export function stageOf(p: Progress, charId: string): Stage {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (met(p, charId, STAGES[i])) return i + 1 < STAGES.length ? STAGES[i + 1].id : 'done';
  }
  return STAGES[0].id;
}

/** Сколько верных раз подряд на текущей ступени из скольких нужно */
export function stageSteps(p: Progress, charId: string, stage: Stage): { have: number; need: number } {
  const s = stageInfo(stage);
  if (!s) return { have: 0, need: 0 };
  return { have: Math.min(levelOf(p, charId, s.track), s.need), need: s.need };
}

/** Знак освоен по памяти — так считают печать, коллекцию 60 пар и знаки карты */
export const knowsByHeart = (p: Progress, charId: string) => stageIndex(stageOf(p, charId)) > stageIndex('recall');

/**
 * Результат шага пути. Ступени до этой считаются пройденными (знак мог прийти сюда по старому
 * прогрессу). Ошибка обнуляет уровень ступени (как в Лейтнере) и снимает засчитанные ступени
 * после неё. С demote знак ещё и спускается на ступень ниже (не ниже обводки):
 * чтобы вернуться, нужен один чистый проход на ней.
 */
export function recordStep(p: Progress, charId: string, stage: Stage, ok: boolean, demote = false): Progress {
  const i = stageIndex(stage);
  const info = STAGES[i];
  if (!info) return p;
  let next = STAGES.slice(0, i).reduce((q, s) => floorLevel(q, charId, s.track, s.need), p);
  next = recordResult(next, charId, info.track, ok);
  if (ok) return next;
  for (const later of STAGES.slice(i + 1)) next = capLevel(next, charId, later.track, later.need - 1);
  const prev = STAGES[i - 1];
  if (demote && prev && stageIndex('trace') < i) next = capLevel(next, charId, prev.track, prev.need - 1);
  return next;
}

/** Столько ошибок на письме — уже не «почти», знак спускается на ступень ниже */
export const DEMOTE_MISTAKES = 3;

/** Слот сессии пути; ступень определяется, когда до него дошла очередь */
export interface Slot {
  char: BaziChar;
  /** Повторение освоенного знака: пишем по памяти и знак не спускаем ниже */
  review?: boolean;
}

/** Сколько знаков одновременно в работе (между знакомством и тетрадью) */
export const WINDOW = 4;
/** Новых знаков за сессию, не больше */
export const NEW_PER_SESSION = 2;
/** Заданий в тетрадь и повторений освоенного за сессию */
export const PAPER_PER_SESSION = 3;
export const REVIEWS_PER_SESSION = 2;

/**
 * Сессия «Продолжить путь». Знаки в работе — по два слота подряд («обвёл — и сразу ещё раз»),
 * новые — по три (знакомство и две обводки), освоенные — повторение по памяти (самые слабые),
 * задания в тетрадь — в конце. Знаки из focus (например, знаки своей карты) идут первыми.
 */
export function buildPath(p: Progress, focus: BaziChar[] = [], random = Math.random): Slot[] {
  const ids = new Set<string>();
  const order = [...focus, ...CHARACTERS].filter((c) => !ids.has(c.id) && ids.add(c.id));
  const by = (pred: (s: Stage) => boolean) => order.filter((c) => pred(stageOf(p, c.id)));

  const active = by((s) => s !== 'intro' && s !== 'paper' && s !== 'done').slice(0, WINDOW);
  const fresh = by((s) => s === 'intro').slice(0, Math.max(0, Math.min(NEW_PER_SESSION, WINDOW - active.length)));
  const paper = by((s) => s === 'paper').slice(0, PAPER_PER_SESSION);
  const done = by((s) => s === 'done');

  // Если учить больше нечего — сессия из одних повторений
  const reviewCount = active.length + fresh.length + paper.length ? REVIEWS_PER_SESSION : 6;
  const reviews = done
    .map((c) => ({ c, key: levelOf(p, c.id, 'recall') + random() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, reviewCount)
    .map(({ c }): Slot => ({ char: c, review: true }));

  return [
    ...reviews,
    ...active.flatMap((c): Slot[] => [{ char: c }, { char: c }]),
    ...fresh.flatMap((c): Slot[] => [{ char: c }, { char: c }, { char: c }]),
    ...paper.map((c): Slot => ({ char: c })),
  ];
}

/** Ступень слота на момент показа; освоенный знак без пометки повторения тоже пишем по памяти */
export function slotStage(p: Progress, slot: Slot): Stage {
  const stage = stageOf(p, slot.char.id);
  return slot.review || stage === 'done' ? 'recall' : stage;
}

/** Сколько знаков на каждой ступени */
export function ladder(p: Progress, chars: BaziChar[] = CHARACTERS): Record<Stage, number> {
  const counts = Object.fromEntries([...STAGES.map((s) => s.id), 'done'].map((id) => [id, 0])) as Record<Stage, number>;
  for (const c of chars) counts[stageOf(p, c.id)]++;
  return counts;
}
