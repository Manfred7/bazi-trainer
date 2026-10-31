import { type Chart, chartFor, parseIso, todayIso } from './calendar';

/** Карта человека: имя и момент рождения. Первая в списке — своя */
export interface SavedChart {
  id: string;
  name: string;
  /** «ГГГГ-ММ-ДД» */
  date: string;
  /** «ЧЧ:ММ» по местным часам; нет — час неизвестен */
  time?: string;
}

export interface Journal {
  charts: SavedChart[];
  /** Дни («ГГГГ-ММ-ДД»), когда столп дня записан в тетрадь */
  daily: string[];
  /** Учить по пути сначала знаки своей карты */
  focusChart: boolean;
}

export const EMPTY_JOURNAL: Journal = { charts: [], daily: [], focusChart: true };

const KEY = 'bazi-trainer:journal';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const isChart = (c: unknown): c is SavedChart => {
  const x = c as SavedChart;
  return !!x && typeof x.id === 'string' && typeof x.name === 'string' && ISO.test(x.date) && (x.time === undefined || TIME.test(x.time));
};

export function loadJournal(): Journal {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_JOURNAL;
    const parsed = JSON.parse(raw) as Partial<Journal>;
    return {
      charts: Array.isArray(parsed.charts) ? parsed.charts.filter(isChart) : [],
      daily: Array.isArray(parsed.daily) ? parsed.daily.filter((d) => typeof d === 'string' && ISO.test(d)) : [],
      focusChart: parsed.focusChart !== false,
    };
  } catch {
    return EMPTY_JOURNAL;
  }
}

export function saveJournal(j: Journal) {
  try {
    localStorage.setItem(KEY, JSON.stringify(j));
  } catch {
    // хранилище недоступно — журнал живёт до перезагрузки
  }
}

export const chartOf = (c: SavedChart): Chart => chartFor(...parseIso(c.date), c.time);

export const newChartId =() => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Сколько дней подряд записан столп дня, считая сегодня (или вчера, если сегодня ещё нет) */
export function dailyStreak(daily: string[], now = new Date()): number {
  const days = new Set(daily);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(todayIso(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(todayIso(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
