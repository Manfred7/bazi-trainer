import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../data/characters';
import { recordStep } from './path';
import { EMPTY_JOURNAL, awardChart, nowAt, withAwards } from './journal';
import { EMPTY_PROGRESS } from './progress';
import { MAX_STEPS, RANKS, rankIndex, rankProgress } from './ranks';

describe('звания', () => {
  it('с нуля — новичок, шкала пустая', () => {
    const r = rankProgress(EMPTY_PROGRESS, 0);
    expect(r.rank.title).toBe('Новичок');
    expect(r.next?.title).toBe('Любитель');
    expect(r.share).toBe(0);
  });

  it('ступени считаются по пути', () => {
    const p = CHARACTERS.slice(0, 5).reduce((q, c) => recordStep(q, c.id, 'intro', true), EMPTY_PROGRESS);
    expect(rankProgress(p, 0).steps).toBe(5);
    expect(rankProgress(p, 0).share).toBeCloseTo(0.5);
  });

  it('старшим званиям нужны и дни столпа', () => {
    expect(RANKS[rankIndex(40, 0)].title).toBe('Любитель');
    expect(RANKS[rankIndex(40, 3)].title).toBe('Адепт');
    expect(RANKS[rankIndex(MAX_STEPS, 59)].title).toBe('Магистр');
    expect(RANKS[rankIndex(MAX_STEPS, 60)].title).toBe('Гранд мастер');
  });

  it('полученное звание не отнимается', () => {
    expect(RANKS[rankIndex(0, 0, 3)].title).toBe('Мастер');
    const r = rankProgress(EMPTY_PROGRESS, 0, 3);
    expect(r.rank.title).toBe('Мастер');
    expect(r.share).toBe(0);
  });

  it('присвоения записываются с моментом и не повторяются', () => {
    let j = withAwards(EMPTY_JOURNAL, 0, '2026-10-31T23:20');
    expect(j.awards).toEqual([{ rank: 0, at: '2026-10-31T23:20' }]);
    expect(withAwards(j, 0)).toBe(j);
    j = withAwards(j, 2, '2026-11-02T08:05');
    expect(j.bestRank).toBe(2);
    expect(j.awards.map((a) => `${a.rank} ${a.at}`)).toEqual(['0 2026-10-31T23:20', '1 2026-11-02T08:05', '2 2026-11-02T08:05']);
  });

  it('момент присвоения — четыре столпа', () => {
    const c = awardChart({ rank: 1, at: '1949-10-01T12:10' });
    expect([c.hour!, c.day, c.month, c.year].map((p) => p.stem.hanzi + p.branch.hanzi)).toEqual(['庚午', '甲子', '癸酉', '己丑']);
    expect(nowAt(new Date(2026, 9, 31, 9, 5))).toBe('2026-10-31T09:05');
  });

  it('у последнего звания шкала полная', () => {
    expect(rankProgress(EMPTY_PROGRESS, 0, RANKS.length - 1).share).toBe(1);
  });
});
