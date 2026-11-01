import { writerPadding } from './useHanziWriter';

/** Поле данных черт Hanzi Writer: x 0…1024, y −124…900 (ось y вверх) */
export const BOX = 1024;
export const Y_FROM = -124;

/**
 * Положение знака на холсте — как в Positioner Hanzi Writer, чтобы подсказки и вопросы ложились
 * точно на черты. x/y — из поля данных в пиксели, toData — обратно (для нажатий)
 */
export function placement(size: number) {
  const padding = writerPadding(size);
  const scale = (size - 2 * padding) / BOX;
  return {
    padding,
    scale,
    x: (px: number) => padding + px * scale,
    y: (py: number) => size - padding + (Y_FROM - py) * scale,
    toData: (sx: number, sy: number) => [(sx - padding) / scale, Y_FROM - (sy - size + padding) / scale],
    /** transform для <g>, внутри которого рисуются пути черт из данных как есть */
    transform: `translate(${padding}, ${size - padding + Y_FROM * scale}) scale(${scale}, ${-scale})`,
  };
}

/** Точка на медиане черты на расстоянии dist от начала */
export function pointAlong(median: number[][], dist: number) {
  let left = dist;
  for (let i = 1; i < median.length; i++) {
    const [ax, ay] = median[i - 1];
    const [bx, by] = median[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (seg >= left) return [ax + ((bx - ax) * left) / seg, ay + ((by - ay) * left) / seg];
    left -= seg;
  }
  return median[median.length - 1];
}

/** Расстояние от точки до ломаной медианы черты (в единицах поля) */
export function distanceToMedian([px, py]: number[], median: number[][]) {
  let best = Infinity;
  for (let i = 1; i < median.length; i++) {
    const [ax, ay] = median[i - 1];
    const [bx, by] = median[i];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))));
  }
  return best;
}
