import { strokeData } from '../data/strokes';
import { writerPadding } from './useHanziWriter';

/** Сколько подсказки под рукой: контур первых черт или точки, откуда начинается каждая черта */
export type Guide = 'half' | 'dots';

/** Поле данных черт Hanzi Writer: x 0…1024, y −124…900 (ось y вверх) */
const BOX = 1024;
const Y_FROM = -124;
const DOT_R = 24;

/** Положение знака на холсте — как в Positioner Hanzi Writer, чтобы подсказка легла точно под черты */
function placement(size: number) {
  const padding = writerPadding(size);
  const effective = size - 2 * padding;
  const scale = effective / BOX;
  const x = padding;
  const y = padding - Y_FROM * scale;
  return `translate(${x}, ${size - y}) scale(${scale}, ${-scale})`;
}

/** Сколько первых черт показывать контуром на ступени «Полуконтур» */
const halfCount = (total: number) => Math.ceil(total / 2);

/** Подсказка под клеткой письма: не ловит касания, рисуется цветом контура */
export function StrokeGuide({ hanzi, size, guide }: { hanzi: string; size: number; guide: Guide }) {
  const { strokes, medians } = strokeData(hanzi);
  return (
    <svg className="guide" width={size} height={size} aria-hidden>
      <g transform={placement(size)}>
        {guide === 'half'
          ? strokes.slice(0, halfCount(strokes.length)).map((d, i) => <path key={i} d={d} />)
          : medians.map(([[x, y]], i) => <circle key={i} cx={x} cy={y} r={DOT_R} />)}
      </g>
    </svg>
  );
}
