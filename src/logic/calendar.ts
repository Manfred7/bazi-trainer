import { type BaziChar, BRANCHES, STEMS } from '../data/characters';

/**
 * Столпы БаЦзы: пара «ствол + ветвь» из 60-летнего (60-дневного) цикла 甲子 … 癸亥.
 *
 * - День — по местной календарной дате; 1 января 1900 — 甲戌. Граница суток в 23:00 (час Крысы) не учитывается.
 * - Год и месяц — по солнечным сезонам (节): год меняется на 立春 (долгота Солнца 315°), месяц — каждые 30°.
 *   Долгота Солнца — по упрощённой формуле Миуса (точность — минуты), момент — по часовому поясу устройства.
 * - Час — по местному времени на часах, без поправки на истинное солнечное время.
 */

export interface Pillar {
  stem: BaziChar;
  branch: BaziChar;
  /** Номер в цикле 60: 0 — 甲子, 59 — 癸亥 */
  index: number;
}

/** Номер в цикле 60 по номерам ствола (0–9) и ветви (0–11) одной чётности */
const cycleIndex = (stem: number, branch: number) => (6 * stem - 5 * branch + 60) % 60;

export const pillarAt = (index: number): Pillar => {
  const i = ((index % 60) + 60) % 60;
  return { stem: STEMS[i % 10], branch: BRANCHES[i % 12], index: i };
};

const pillarOf = (stem: number, branch: number) => pillarAt(cycleIndex(stem, branch));

/** Все 60 пар по порядку */
export const SIXTY: Pillar[] = Array.from({ length: 60 }, (_, i) => pillarAt(i));

const DAY_MS = 86_400_000;
/** 1900-01-01 — день 甲戌 (номер 10) */
const DAY_EPOCH = Date.UTC(1900, 0, 1);
const DAY_EPOCH_INDEX = 10;

/** Столп дня по календарной дате (год, месяц 1–12, число) */
export function dayPillar(y: number, m: number, d: number): Pillar {
  const days = Math.round((Date.UTC(y, m - 1, d) - DAY_EPOCH) / DAY_MS);
  return pillarAt(DAY_EPOCH_INDEX + days);
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Видимая долгота Солнца в градусах (0–360) на момент времени */
export function sunLongitude(date: Date): number {
  const jd = date.getTime() / DAY_MS + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = rad(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * m) +
    0.000289 * Math.sin(3 * m);
  const omega = rad(125.04 - 1934.136 * t);
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(omega);
  return ((lambda % 360) + 360) % 360;
}

/** Номер месяца БаЦзы от 立春: 0 — 寅, 1 — 卯 … 11 — 丑 */
const solarMonth = (date: Date) => Math.floor(((sunLongitude(date) - 315 + 360) % 360) / 30);

/** Минут на градус долготы Солнца (в среднем) */
const MINUTES_PER_DEGREE = 1461;
/** Ближе этого к смене сезона месяц может выйти соседним: формула точна до ~15 минут, плюс часовой пояс */
const BOUNDARY_MINUTES = 60;

export interface Chart {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  /** Нет, если час рождения неизвестен */
  hour?: Pillar;
  /** Момент рядом со сменой сезона (или время не задано и сезон меняется в этот день) — месяц стоит сверить */
  nearBoundary: boolean;
}

/**
 * Карта на момент: дата (год, месяц 1–12, число) и, если известно, время «ЧЧ:ММ» по местным часам.
 * Без времени солнечный месяц считается на полдень.
 */
export function chartFor(y: number, m: number, d: number, time?: string): Chart {
  const [hh, mm] = time ? time.split(':').map(Number) : [12, 0];
  const moment = new Date(y, m - 1, d, hh, mm);
  const month = solarMonth(moment);
  // Январь–начало февраля до 立春 — месяцы 子 и 丑 прошлого года
  const year = m <= 2 && month >= 10 ? y - 1 : y;
  const yearIndex = (((year - 4) % 60) + 60) % 60;
  const yearStem = yearIndex % 10;
  // 甲/己 год начинается с 丙寅, 乙/庚 — с 戊寅 и т. д.
  const monthStem = ((yearStem % 5) * 2 + 2 + month) % 10;
  const day = dayPillar(y, m, d);
  const offset = (sunLongitude(moment) - 315 + 360) % 30;
  const nearBoundary = time
    ? Math.min(offset, 30 - offset) * MINUTES_PER_DEGREE < BOUNDARY_MINUTES
    : solarMonth(new Date(y, m - 1, d)) !== solarMonth(new Date(y, m - 1, d + 1));
  const chart: Chart = {
    year: pillarAt(yearIndex),
    month: pillarOf(monthStem, (month + 2) % 12),
    day,
    nearBoundary,
  };
  if (time) {
    const hourBranch = Math.floor((hh + 1) / 2) % 12;
    // 甲/己 день начинается с 甲子 часа
    const hourStem = (((day.index % 10) % 5) * 2 + hourBranch) % 10;
    chart.hour = pillarOf(hourStem, hourBranch);
  }
  return chart;
}

/** Сегодняшняя дата в виде «ГГГГ-ММ-ДД» по местному времени */
export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export const parseIso = (iso: string) => iso.split('-').map(Number) as [number, number, number];

/** Уникальные знаки карты по порядку: час, день, месяц, год; ствол перед ветвью */
export function chartChars(c: Chart): BaziChar[] {
  const pillars = [c.hour, c.day, c.month, c.year].filter((p): p is Pillar => !!p);
  const seen = new Set<string>();
  return pillars
    .flatMap((p) => [p.stem, p.branch])
    .filter((ch) => !seen.has(ch.id) && seen.add(ch.id));
}
