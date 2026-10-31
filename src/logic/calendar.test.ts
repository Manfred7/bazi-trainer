import { describe, expect, it } from 'vitest';
import { SIXTY, chartChars, chartFor, dayPillar, sunLongitude } from './calendar';

const name = (p: { stem: { hanzi: string }; branch: { hanzi: string } }) => p.stem.hanzi + p.branch.hanzi;

describe('цикл 60', () => {
  it('начинается с 甲子 и кончается 癸亥, пары не повторяются', () => {
    expect(name(SIXTY[0])).toBe('甲子');
    expect(name(SIXTY[59])).toBe('癸亥');
    expect(new Set(SIXTY.map(name)).size).toBe(60);
  });
});

describe('столп дня', () => {
  it('сверяется с известными датами', () => {
    expect(name(dayPillar(1900, 1, 1))).toBe('甲戌');
    expect(name(dayPillar(2000, 1, 1))).toBe('戊午');
    // День образования КНР — день 甲子
    expect(name(dayPillar(1949, 10, 1))).toBe('甲子');
  });
  it('идёт по циклу день за днём, и до эпохи тоже', () => {
    expect(dayPillar(2026, 3, 2).index).toBe((dayPillar(2026, 3, 1).index + 1) % 60);
    expect(name(dayPillar(1899, 12, 31))).toBe('癸酉');
  });
});

describe('долгота Солнца', () => {
  it('立春 2024 — 4 февраля 08:27 UTC, долгота 315°', () => {
    expect(sunLongitude(new Date(Date.UTC(2024, 1, 4, 8, 27)))).toBeCloseTo(315, 1);
  });
  it('весеннее равноденствие 2025 — 20 марта 09:01 UTC', () => {
    const l = sunLongitude(new Date(Date.UTC(2025, 2, 20, 9, 1)));
    expect(Math.min(l, 360 - l)).toBeLessThan(0.05);
  });
});

describe('карта', () => {
  it('год и месяц меняются на 立春', () => {
    const before = chartFor(2024, 2, 1);
    expect(name(before.year)).toBe('癸卯');
    expect(name(before.month)).toBe('乙丑');
    const after = chartFor(2024, 2, 10);
    expect(name(after.year)).toBe('甲辰');
    expect(name(after.month)).toBe('丙寅');
  });
  it('день смены сезона помечается для сверки', () => {
    expect(chartFor(2024, 2, 4).nearBoundary).toBe(true);
    expect(chartFor(2024, 2, 10).nearBoundary).toBe(false);
  });
  it('месяц в середине года и декабрь', () => {
    // 2024-07-20: после 小暑 — месяц 未 года 甲辰 → 辛未
    expect(name(chartFor(2024, 7, 20).month)).toBe('辛未');
    // 2023-12-20: после 大雪 — месяц 子 года 癸卯 → 甲子
    expect(name(chartFor(2023, 12, 20).month)).toBe('甲子');
  });
  it('час: от 23:00 — Крыса, от 甲 дня — 甲子', () => {
    const c = chartFor(1949, 10, 1, '00:30');
    expect(name(c.hour!)).toBe('甲子');
    expect(name(chartFor(1949, 10, 1, '12:10').hour!)).toBe('庚午');
    expect(name(chartFor(1949, 10, 1, '13:10').hour!)).toBe('辛未');
    expect(chartFor(1949, 10, 1).hour).toBeUndefined();
  });
  it('знаки карты без повторов', () => {
    const chars = chartChars(chartFor(1949, 10, 1, '00:30'));
    expect(new Set(chars.map((c) => c.id)).size).toBe(chars.length);
  });
});
