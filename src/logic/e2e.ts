import { strokeData } from '../data/strokes';

/**
 * Тестовый мост для Playwright (e2e/). Включается, только если тест до загрузки страницы
 * поставил window.__BAZI_E2E__ = true; в обычной работе приложения ничего не делает.
 *
 * Отдаёт экранные координаты средних линий черт на текущей клетке — по ним тест ведёт
 * настоящую мышь (page.mouse), так проверяется и сама обработка ввода Hanzi Writer.
 */
declare global {
  interface Window {
    __BAZI_E2E__?: boolean;
    __bazi?: E2eApi;
  }
}

export type BoardKind = 'write' | 'order';

interface Board {
  kind: BoardKind;
  hanzi: string;
  /** Группа SVG, в координатах которой лежат данные черт (квадрат 1024, ось Y вверх) */
  group: () => SVGGraphicsElement | null;
}

export interface E2eApi {
  /** Средние линии черт последней показанной клетки этого вида, в пикселях окна */
  strokes: (kind?: BoardKind) => { hanzi: string; medians: [number, number][][] } | null;
}

const enabled = typeof window !== 'undefined' && window.__BAZI_E2E__ === true;
let boards: Board[] = [];

/** Клетка сообщает о себе; вернуть — снять регистрацию при размонтировании */
export function registerBoard(board: Board): () => void {
  if (!enabled) return () => {};
  boards.push(board);
  return () => {
    boards = boards.filter((b) => b !== board);
  };
}

function onScreen(b: Board): [number, number][][] | null {
  const m = b.group()?.getScreenCTM();
  if (!m) return null;
  return strokeData(b.hanzi).medians.map((median) =>
    median.map(([x, y]) => {
      const p = new DOMPoint(x, y).matrixTransform(m);
      return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] as [number, number];
    }),
  );
}

if (enabled) {
  window.__bazi = {
    strokes: (kind = 'write') => {
      const b = [...boards].reverse().find((x) => x.kind === kind);
      const medians = b && onScreen(b);
      return b && medians ? { hanzi: b.hanzi, medians } : null;
    },
  };
}
