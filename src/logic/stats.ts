import type { StrokeData } from 'hanzi-writer';
import { distanceToMedian, pointAlong } from '../components/geometry';
import { type BaziChar, CHARACTERS } from '../data/characters';
import { strokeCount, strokeData } from '../data/strokes';
import { todayIso } from './calendar';
import { optionHanzi } from './quiz';

/**
 * Личная статистика: журнал событий обучения. Живёт только на устройстве, наружу ничего не уходит.
 * Хранит знак, ступень/режим, номер черты, тип ошибки и день — без времени суток и без точек штриха.
 * Карты рождения и всё из journal.ts сюда не попадают.
 */

export type MistakeType = 'order' | 'direction' | 'shape';
export type PaperReason = 'ok' | 'order' | 'forgot';

export type StatBody =
  /** Черта не засчитана */
  | { kind: 'mistake'; stroke: number; type: MistakeType }
  /** Нажата подсказка на этой черте */
  | { kind: 'hint'; stroke: number }
  /** «Заново» до конца знака: на этой черте */
  | { kind: 'restart'; stroke: number }
  /** Знак дописан; mistakes — сколько ошибок в этой попытке */
  | { kind: 'done'; mistakes: number }
  /** Знак спустился на ступень ниже */
  | { kind: 'demote' }
  /** Самооценка в тетради */
  | { kind: 'paper'; reason: PaperReason }
  /** Неверный вариант в узнавании; lookalike — знак из пары похожих (LOOKALIKES) */
  | { kind: 'quiz'; picked: string; lookalike: boolean };

export type StatEvent = {
  /** «ГГГГ-ММ-ДД» */
  day: string;
  /** id знака */
  char: string;
  /** Ступень пути или режим: trace, half, glance, recall, paper, quiz:… */
  mode: string;
} & StatBody;

export interface Stats {
  events: StatEvent[];
  /** Свёртка старых событий: «ГГГГ-ММ» → счётчики (mistake:order, hint, done, strokes…) */
  months: Record<string, Record<string, number>>;
}

export const EMPTY_STATS: Stats = { events: [], months: {} };

/** Журнал держит столько дней и событий, старое сворачивается в месячные счётчики */
export const KEEP_DAYS = 90;
export const KEEP_EVENTS = 5000;

/**
 * Дальше этого (в единицах поля 1024) штрих уже не похож на черту: так каракули не считаются ошибкой порядка.
 * Палец на клетке 300 пикселей промахивается пикселей на 30–40 — это около 100–140 единиц.
 */
const ORDER_MAX_DIST = 140;
const MEDIAN_SAMPLES = 9;

const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

const pathLength = (line: number[][]) =>
  line.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - line[i][0], y - line[i][1]), 0);

/**
 * Среднее расстояние между штрихом и медианой черты — большее из двух направлений: короткий мазок
 * лежит на многих чертах, но черта от него далеко, поэтому на целую черту он не похож
 */
function strokeDistance(drawn: number[][], median: number[][]) {
  const length = pathLength(median);
  const samples = Array.from({ length: MEDIAN_SAMPLES }, (_, i) => pointAlong(median, (length * i) / (MEDIAN_SAMPLES - 1)));
  return Math.max(mean(drawn.map((p) => distanceToMedian(p, median))), mean(samples.map((p) => distanceToMedian(p, drawn))));
}

/**
 * Тип ошибки на черте. Обратное направление сообщает сам Hanzi Writer. Штрих ближе к другой, ещё
 * не написанной черте, чем к ожидаемой, — вероятно, порядок. Всё остальное — форма или место.
 * Точки штриха нужны только здесь и дальше не идут. Hanzi Writer отдаёт их в единицах поля, как и медианы.
 */
export function classifyMistake(
  { isBackwards, strokeNum, drawnPath }: Pick<StrokeData, 'isBackwards' | 'strokeNum' | 'drawnPath'>,
  medians: number[][][],
): MistakeType {
  if (isBackwards) return 'direction';
  const drawn = drawnPath.points.map((p) => [p.x, p.y]);
  if (drawn.length < 2) return 'shape';
  const expected = strokeDistance(drawn, medians[strokeNum]);
  const later = medians.slice(strokeNum + 1).map((m) => strokeDistance(drawn, m));
  return later.some((d) => d < expected && d <= ORDER_MAX_DIST) ? 'order' : 'shape';
}

/** На какой счётчик месяца ложится событие */
function counterOf(e: StatEvent) {
  switch (e.kind) {
    case 'mistake':
      return `mistake:${e.type}`;
    case 'paper':
      return `paper:${e.reason}`;
    default:
      return e.kind;
  }
}

const byId = new Map(CHARACTERS.map((c) => [c.id, c]));

