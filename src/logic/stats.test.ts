import { describe, expect, it } from 'vitest';
import { CHARACTERS, STEMS } from '../data/characters';
import { strokeData } from '../data/strokes';
import { EMPTY_STATS, KEEP_EVENTS, type StatEvent, type Stats, addEvent, classifyMistake, compact, summarize } from './stats';

const jia = STEMS[0];
const TODAY = '2026-11-01';

/** Штрих по медиане черты, густо, как ведёт палец */
function along(median: number[][], step = 20) {
  const pts: { x: number; y: number }[] = [];
  median.slice(1).forEach(([bx, by], i) => {
    const [ax, ay] = median[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) pts.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n });
  });
  const [lx, ly] = median[median.length - 1];
  return [...pts, { x: lx, y: ly }];
}

const mistake = (points: { x: number; y: number }[], strokeNum: number, isBackwards = false) => ({
  isBackwards,
  strokeNum,
  drawnPath: { pathString: '', points },
});

describe('классификатор ошибки', () => {
  it('isBackwards — направление, даже если штрих похож на другую черту', () => {
    const { medians } = strokeData(jia.hanzi);
    expect(classifyMistake(mistake(along(medians[1]), 0, true), medians)).toBe('direction');
  });

  it('на всех 22 знаках: написана любая более поздняя черта — порядок', () => {
    for (const c of CHARACTERS) {
      const { medians } = strokeData(c.hanzi);
      for (let n = 0; n < medians.length - 1; n++) {
        for (let k = n + 1; k < medians.length; k++) {
          expect(classifyMistake(mistake(along(medians[k]), n), medians), `${c.hanzi}: черта ${k} вместо ${n}`).toBe('order');
        }
      }
    }
  });

  it('уже написанная черта — не порядок: ждём последнюю, написали первую', () => {
    const { medians } = strokeData(jia.hanzi);
    expect(classifyMistake(mistake(along(medians[0]), medians.length - 1), medians)).toBe('shape');
  });

  it('каракули вдали от всех черт — форма', () => {
    const { medians } = strokeData(jia.hanzi);
    const far = [
      { x: 10, y: 880 },
      { x: 20, y: 870 },
      { x: 30, y: 880 },
    ];
    expect(classifyMistake(mistake(far, 0), medians)).toBe('shape');
  });

  it('короткий мазок на более поздней черте — форма: на целую черту не похож', () => {
    const { medians } = strokeData(jia.hanzi);
    const dab = along(medians[medians.length - 1]).slice(0, 2);
    expect(classifyMistake(mistake(dab, 0), medians)).toBe('shape');
  });

  it('одна точка — форма', () => {
    const { medians } = strokeData(jia.hanzi);
    expect(classifyMistake(mistake([{ x: 500, y: 400 }], 0), medians)).toBe('shape');
  });
});

const event = (day: string, char = jia.id): StatEvent => ({ day, char, mode: 'trace', kind: 'mistake', stroke: 0, type: 'shape' });

describe('ограничение журнала', () => {
  it('старше 90 дней — в месячные счётчики, свежее остаётся', () => {
    const s: Stats = { events: [event('2026-07-01'), event('2026-07-02'), event('2026-10-30')], months: {} };
    const c = compact(s, TODAY);
    expect(c.events).toEqual([event('2026-10-30')]);
    expect(c.months['2026-07']).toEqual({ 'mistake:shape': 2 });
  });

  it('сверх 5000 событий самые старые сворачиваются', () => {
    const events = Array.from({ length: KEEP_EVENTS + 2 }, () => event('2026-10-30'));
    const c = compact({ events, months: { '2026-10': { 'mistake:shape': 1 } } }, TODAY);
    expect(c.events.length).toBe(KEEP_EVENTS);
    expect(c.months['2026-10']['mistake:shape']).toBe(3);
  });

  it('нечего сворачивать — тот же объект', () => {
    const s: Stats = { events: [event('2026-10-30')], months: {} };
    expect(compact(s, TODAY)).toBe(s);
  });

  it('написанный знак при свёртке считает и черты', () => {
    const total = strokeData(jia.hanzi).strokes.length;
    const s: Stats = { events: [{ day: '2026-01-05', char: jia.id, mode: 'trace', kind: 'done', mistakes: 0 }], months: {} };
    expect(compact(s, TODAY).months['2026-01']).toEqual({ done: 1, strokes: total });
    expect(summarize(compact(s, TODAY), TODAY).allStrokes).toBe(total);
  });
});

