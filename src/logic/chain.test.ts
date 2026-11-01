import { describe, expect, it } from 'vitest';
import { chartFor } from './calendar';
import { CHAIN_LENGTH, chainOf, isCleanChain, momentChain, randomChain } from './chain';

describe('цепочки столпов', () => {
  it('знаки идут год → месяц → день → час, ствол перед ветвью', () => {
    const { cells } = chainOf(chartFor(1949, 10, 1, '12:10'), '');
    expect(cells.map((c) => c.char.hanzi).join('')).toBe('己丑癸酉甲子庚午');
    expect(cells.map((c) => c.pillar).slice(0, 3)).toEqual(['Год', 'Год', 'Месяц']);
    expect(cells.map((c) => c.part).slice(0, 2)).toEqual(['ствол', 'ветвь']);
  });

  it('в любой цепочке восемь знаков, момент подписан', () => {
    expect(momentChain(new Date(2026, 10, 1, 9, 5)).label).toBe('сейчас, 09:05');
    expect(randomChain(() => 0).label).toBe('01.01.1950, 00:00');
    for (let i = 0; i < 50; i++) expect(randomChain().cells).toHaveLength(CHAIN_LENGTH);
  });

  it('чистая цепочка — не больше двух ошибок', () => {
    expect(isCleanChain(2)).toBe(true);
    expect(isCleanChain(3)).toBe(false);
  });
});
