// Тесты на свойствах (fast-check): правила проверяются на сотнях случайных сценариев, а не на паре примеров.
// Упавший случай fast-check сам ужимает до минимального и печатает seed — его можно повторить.
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BRANCHES, CHARACTERS, STEMS } from '../data/characters';
import { strokeData } from '../data/strokes';
import { DRILL_ORDER_MIN_STROKES, drillReducer, drillStart, drillSteps, type DrillAction, type DrillState } from './drill';
import { NEW_PER_SESSION, ORDER_MIN_STROKES, STAGES, buildPath, recordStep, stageIndex, stageOf } from './path';
import { EMPTY_PROGRESS, MAX_LEVEL, type Progress, type Track, levelOf, recordResult } from './progress';
import { DIRECTIONS, appliesTo, makeQuestion } from './quiz';
import { PASS_MISTAKES } from './session';

/** Детерминированный Math.random на время свойства: случайность приложения тоже воспроизводима */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
afterEach(() => vi.restoreAllMocks());

const charArb = fc.constantFrom(...CHARACTERS);
const TRACKS: Track[] = ['trace', 'recall', 'half', 'glance', 'order', 'quiz:char>reading'];

/** Прогресс после случайной истории шагов пути по случайным знакам */
const pathHistory = fc.array(fc.record({ char: charArb, ok: fc.boolean(), demote: fc.boolean() }), { maxLength: 120 });
const playPath = (steps: { char: (typeof CHARACTERS)[number]; ok: boolean; demote: boolean }[]) =>
  steps.reduce<Progress>((p, s) => {
    const stage = stageOf(p, s.char.id);
    return stage === 'done' ? p : recordStep(p, s.char.id, stage, s.ok, s.demote);
  }, EMPTY_PROGRESS);

describe('прогресс (Лейтнер)', () => {
  it('уровень всегда 0…MAX; верно — +1 до потолка, ошибка — 0', () => {
    fc.assert(
      fc.property(fc.array(fc.record({ track: fc.constantFrom(...TRACKS), ok: fc.boolean() }), { maxLength: 60 }), (events) => {
        let p = EMPTY_PROGRESS;
        for (const e of events) {
          const before = levelOf(p, 'stem-jia', e.track);
          p = recordResult(p, 'stem-jia', e.track, e.ok);
          const after = levelOf(p, 'stem-jia', e.track);
          expect(after).toBe(e.ok ? Math.min(MAX_LEVEL, before + 1) : 0);
          expect(after).toBeGreaterThanOrEqual(0);
          expect(after).toBeLessThanOrEqual(MAX_LEVEL);
        }
      }),
    );
  });
});

describe('путь знака', () => {
  it('шаг на текущей ступени: верно — не ниже и не дальше одной ступени, ошибка — на месте или ровно на одну вниз', () => {
    fc.assert(
      fc.property(pathHistory, charArb, fc.boolean(), fc.boolean(), (history, char, ok, demote) => {
        const p = playPath(history);
        const stage = stageOf(p, char.id);
        if (stage === 'done') return;
        const before = stageIndex(stage);
        const after = stageIndex(stageOf(recordStep(p, char.id, stage, ok, demote), char.id));
        if (ok) {
          expect(after).toBeGreaterThanOrEqual(before);
          expect(after).toBeLessThanOrEqual(before + 1);
        } else if (demote && before > stageIndex('trace')) {
          expect(after).toBe(before - 1);
        } else {
          expect(after).toBe(before);
        }
      }),
    );
  });

  it('ступень знака всегда из списка ступеней или «освоен»', () => {
    fc.assert(
      fc.property(pathHistory, (history) => {
        const p = playPath(history);
        for (const c of CHARACTERS) expect(stageIndex(stageOf(p, c.id))).toBeLessThanOrEqual(STAGES.length);
      }),
    );
  });

  it('сессия пути: только знаки набора, новых не больше NEW_PER_SESSION, вопрос о порядке — знакам от ORDER_MIN_STROKES черт', () => {
    fc.assert(
      fc.property(pathHistory, fc.integer({ min: 0, max: 2 ** 31 }), (history, seed) => {
        const p = playPath(history);
        const slots = buildPath(p, [], seeded(seed));
        const ids = new Set(CHARACTERS.map((c) => c.id));
        const fresh = new Set(slots.filter((s) => stageOf(p, s.char.id) === 'intro').map((s) => s.char.id));
        expect(fresh.size).toBeLessThanOrEqual(NEW_PER_SESSION);
        for (const s of slots) {
          expect(ids.has(s.char.id)).toBe(true);
          if (s.order) expect(strokeData(s.char.hanzi).strokes.length).toBeGreaterThanOrEqual(ORDER_MIN_STROKES);
          if (s.review) expect(stageOf(p, s.char.id)).toBe('done');
        }
      }),
    );
  });
});

