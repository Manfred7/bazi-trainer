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
  /** Высшее полученное звание (номер в RANKS) — звание не отнимается */
  bestRank: number;
  /** Когда присвоено каждое звание: местное время «ГГГГ-ММ-ДДTЧЧ:ММ» */
  awards: Award[];
}

export interface Award {
  rank: number;
  at: string;
}

export const EMPTY_JOURNAL: Journal = { charts: [], daily: [], focusChart: true, bestRank: 0, awards: [] };

const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Текущий момент по местным часам: «ГГГГ-ММ-ДДTЧЧ:ММ» */
export function nowAt(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${todayIso(now)}T${p(now.getHours())}:${p(now.getMinutes())}`;
}

/** Столпы момента присвоения: час, день, месяц, год */
export function awardChart(a: Award): Chart {
  const [date, time] = a.at.split('T');
  return chartFor(...parseIso(date), time);
}

/** «31.10.2026, 23:20» */
export function awardDate(a: Award): string {
  const [date, time] = a.at.split('T');
  return `${date.split('-').reverse().join('.')}, ${time}`;
}

/** Звания от from+1 до to получены сейчас; «Новичок» — в момент первого запуска */
export function withAwards(j: Journal, to: number, at = nowAt()): Journal {
  const have = new Set(j.awards.map((a) => a.rank));
  const added: Award[] = [];
  for (let r = 0; r <= to; r++) if (!have.has(r)) added.push({ rank: r, at });
  if (!added.length && to <= j.bestRank) return j;
  return { ...j, bestRank: Math.max(j.bestRank, to), awards: [...j.awards, ...added].sort((a, b) => a.rank - b.rank) };
}

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
      bestRank: Number.isInteger(parsed.bestRank) && parsed.bestRank! > 0 ? parsed.bestRank! : 0,
      awards: Array.isArray(parsed.awards)
        ? parsed.awards.filter((a): a is Award => !!a && Number.isInteger(a.rank) && typeof a.at === 'string' && AT.test(a.at))
        : [],
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
