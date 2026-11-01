import type { BaziChar } from '../data/characters';
import { type Chart, type Pillar, chartFor } from './calendar';

/**
 * Цепочка — четыре столпа настоящего момента, написанные подряд по памяти: год, месяц, день, час,
 * в каждом столпе ствол, потом ветвь. Так знаки пишутся связками, а не по одному. Цепочка с прогрессом
 * знаков не связана: день с чистой цепочкой нужен только для звания «Гранд мастер».
 */
export interface ChainCell {
  char: BaziChar;
  pillar: string;
  part: 'ствол' | 'ветвь';
}

export interface Chain {
  /** Момент, которому принадлежат столпы: «14.03.1987, 09:20» или «сейчас, 09:20» */
  label: string;
  /** Клетки в порядке письма; в столбце карты ствол над ветвью, год — справа */
  cells: ChainCell[];
}

/** С какого звания (номер в RANKS — «Мастер») открыты цепочки */
export const CHAINS_FROM_RANK = 3;
/** Цепочка чистая, если ошибок и подсказок на все восемь знаков не больше этого */
export const CHAIN_PASS_MISTAKES = 2;
export const CHAIN_LENGTH = 8;

export const isCleanChain = (mistakes: number) => mistakes <= CHAIN_PASS_MISTAKES;

export function chainOf(chart: Chart, label: string): Chain {
  const pillars: [string, Pillar | undefined][] = [
    ['Год', chart.year],
    ['Месяц', chart.month],
    ['День', chart.day],
    ['Час', chart.hour],
  ];
  const cells = pillars.flatMap(([pillar, p]): ChainCell[] =>
    p
      ? [
          { char: p.stem, pillar, part: 'ствол' },
          { char: p.branch, pillar, part: 'ветвь' },
        ]
      : [],
  );
  return { label, cells };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Столпы этой минуты */
export function momentChain(now = new Date()): Chain {
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return chainOf(chartFor(now.getFullYear(), now.getMonth() + 1, now.getDate(), time), `сейчас, ${time}`);
}

/** Столпы случайного момента с 1950 по 2030 год */
export function randomChain(random = Math.random): Chain {
  const int = (from: number, to: number) => from + Math.floor(random() * (to - from + 1));
  const [y, m, d] = [int(1950, 2030), int(1, 12), int(1, 28)];
  const time = `${pad(int(0, 23))}:${pad(int(0, 59))}`;
  return chainOf(chartFor(y, m, d, time), `${pad(d)}.${pad(m)}.${y}, ${time}`);
}
