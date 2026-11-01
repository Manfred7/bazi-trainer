import { describe, expect, it } from 'vitest';
import { CHARACTERS, STEMS } from '../data/characters';
import { buildPath, ladder, recordStep, slotStage, stageOf } from './path';
import { EMPTY_PROGRESS, type Progress, recordResult } from './progress';

const jia = STEMS[0];
const times = (p: Progress, n: number, f: (p: Progress) => Progress) => Array.from({ length: n }).reduce<Progress>(f, p);

describe('ступени', () => {
  it('новый знак — знакомство, дальше по засчитанным ступеням', () => {
    let p = EMPTY_PROGRESS;
    expect(stageOf(p, jia.id)).toBe('intro');
    p = recordStep(p, jia.id, 'intro', true);
    expect(stageOf(p, jia.id)).toBe('trace');
    p = times(p, 2, (q) => recordStep(q, jia.id, 'trace', true));
    expect(stageOf(p, jia.id)).toBe('half');
  });

  it('старый прогресс по памяти продвигает знак сразу к тетради', () => {
    const p = times(EMPTY_PROGRESS, 3, (q) => recordResult(q, jia.id, 'recall', true));
    expect(stageOf(p, jia.id)).toBe('paper');
  });

  it('провал с demote спускает на ступень, один чистый проход возвращает', () => {
    let p = recordStep(EMPTY_PROGRESS, jia.id, 'intro', true);
    for (const s of ['trace', 'half', 'glance'] as const) p = times(p, 2, (q) => recordStep(q, jia.id, s, true));
    expect(stageOf(p, jia.id)).toBe('recall');
    p = recordStep(p, jia.id, 'recall', false, true);
    expect(stageOf(p, jia.id)).toBe('glance');
    p = recordStep(p, jia.id, 'glance', true);
    expect(stageOf(p, jia.id)).toBe('recall');
  });

  it('после полуконтура — «Взгляни и напиши»; старый прогресс выключенных «Точек» не мешает', () => {
    let p = recordStep(EMPTY_PROGRESS, jia.id, 'intro', true);
    for (const s of ['trace', 'half'] as const) p = times(p, 2, (q) => recordStep(q, jia.id, s, true));
    p = times(p, 2, (q) => recordResult(q, jia.id, 'dots', true));
    expect(stageOf(p, jia.id)).toBe('glance');
  });

  it('провал без demote оставляет на ступени, провал на обводке не спускает к знакомству', () => {
    let p = recordStep(EMPTY_PROGRESS, jia.id, 'intro', true);
    p = recordStep(p, jia.id, 'trace', false, true);
    expect(stageOf(p, jia.id)).toBe('trace');
  });

  it('провал повторения по памяти у освоенного знака возвращает его на «По памяти»', () => {
    let p = times(EMPTY_PROGRESS, 3, (q) => recordResult(q, jia.id, 'recall', true));
    p = times(p, 2, (q) => recordStep(q, jia.id, 'paper', true));
    expect(stageOf(p, jia.id)).toBe('done');
    p = recordStep(p, jia.id, 'recall', false);
    expect(stageOf(p, jia.id)).toBe('recall');
  });
});

describe('сессия пути', () => {
  it('с нуля — два новых знака: знакомство и две обводки', () => {
    const slots = buildPath(EMPTY_PROGRESS);
    expect(slots.map((s) => s.char.hanzi)).toEqual(['甲', '甲', '甲', '乙', '乙', '乙']);
    expect(slotStage(EMPTY_PROGRESS, slots[0])).toBe('intro');
  });

  it('знаки фокуса идут первыми', () => {
    const focus = [CHARACTERS.find((c) => c.hanzi === '午')!];
    expect(buildPath(EMPTY_PROGRESS, focus)[0].char.hanzi).toBe('午');
  });

  it('когда в работе 4 знака, новых не добавляет', () => {
    const p = STEMS.slice(0, 4).reduce((q, c) => recordStep(q, c.id, 'intro', true), EMPTY_PROGRESS);
    const slots = buildPath(p);
    expect(new Set(slots.map((s) => s.char.hanzi))).toEqual(new Set(['甲', '乙', '丙', '丁']));
    expect(slots).toHaveLength(8);
  });

  it('вопрос о порядке — перед письмом знака на полуконтуре и дальше, если в нём хотя бы 3 черты', () => {
    let p = EMPTY_PROGRESS;
    for (const c of [STEMS[0], STEMS[1]]) {
      p = recordStep(p, c.id, 'intro', true);
      p = times(p, 2, (q) => recordStep(q, c.id, 'trace', true));
    }
    const slots = buildPath(p);
    // 甲 (5 черт): вопрос и два слота письма; 乙 (1 черта): без вопроса
    expect(slots.filter((s) => s.char.hanzi === '甲').map((s) => !!s.order)).toEqual([true, false, false]);
    expect(slots.filter((s) => s.char.hanzi === '乙').some((s) => s.order)).toBe(false);
  });

  it('всё освоено — сессия из повторений по памяти', () => {
    const p = CHARACTERS.reduce(
      (q, c) => times(times(q, 3, (r) => recordResult(r, c.id, 'recall', true)), 2, (r) => recordStep(r, c.id, 'paper', true)),
      EMPTY_PROGRESS,
    );
    expect(ladder(p).done).toBe(22);
    const slots = buildPath(p);
    expect(slots).toHaveLength(6);
    expect(slots.every((s) => s.review && slotStage(p, s) === 'recall')).toBe(true);
  });
});

describe('повторения по дням', () => {
  const DAY = 86_400_000;
  const t0 = Date.UTC(2026, 10, 1, 12);
  const at = (p: Progress, ok: boolean, t: number) => recordResult(p, jia.id, 'recall', ok, t);
  const interval = (p: Progress) => p.pairs[`${jia.id}:recall`].interval;

  it('интервал растёт, только если повторили в срок: 1 → 3 → 8 дней', () => {
    let p = at(EMPTY_PROGRESS, true, t0);
    expect(interval(p)).toBe(1);
    // Ещё два верных раза тем же вечером интервал не разгоняют
    p = at(at(p, true, t0 + 60_000), true, t0 + 120_000);
    expect(interval(p)).toBe(1);
    p = at(p, true, t0 + DAY);
    expect(interval(p)).toBe(3);
    p = at(p, true, t0 + 4 * DAY);
    expect(interval(p)).toBe(8);
  });

  it('ошибка сбрасывает интервал — повторить сегодня же', () => {
    let p = at(at(EMPTY_PROGRESS, true, t0), true, t0 + DAY);
    p = at(p, false, t0 + 4 * DAY);
    expect(interval(p)).toBe(0);
    expect(p.pairs[`${jia.id}:recall`].due).toBe(t0 + 4 * DAY);
  });

  it('в сессию попадают освоенные знаки, у которых подошёл срок', () => {
    const learned = (q: Progress, id: string, t: number) =>
      times(times(q, 3, (r) => recordResult(r, id, 'recall', true, t)), 2, (r) => recordStep(r, id, 'paper', true));
    // 甲 освоен давно, 乙 — только что; в работе ещё 丙 на обводке
    let p = learned(EMPTY_PROGRESS, STEMS[0].id, t0 - 10 * DAY);
    p = learned(p, STEMS[1].id, t0);
    p = recordStep(p, STEMS[2].id, 'intro', true);
    const reviews = buildPath(p, [], Math.random, t0).filter((s) => s.review);
    expect(reviews.map((s) => s.char.hanzi)).toEqual(['甲']);
  });
});