describe('сводка', () => {
  const log = (s: Stats, char: string, body: Parameters<typeof addEvent>[3], day = TODAY, mode = 'trace') =>
    addEvent(s, char, mode, body, day);
  const repeat = (s: Stats, n: number, f: (q: Stats) => Stats) => Array.from({ length: n }).reduce<Stats>(f, s);

  it('трудный знак — от двух ошибок; одна случайная не считается', () => {
    let s = log(EMPTY_STATS, STEMS[1].id, { kind: 'mistake', stroke: 0, type: 'shape' });
    expect(summarize(s, TODAY).hardChars).toEqual([]);
    s = repeat(s, 2, (q) => log(q, jia.id, { kind: 'mistake', stroke: 2, type: 'direction' }));
    const { hardChars, hardStrokes } = summarize(s, TODAY);
    expect(hardChars.map((x) => x.char.id)).toEqual([jia.id]);
    expect(hardStrokes).toEqual([{ char: jia, stroke: 2, count: 2, top: 'direction' }]);
  });

  it('доли типов — за неделю и за месяц отдельно; старше месяца не в счёт', () => {
    let s = log(EMPTY_STATS, jia.id, { kind: 'mistake', stroke: 0, type: 'order' });
    s = log(s, jia.id, { kind: 'hint', stroke: 1 });
    s = log(s, jia.id, { kind: 'mistake', stroke: 0, type: 'shape' }, '2026-10-20');
    s = { ...s, events: [{ ...event('2026-09-01'), type: 'direction' } as StatEvent, ...s.events] };
    const { week, month } = summarize(s, TODAY);
    expect(week.counts).toEqual({ order: 1, direction: 0, shape: 0, hint: 1 });
    expect(month.counts).toEqual({ order: 1, direction: 0, shape: 1, hint: 1 });
  });

  it('ошибок на 100 черт и чистые проходы', () => {
    const total = strokeData(jia.hanzi).strokes.length;
    let s = log(EMPTY_STATS, jia.id, { kind: 'mistake', stroke: 0, type: 'shape' });
    s = log(s, jia.id, { kind: 'done', mistakes: 1 });
    s = log(s, jia.id, { kind: 'done', mistakes: 0 });
    const { week, strokes, days } = summarize(s, TODAY);
    expect(week.rate).toBeCloseTo((1 / (total * 2)) * 100);
    expect(week.clean).toBe(1);
    expect(strokes).toBe(total * 2);
    expect(days).toBe(1);
  });

  it('путаемые пары: 巳 ↔ 己 в обе стороны — одна пара, похожие первыми; стихии не в счёт', () => {
    const si = CHARACTERS.find((c) => c.hanzi === '巳')!;
    const ji = CHARACTERS.find((c) => c.hanzi === '己')!;
    const mode = 'quiz:reading>char';
    let s = log(EMPTY_STATS, jia.id, { kind: 'quiz', picked: STEMS[1].id, lookalike: false }, TODAY, mode);
    s = log(s, jia.id, { kind: 'quiz', picked: STEMS[1].id, lookalike: false }, TODAY, mode);
    s = log(s, si.id, { kind: 'quiz', picked: ji.id, lookalike: true }, TODAY, mode);
    s = log(s, ji.id, { kind: 'quiz', picked: si.id, lookalike: true }, TODAY, mode);
    s = log(s, jia.id, { kind: 'quiz', picked: 'earth-yin', lookalike: false }, TODAY, 'quiz:char>element');
    const { pairs } = summarize(s, TODAY);
    expect(pairs.map((p) => [p.count, p.lookalike])).toEqual([
      [2, true],
      [2, false],
    ]);
  });

  it('похожий знак не из набора тоже попадает в пары', () => {
    const wei = CHARACTERS.find((c) => c.hanzi === '未')!;
    const s = log(EMPTY_STATS, wei.id, { kind: 'quiz', picked: 'extra-末', lookalike: true }, TODAY, 'quiz:reading>char');
    expect(summarize(s, TODAY).pairs[0]).toMatchObject({ a: '未', b: '末', count: 1, lookalike: true });
  });

  it('что получается: последние три раза без ошибок', () => {
    const clean = { kind: 'done', mistakes: 0 } as const;
    let s = log(EMPTY_STATS, jia.id, { kind: 'done', mistakes: 2 });
    s = repeat(s, 2, (q) => log(q, jia.id, clean));
    expect(summarize(s, TODAY).steady).toEqual([]);
    s = log(s, jia.id, clean);
    expect(summarize(s, TODAY).steady).toEqual([jia]);
  });
});