describe('«Узнавание»', () => {
  it('правильный вариант всегда есть и один, варианты не повторяются, их четыре; знак из пула, направление к нему подходит', () => {
    const deckArb = fc.constantFrom(STEMS, BRANCHES, CHARACTERS);
    const dirsArb = fc.subarray(DIRECTIONS, { minLength: 1 });
    const levelsArb = fc.array(fc.tuple(charArb, fc.constantFrom(...DIRECTIONS), fc.integer({ min: 0, max: MAX_LEVEL })), {
      maxLength: 40,
    });
    fc.assert(
      fc.property(deckArb, dirsArb, levelsArb, fc.integer({ min: 0, max: 2 ** 31 }), (deck, dirs, levels, seed) => {
        if (!dirs.some((d) => deck.some((c) => appliesTo(d, c)))) return;
        vi.spyOn(Math, 'random').mockImplementation(seeded(seed));
        let p = EMPTY_PROGRESS;
        for (const [c, d, lvl] of levels) {
          for (let i = 0; i < lvl; i++) p = recordResult(p, c.id, `quiz:${d.id}`, true);
        }
        const q = makeQuestion(deck, deck, dirs, p, []);
        const ids = q.options.map((o) => o.id);
        expect(ids.filter((id) => id === q.answerId)).toHaveLength(1);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(4);
        expect(deck).toContain(q.char);
        expect(appliesTo(q.direction, q.char)).toBe(true);
        vi.restoreAllMocks();
      }),
    );
  });
});

describe('данные черт', () => {
  /** Число черт по прописям (docs/stage0-pdf-review.md); у 癸 «く» — одна черта, всего 8 */
  const PDF_COUNTS: Record<string, number> = {
    甲: 5, 乙: 1, 丙: 5, 丁: 2, 戊: 5, 己: 3, 庚: 8, 辛: 7, 壬: 4, 癸: 8, 子: 3,
    丑: 4, 寅: 11, 卯: 5, 辰: 7, 巳: 3, 午: 4, 未: 5, 申: 5, 酉: 7, 戌: 6, 亥: 6,
  };
  // Направление участка средней линии в данных Hanzi Writer: ось Y вверх
  const delta = (m: number[][]) => [m[m.length - 1][0] - m[0][0], m[m.length - 1][1] - m[0][1]];
  const median = (h: string, i: number) => strokeData(h).medians[i];

  it('у каждого знака черт столько же, сколько в прописях; контуров столько же, сколько средних линий', () => {
    for (const c of CHARACTERS) {
      const d = strokeData(c.hanzi);
      expect(d.strokes.length, c.hanzi).toBe(PDF_COUNTS[c.hanzi]);
      expect(d.medians.length, c.hanzi).toBe(d.strokes.length);
    }
  });

  it('каждая черта — исходная черта hanzi-writer-data или склейка исходных без разрыва; каждая исходная взята ровно раз', () => {
    const json = (h: string) =>
      JSON.parse(readFileSync(join(process.cwd(), 'node_modules', 'hanzi-writer-data', `${h}.json`), 'utf8')) as {
        strokes: string[];
        medians: number[][][];
      };
    for (const c of CHARACTERS) {
      const src = json(c.hanzi);
      const ours = strokeData(c.hanzi);
      const used: number[] = [];
      ours.strokes.forEach((path, i) => {
        // Склейка: контур — исходные контуры через пробел (scripts/build-strokes.mjs)
        const parts = src.strokes.map((p, k) => [p, k] as const).filter(([p]) => path === p || path.split(' M ').length > 1 && path.includes(p));
        const exact = src.strokes.indexOf(path);
        const picked = exact >= 0 ? [exact] : parts.map(([, k]) => k);
        expect(picked.length, `${c.hanzi} черта ${i + 1}`).toBeGreaterThan(0);
        expect(ours.medians[i], `${c.hanzi} черта ${i + 1}`).toEqual(picked.flatMap((k) => src.medians[k]));
        for (let j = 1; j < picked.length; j++) {
          const a = src.medians[picked[j - 1]].at(-1)!;
          const b = src.medians[picked[j]][0];
          expect(Math.hypot(a[0] - b[0], a[1] - b[1]), `${c.hanzi} черта ${i + 1}: стык`).toBeLessThan(60);
        }
        used.push(...picked);
      });
      expect([...used].sort((a, b) => a - b), c.hanzi).toEqual(src.strokes.map((_, k) => k));
    }
  });

  it('порядок по прописям: 丑 — горизонталь раньше вертикали', () => {
    const [dx2, dy2] = delta(median('丑', 1));
    const [dx3, dy3] = delta(median('丑', 2));
    expect(Math.abs(dx2)).toBeGreaterThan(Math.abs(dy2));
    expect(Math.abs(dy3)).toBeGreaterThan(Math.abs(dx3));
  });

  it('порядок по прописям: 辰 — длинная откидная (вправо-вниз) раньше короткой (влево-вниз)', () => {
    const [dx6, dy6] = delta(median('辰', 5));
    const [dx7] = delta(median('辰', 6));
    expect(dx6).toBeGreaterThan(0);
    expect(dy6).toBeLessThan(0);
    expect(dx7).toBeLessThan(0);
  });

  it('порядок по прописям: 戌 — короткая горизонталь пятая', () => {
    const [dx, dy] = delta(median('戌', 4));
    expect(Math.abs(dx)).toBeGreaterThan(Math.abs(dy) * 2);
  });

  it('порядок по прописям: 癸 — третья черта «く»: сначала влево-вниз, потом вправо-вниз', () => {
    const m = median('癸', 2);
    const corner = m.reduce((best, p) => (p[0] < best[0] ? p : best), m[0]);
    expect(corner[0]).toBeLessThan(m[0][0]);
    expect(m[m.length - 1][0]).toBeGreaterThan(corner[0]);
    expect(m[m.length - 1][1]).toBeLessThan(m[0][1]);
  });
});