const strokesOf = (charId: string) => {
  const c = byId.get(charId);
  return c ? strokeCount(c.hanzi) : 0;
};

const daysBefore = (today: string, n: number) => {
  const [y, m, d] = today.split('-').map(Number);
  return todayIso(new Date(y, m - 1, d - n));
};

/** Старше KEEP_DAYS и сверх KEEP_EVENTS — в месячные счётчики; если сворачивать нечего, тот же объект */
export function compact(s: Stats, today = todayIso()): Stats {
  const from = daysBefore(today, KEEP_DAYS);
  const fresh = s.events.filter((e) => e.day >= from);
  const kept = fresh.slice(Math.max(0, fresh.length - KEEP_EVENTS));
  if (kept.length === s.events.length) return s;
  const keptSet = new Set(kept);
  const months = { ...s.months };
  for (const e of s.events) {
    if (keptSet.has(e)) continue;
    const month = e.day.slice(0, 7);
    const m = { ...months[month] };
    const key = counterOf(e);
    m[key] = (m[key] ?? 0) + 1;
    if (e.kind === 'done') m.strokes = (m.strokes ?? 0) + strokesOf(e.char);
    months[month] = m;
  }
  return { events: kept, months };
}

const KEY = 'bazi-trainer:stats';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isCount = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;

function isEvent(x: unknown): x is StatEvent {
  const e = x as StatEvent;
  if (!e || typeof e.char !== 'string' || typeof e.mode !== 'string' || typeof e.day !== 'string' || !ISO.test(e.day)) return false;
  switch (e.kind) {
    case 'mistake':
      return isCount(e.stroke) && ['order', 'direction', 'shape'].includes(e.type);
    case 'hint':
    case 'restart':
      return isCount(e.stroke);
    case 'done':
      return isCount(e.mistakes);
    case 'demote':
      return true;
    case 'paper':
      return ['ok', 'order', 'forgot'].includes(e.reason);
    case 'quiz':
      return typeof e.picked === 'string';
    default:
      return false;
  }
}

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATS;
    const parsed = JSON.parse(raw) as Partial<Stats>;
    return {
      events: Array.isArray(parsed.events) ? parsed.events.filter(isEvent) : [],
      months: parsed.months && typeof parsed.months === 'object' ? parsed.months : {},
    };
  } catch {
    return EMPTY_STATS;
  }
}

function saveStats(s: Stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // хранилище недоступно или полно — статистика не важнее письма, просто не пишем
  }
}

export function clearStats() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // хранилище недоступно — стирать нечего
  }
}

export function addEvent(s: Stats, char: string, mode: string, body: StatBody, today = todayIso()): Stats {
  return compact({ ...s, events: [...s.events, { day: today, char, mode, ...body }] }, today);
}

/** Записать событие сразу в хранилище: журнал нужен только экрану статистики, в состоянии приложения он не живёт */
export function logEvent(char: string, mode: string, body: StatBody) {
  saveStats(addEvent(loadStats(), char, mode, body));
}

/** Черта не засчитана: определить тип и записать; сам штрих не сохраняется */
export function logStrokeMistake(char: BaziChar, mode: string, s: StrokeData) {
  const type = classifyMistake(s, strokeData(char.hanzi).medians);
  logEvent(char.id, mode, { kind: 'mistake', stroke: s.strokeNum, type });
}

/* ---------- Сводка для экрана «Моя статистика» ---------- */

export type TroubleType = MistakeType | 'hint';

export interface PeriodSummary {
  counts: Record<TroubleType, number>;
  /** Сколько всего ошибок и подсказок */
  total: number;
  /** Ошибок на 100 написанных черт; null — черт за период не было */
  rate: number | null;
  /** Знаков, написанных без единой ошибки */
  clean: number;
}

export interface StatsSummary {
  /** Дней с занятиями и написанных черт за MONTH_DAYS */
  days: number;
  strokes: number;
  /** Черт за всё время, вместе со свёрнутыми месяцами */
  allStrokes: number;
  hardChars: { char: BaziChar; per100: number; mistakes: number }[];
  hardStrokes: { char: BaziChar; stroke: number; count: number; top: TroubleType }[];
  week: PeriodSummary;
  prevWeek: PeriodSummary;
  month: PeriodSummary;
  pairs: { a: string; b: string; count: number; lookalike: boolean }[];
  /** Знаки, у которых последние STEADY_RUN раз — без ошибок */
  steady: BaziChar[];
}

const WEEK_DAYS = 7;
export const MONTH_DAYS = 30;
const TOP = 5;
/** Одна случайная ошибка ещё не делает знак или черту трудными */
const HARD_MIN = 2;
const STEADY_RUN = 3;

