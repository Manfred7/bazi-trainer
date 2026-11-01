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
    for (const s of ['trace', 'half'] as const) p = times(p, 2, (q) => recordStep(q, jia.id, s, true));
    expect(stageOf(p, jia.id)).toBe('recall');
    p = recordStep(p, jia.id, 'recall', false, true);
    expect(stageOf(p, jia.id)).toBe('half');
    p = recordStep(p, jia.id, 'half', true);
    expect(stageOf(p, jia.id)).toBe('recall');
  });

  it('ступень «Точки» выключена: после полуконтура — по памяти, старый прогресс точек не мешает', () => {
    let p = recordStep(EMPTY_PROGRESS, jia.id, 'intro', true);
    for (const s of ['trace', 'half'] as const) p = times(p, 2, (q) => recordStep(q, jia.id, s, true));
    p = times(p, 2, (q) => recordResult(q, jia.id, 'dots', true));
    expect(stageOf(p, jia.id)).toBe('recall');
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
