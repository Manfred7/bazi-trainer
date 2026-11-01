import { useState } from 'react';
import { strokeData } from '../data/strokes';
import { distanceToMedian, placement } from './geometry';
import { PracticeGrid } from './PracticeGrid';
import { useSquareSize } from './useSquareSize';

/** Нажатие дальше этого от любой оставшейся черты (в единицах поля) — мимо, не ответ */
const HIT = 110;
/** Нажатие так близко к ожидаемой черте — засчитывается ей, даже если рядом проходит другая (пересечение черт) */
const ON_STROKE = 40;
const FLASH_MS = 700;

interface Props {
  hanzi: string;
  /** Сколько черт уже написано тушью */
  written: number;
  /** Ответ засчитан: нажата черта written; иначе — номер нажатой (неверной) черты */
  onAnswer: (stroke: number) => void;
  /** Показать верную черту после ошибки */
  reveal: boolean;
}

/**
 * «Какая черта следующая?»: написанные черты — тушью, остальные — бледным контуром.
 * Нажимаем на черту, которая пишется дальше; черта определяется по ближайшей средней линии
 */
export function OrderBoard({ hanzi, written, onAnswer, reveal }: Props) {
  const { ref, size } = useSquareSize(true);
  const { strokes, medians } = strokeData(hanzi);
  const geo = placement(size);
  const [wrong, setWrong] = useState<{ stroke: number; key: number } | null>(null);

  const tap = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const point = geo.toData(e.clientX - box.left, e.clientY - box.top);
    let best = -1;
    let bestDist = HIT;
    medians.forEach((m, i) => {
      if (i < written) return;
      const d = distanceToMedian(point, m);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (written < medians.length && distanceToMedian(point, medians[written]) < ON_STROKE) best = written;
    if (best < 0) return;
    if (best !== written) {
      const key = Date.now();
      setWrong({ stroke: best, key });
      setTimeout(() => setWrong((w) => (w?.key === key ? null : w)), FLASH_MS);
    }
    onAnswer(best);
  };

  return (
    <div ref={ref} className="player__stage">
      <PracticeGrid size={size}>
        <svg className="order" width={size} height={size} onPointerDown={tap} role="img" aria-label="Знак: нажмите следующую черту">
          <g transform={geo.transform}>
            {strokes.map((d, i) => (
              <path
                key={i}
                d={d}
                className={
                  i < written
                    ? 'order__done'
                    : wrong?.stroke === i
                      ? 'order__wrong'
                      : reveal && i === written
                        ? 'order__reveal'
                        : 'order__left'
                }
              />
            ))}
          </g>
        </svg>
      </PracticeGrid>
    </div>
  );
}
