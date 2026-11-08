import { isPass } from './session';

/**
 * Свободная практика «Один знак — все шаги»: знак проходит шаги подряд, от знакомства до письма по памяти.
 * Шаг засчитан, если ошибок не больше PASS_MISTAKES, иначе его повторяют. На прогресс пути не влияет.
 */
export type DrillStepId = 'intro' | 'order' | 'trace' | 'half' | 'glance' | 'recall';

export const DRILL_STEPS: { id: DrillStepId; label: string; prompt: string }[] = [
  { id: 'intro', label: 'Знакомство', prompt: 'Посмотрите порядок черт' },
  { id: 'order', label: 'Какая черта следующая?', prompt: 'Нажмите на черту, которая идёт следующей' },
  { id: 'trace', label: 'Обводка', prompt: 'Обведите знак по порядку черт' },
  { id: 'half', label: 'Полуконтур', prompt: 'Первые черты — по контуру, остальные — сами' },
  { id: 'glance', label: 'Взгляни и напиши', prompt: 'Запомните знак — скоро он исчезнет' },
  { id: 'recall', label: 'Финал: по памяти', prompt: 'Напишите знак по памяти, без подсказок' },
];

/** У «Какая черта следующая?» должно быть о чём спросить: знакам из 1–2 черт шаг не нужен */
export const DRILL_ORDER_MIN_STROKES = 3;

export const drillSteps = (strokes: number) =>
  DRILL_STEPS.filter((s) => s.id !== 'order' || strokes >= DRILL_ORDER_MIN_STROKES);

export interface DrillState {
  /** Сколько шагов в прогоне этого знака */
  steps: number;
  index: number;
  /** Ошибки каждой попытки по шагам: [шаг][попытка] */
  tries: number[][];
  /** Итог текущей попытки; null — шаг ещё идёт */
  current: { ok: boolean; mistakes: number } | null;
  /** Номер попытки шага: смена перезапускает шаг с нуля */
  attempt: number;
  /** Все шаги пройдены — пора к итогам */
  done: boolean;
}

export type DrillAction =
  /** Шаг закончен с таким числом ошибок; повторный итог той же попытки не считается */
  | { type: 'result'; mistakes: number }
  /** К следующему шагу — только после засчитанной попытки */
  | { type: 'next' }
  /** Повторить шаг — только после незасчитанной попытки */
  | { type: 'retry' };

export const drillStart = (steps: number): DrillState => ({
  steps,
  index: 0,
  tries: [],
  current: null,
  attempt: 0,
  done: false,
});

export function drillReducer(s: DrillState, a: DrillAction): DrillState {
  if (s.done) return s;
  switch (a.type) {
    case 'result': {
      if (s.current) return s;
      const tries = [...s.tries];
      tries[s.index] = [...(tries[s.index] ?? []), a.mistakes];
      return { ...s, tries, current: { ok: isPass(a.mistakes), mistakes: a.mistakes } };
    }
    case 'next':
      if (!s.current?.ok) return s;
      if (s.index === s.steps - 1) return { ...s, current: null, done: true };
      return { ...s, index: s.index + 1, current: null, attempt: s.attempt + 1 };
    case 'retry':
      if (!s.current || s.current.ok) return s;
      return { ...s, current: null, attempt: s.attempt + 1 };
  }
}

/** Сколько шагов пройдено с первой попытки */
export const drillClean = (s: DrillState) =>
  Array.from({ length: s.steps }, (_, i) => s.tries[i]?.length === 1).filter(Boolean).length;
