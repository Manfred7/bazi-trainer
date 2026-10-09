import { DECKS } from './decks';

export type Mode = 'study' | 'trace' | 'recall' | 'quiz';
export type Speed = 0.5 | 1 | 2;

export const MODES: { id: Mode; label: string; ready: boolean }[] = [
  { id: 'study', label: 'Знакомство', ready: true },
  { id: 'trace', label: 'Обводка', ready: false },
  { id: 'recall', label: 'По памяти', ready: false },
  { id: 'quiz', label: 'Узнавание', ready: false },
];

export const SPEEDS: { id: Speed; label: string }[] = [
  { id: 0.5, label: 'Медленно' },
  { id: 1, label: 'Обычно' },
  { id: 2, label: 'Быстро' },
];

export interface Settings {
  mode: Mode;
  deckId: string;
  /** Скорость анимации черт */
  speed: Speed;
}

const KEY = 'bazi-trainer:settings';

const DEFAULTS: Settings = {
  mode: 'study',
  deckId: 'stems',
  speed: 1,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      mode: MODES.some((m) => m.id === parsed.mode && m.ready) ? parsed.mode! : DEFAULTS.mode,
      deckId: DECKS.some((d) => d.id === parsed.deckId) ? parsed.deckId! : DEFAULTS.deckId,
      speed: SPEEDS.some((s) => s.id === parsed.speed) ? parsed.speed! : DEFAULTS.speed,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // хранилище недоступно (приватный режим и т. п.) — настройки живут до перезагрузки
  }
}