describe('прогон одного знака', () => {
  it('вопрос о порядке есть только у знаков от DRILL_ORDER_MIN_STROKES черт', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
        expect(drillSteps(n).some((s) => s.id === 'order')).toBe(n >= DRILL_ORDER_MIN_STROKES);
      }),
    );
  });

  const actionArb: fc.Arbitrary<DrillAction> = fc.oneof(
    fc.record({ type: fc.constant('result' as const), mistakes: fc.integer({ min: 0, max: 5 }) }),
    fc.constant({ type: 'next' as const }),
    fc.constant({ type: 'retry' as const }),
  );

  it('совпадает с простой моделью правила: шаг засчитан ⇔ ошибок ≤ PASS_MISTAKES', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), fc.array(actionArb, { maxLength: 80 }), (steps, actions) => {
        let s: DrillState = drillStart(steps);
        // Модель: номер шага, итог текущей попытки, все попытки по шагам, закончено ли
        let index = 0;
        let current: number | null = null;
        const tries: number[][] = [];
        let done = false;
        for (const a of actions) {
          s = drillReducer(s, a);
          if (done) continue;
          if (a.type === 'result' && current === null) {
            current = a.mistakes;
            (tries[index] ??= []).push(a.mistakes);
          } else if (a.type === 'next' && current !== null && current <= PASS_MISTAKES) {
            if (index === steps - 1) done = true;
            else index++;
            current = null;
          } else if (a.type === 'retry' && current !== null && current > PASS_MISTAKES) {
            current = null;
          }
          expect(s.index).toBe(index);
          expect(s.done).toBe(done);
          expect(s.current?.mistakes ?? null).toBe(done ? null : current);
          expect(s.tries).toEqual(tries);
        }
      }),
    );
  });

  it('пройден до конца ⇔ на каждом шаге последняя попытка засчитана', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), fc.array(actionArb, { maxLength: 80 }), (steps, actions) => {
        const s = actions.reduce(drillReducer, drillStart(steps));
        if (s.done) {
          expect(s.tries).toHaveLength(steps);
          for (const t of s.tries) expect(t[t.length - 1]).toBeLessThanOrEqual(PASS_MISTAKES);
        }
      }),
    );
  });
});
