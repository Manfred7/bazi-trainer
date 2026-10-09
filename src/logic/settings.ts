import { DECKS } from './decks';
import { DIRECTIONS } from './quiz';

export type Mode = 'study' | 'trace' | 'recall' | 'quiz';
export type Speed = 0.5 | 1 | 2;

export const MODES: { id: Mode; label: string }[] = [
  { id: 'study', label: 'Знакомство' },
  { id: 'trace', label: 'Обводка' },
  { id: 'recall', label: 'По памяти' },
  { id: 'quiz', label: 'Узнавание' },
];

export const SPEEDS: { id: Speed; label: string }[] = [
  { id: 0.5, label: 'Медленно' },
  { id: 1, label: 'Обычно' },
  { id: 2, label: 'Быстро' },
];

/** Знаков за сессию по памяти */
export const SESSION_LENGTHS = [5, 10, 20];
/** Вопросов за сессию узнавания */
export const QUIZ_LENGTHS = [10, 20, 40];

export interface Settings {
  mode: Mode;
  deckId: string;
  /** Скорость анимации черт */
  speed: Speed;
  length: number;
  quizLength: number;
  /** Направления узнавания */
  directionIds: string[];
  /** Все колоды доступны сразу, без порога */
  unlockAll: boolean;
}

const KEY = 'bazi-trainer:settings';

const DEFAULTS: Settings = {
  mode: 'study',
  deckId: 'stems',
  speed: 1,
  length: 10,
  quizLength: 20,
  directionIds: DIRECTIONS.map((d) => d.id),
  unlockAll: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const known = new Set(DIRECTIONS.map((d) => d.id));
    const directionIds = Array.isArray(parsed.directionIds) ? parsed.directionIds.filter((id) => known.has(id)) : [];
    return {
      mode: MODES.some((m) => m.id === parsed.mode) ? parsed.mode! : DEFAULTS.mode,
      deckId: DECKS.some((d) => d.id === parsed.deckId) ? parsed.deckId! : DEFAULTS.deckId,
      speed: SPEEDS.some((s) => s.id === parsed.speed) ? parsed.speed! : DEFAULTS.speed,
      length: SESSION_LENGTHS.includes(parsed.length ?? 0) ? parsed.length! : DEFAULTS.length,
      quizLength: QUIZ_LENGTHS.includes(parsed.quizLength ?? 0) ? parsed.quizLength! : DEFAULTS.quizLength,
      directionIds: directionIds.length ? directionIds : DEFAULTS.directionIds,
      unlockAll: parsed.unlockAll === true,
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