const strokesIn = (events: StatEvent[]) =>
  events.reduce((sum, e) => sum + (e.kind === 'done' ? strokesOf(e.char) : 0), 0);

function summarizePeriod(events: StatEvent[]): PeriodSummary {
  const counts: Record<TroubleType, number> = { order: 0, direction: 0, shape: 0, hint: 0 };
  let clean = 0;
  for (const e of events) {
    if (e.kind === 'mistake') counts[e.type]++;
    else if (e.kind === 'hint') counts.hint++;
    else if (e.kind === 'done' && e.mistakes === 0) clean++;
  }
  const mistakes = counts.order + counts.direction + counts.shape;
  const strokes = strokesIn(events);
  return { counts, total: mistakes + counts.hint, rate: strokes ? (mistakes / strokes) * 100 : null, clean };
}

function hardCharsOf(recent: StatEvent[]) {
  return CHARACTERS.map((char) => {
    const mine = recent.filter((e) => e.char === char.id);
    const mistakes = mine.filter((e) => e.kind === 'mistake').length;
    // Брошенный знак в «написанные» не попал, но черты в нём были: хотя бы один знак в знаменателе
    const strokes = Math.max(1, mine.filter((e) => e.kind === 'done').length) * strokeCount(char.hanzi);
    return { char, mistakes, per100: Math.round((mistakes / strokes) * 100) };
  })
    .filter((x) => x.mistakes >= HARD_MIN)
    .sort((a, b) => b.per100 - a.per100 || b.mistakes - a.mistakes)
    .slice(0, TOP);
}

function hardStrokesOf(recent: StatEvent[]) {
  const perStroke = new Map<string, { char: BaziChar; stroke: number; counts: Partial<Record<TroubleType, number>> }>();
  for (const e of recent) {
    if (e.kind !== 'mistake' && e.kind !== 'hint') continue;
    const key = `${e.char}:${e.stroke}`;
    const entry = perStroke.get(key) ?? { char: byId.get(e.char)!, stroke: e.stroke, counts: {} };
    const type = e.kind === 'hint' ? 'hint' : e.type;
    entry.counts[type] = (entry.counts[type] ?? 0) + 1;
    perStroke.set(key, entry);
  }
  return [...perStroke.values()]
    .map(({ char, stroke, counts }) => {
      const sorted = (Object.entries(counts) as [TroubleType, number][]).sort((a, b) => b[1] - a[1]);
      return { char, stroke, top: sorted[0][0], count: sorted.reduce((sum, [, n]) => sum + n, 0) };
    })
    .filter((x) => x.count >= HARD_MIN)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP);
}

/** Какие знаки принимают друг за друга в узнавании; вопросы про стихии (там вариант — не знак) не в счёт */
function pairsOf(recent: StatEvent[]) {
  const pairs = new Map<string, StatsSummary['pairs'][number]>();
  for (const e of recent) {
    if (e.kind !== 'quiz') continue;
    const a = byId.get(e.char)!.hanzi;
    const b = optionHanzi(e.picked);
    if (!b) continue;
    const key = [a, b].sort().join('');
    const entry = pairs.get(key) ?? { a, b, count: 0, lookalike: false };
    entry.count++;
    entry.lookalike ||= e.lookalike;
    pairs.set(key, entry);
  }
  return [...pairs.values()].sort((x, y) => Number(y.lookalike) - Number(x.lookalike) || y.count - x.count).slice(0, TOP);
}

export function summarize(s: Stats, today = todayIso()): StatsSummary {
  const since = (n: number) => daysBefore(today, n - 1);
  const known = s.events.filter((e) => byId.has(e.char));
  const recent = known.filter((e) => e.day >= since(MONTH_DAYS));
  const week = known.filter((e) => e.day >= since(WEEK_DAYS));
  const prevWeek = known.filter((e) => e.day >= since(WEEK_DAYS * 2) && e.day < since(WEEK_DAYS));

  const steady = CHARACTERS.filter((c) => {
    const last = known.filter((e) => e.char === c.id && e.kind === 'done').slice(-STEADY_RUN);
    return last.length === STEADY_RUN && last.every((e) => e.kind === 'done' && e.mistakes === 0);
  });

  return {
    days: new Set(recent.map((e) => e.day)).size,
    strokes: strokesIn(recent),
    allStrokes: strokesIn(known) + Object.values(s.months).reduce((sum, m) => sum + (m.strokes ?? 0), 0),
    hardChars: hardCharsOf(recent),
    hardStrokes: hardStrokesOf(recent),
    week: summarizePeriod(week),
    prevWeek: summarizePeriod(prevWeek),
    month: summarizePeriod(recent),
    pairs: pairsOf(recent),
    steady,
  };
}
