export type Theme = 'system' | 'light' | 'dark';

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'Авто' },
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
];

const DARK = '(prefers-color-scheme: dark)';
/** Цвет строки состояния и шапки установленного приложения — как фон страницы */
const BAR = { light: '#F5F0E6', dark: '#161514' } as const;

const resolve = (theme: Theme) => (theme === 'system' ? (window.matchMedia(DARK).matches ? 'dark' : 'light') : theme);

function apply(theme: Theme) {
  const t = resolve(theme);
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[t]);
}

/**
 * Применяет тему к странице; для «Как в системе» следит за сменой темы телефона.
 * Возвращает отписку. Тот же выбор до первой отрисовки делает скрипт в index.html.
 */
export function watchTheme(theme: Theme): () => void {
  apply(theme);
  if (theme !== 'system') return () => {};
  const media = window.matchMedia(DARK);
  const onChange = () => apply(theme);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
