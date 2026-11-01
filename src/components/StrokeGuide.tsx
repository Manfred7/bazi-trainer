import { strokeData } from '../data/strokes';
import { placement, pointAlong } from './geometry';

/** Сколько подсказки под рукой: контур первых черт или точки, откуда начинается каждая черта */
export type Guide = 'half' | 'dots';

/** Точки начала ближе этого (в единицах поля) сливаются в одну — у 寅 5 и 6, у 辰 4 и 5 */
const MERGE = 50;
/**
 * Номер стоит не на точке, а дальше вдоль черты — так он показывает и направление
 * (у 甲 черты 1 и 2 начинаются в одном углу: «1» — ниже угла, «2» — правее). Обычно на 80 единиц;
 * если там чужая точка или номер — дальше или ближе (BADGE_OFFSETS: на 22 знаках место находится всем).
 * Совпавшие номера сливаются в «5·6» — на всякий случай
 */
const BADGE_OFFSET = 80;
const BADGE_MERGE = 80;
/** Если номер упирается в чужую точку или другой номер — пробуем отодвинуть его дальше вдоль черты */
const BADGE_OFFSETS = [BADGE_OFFSET, 115, 150, 60, 185, 220, 45];
/** Зазоры в единицах поля: номер (r 36) от точки (r 24) и от другого номера */
const BADGE_CLEAR_DOT = 66;
const BADGE_CLEAR_BADGE = 78;
/** Длина стрелки направления от начала черты, в единицах поля */
const ARROW = 170;

/** Сколько первых черт показывать контуром на ступени «Полуконтур» */
const halfCount = (total: number) => Math.ceil(total / 2);

/**
 * Изломы черты: места, где направление поворачивает больше чем на CORNER_ANGLE на отрезке ±CORNER_SPAN
 * (у концов отрезок короче). Широкое окно ловит и острый угол, и пологий поворот: у 乙 — угол справа
 * вверху, поворот слева внизу и крючок справа внизу. На 22 знаках — 29 изломов, у черт без поворотов — ни одного
 */
const CORNER_ANGLE = 65;
const CORNER_SPAN = 200;
const CORNER_EDGE = 80;
const CORNER_GAP = 200;
const STEP = 10;

/** Медиана, переразбитая на точки через равные STEP единиц */
function resample(median: number[][]) {
  const out = [median[0]];
  let carry = 0;
  for (let i = 1; i < median.length; i++) {
    const [ax, ay] = median[i - 1];
    const [bx, by] = median[i];
    const seg = Math.hypot(bx - ax, by - ay);
    let d = STEP - carry;
    for (; d <= seg; d += STEP) out.push([ax + ((bx - ax) * d) / seg, ay + ((by - ay) * d) / seg]);
    carry = seg - (d - STEP);
  }
  return out;
}

function corners(median: number[][]) {
  const p = resample(median);
  const k = CORNER_SPAN / STEP;
  const total = (p.length - 1) * STEP;
  const found: { i: number; turn: number }[] = [];
  for (let i = 1; i < p.length - 1; i++) {
    if (i * STEP <= CORNER_EDGE || total - i * STEP <= CORNER_EDGE) continue;
    const back = Math.min(k, i);
    const ahead = Math.min(k, p.length - 1 - i);
    const a = Math.atan2(p[i][1] - p[i - back][1], p[i][0] - p[i - back][0]);
    const b = Math.atan2(p[i + ahead][1] - p[i][1], p[i + ahead][0] - p[i][0]);
    let turn = (Math.abs(a - b) * 180) / Math.PI;
    if (turn > 180) turn = 360 - turn;
    if (turn > CORNER_ANGLE) found.push({ i, turn });
  }
  // Из соседних кандидатов — самый острый
  const picked: { i: number; turn: number }[] = [];
  for (const c of found.sort((x, y) => y.turn - x.turn)) {
    if (picked.every((q) => Math.abs(q.i - c.i) * STEP > CORNER_GAP)) picked.push(c);
  }
  return picked.map((c) => p[c.i]);
}

const cornerCache = new Map<string, number[][][]>();
const cornersOf = (hanzi: string, medians: number[][][]) => {
  if (!cornerCache.has(hanzi)) cornerCache.set(hanzi, medians.map(corners));
  return cornerCache.get(hanzi)!;
};

/** Где ставить номер каждой черты: первая позиция вдоль черты, свободная от чужих точек и уже поставленных номеров */
function badgePositions(medians: number[][][]) {
  const starts = medians.map((m) => m[0]);
  const placed: number[][] = [];
  return medians.map((m, i) => {
    const free = (p: number[]) =>
      starts.every((s, j) => j === i || Math.hypot(s[0] - p[0], s[1] - p[1]) > BADGE_CLEAR_DOT) &&
      placed.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > BADGE_CLEAR_BADGE);
    const p = BADGE_OFFSETS.map((d) => pointAlong(m, d)).find(free) ?? pointAlong(m, BADGE_OFFSET);
    placed.push(p);
    return p;
  });
}

const badgeCache = new Map<string, number[][]>();
const badgesOf = (hanzi: string, medians: number[][][]) => {
  if (!badgeCache.has(hanzi)) badgeCache.set(hanzi, badgePositions(medians));
  return badgeCache.get(hanzi)!;
};

/** Слить близкие точки: каждая группа — одна метка с номерами черт */
function group(points: number[][], radius: number) {
  const groups: { at: number[]; strokes: number[] }[] = [];
  points.forEach((p, i) => {
    const g = groups.find((gr) => Math.hypot(gr.at[0] - p[0], gr.at[1] - p[1]) < radius);
    if (g) g.strokes.push(i);
    else groups.push({ at: p, strokes: [i] });
  });
  return groups;
}

/** Контур первых черт под тушью (полуконтур) */
export function GuideUnder({ hanzi, size }: { hanzi: string; size: number }) {
  const { strokes } = strokeData(hanzi);
  return (
    <svg className="guide" width={size} height={size} aria-hidden>
      <g transform={placement(size).transform}>
        {strokes.slice(0, halfCount(strokes.length)).map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

/**
 * «Взгляни и напиши»: знак целиком тушью поверх клетки на ms миллисекунд. Пока он виден, касания
 * перехватываются — писать поверх образца нельзя, иначе это обводка. Полоска внизу показывает, сколько осталось
 */
export function GuidePeek({ hanzi, size, ms }: { hanzi: string; size: number; ms: number }) {
  const { strokes } = strokeData(hanzi);
  return (
    <div className="peek" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <g transform={placement(size).transform}>
          {strokes.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </svg>
      <span className="peek__bar" style={{ animationDuration: `${ms}ms` }} />
    </div>
  );
}

interface OverProps {
  hanzi: string;
  size: number;
  guide: Guide;
  /** Сколько черт уже написано: их точки убираются, остальные видны поверх туши */
  written: number;
  /** Номера черт (первая попытка на «Точках») */
  numbered: boolean;
  /** Мигнуть точкой этой черты (ошибка); key — чтобы мигание перезапускалось */
  pulse: { stroke: number; key: number } | null;
  /** Подсказка: точка и стрелка направления этой черты */
  cue: number | null;
}

/**
 * Подсказки поверх клетки: точки начала ещё не написанных черт (на «Точках»), номера вдоль черт,
 * мигание точки ожидаемой черты при ошибке и подсказка «откуда и куда». Касаний не ловит.
 */
export function GuideOver({ hanzi, size, guide, written, numbered, pulse, cue }: OverProps) {
  const { medians } = strokeData(hanzi);
  const { scale, x, y } = placement(size);
  const r = Math.max(5, 24 * scale);
  const badge = Math.max(9, 36 * scale);
  const starts = medians.map((m) => m[0]);
  const left = (strokes: number[]) => strokes.filter((s) => s >= written);

  const arrow = (stroke: number) => {
    const m = medians[stroke];
    const [ex, ey] = pointAlong(m, ARROW);
    return <line className="guide__arrow" x1={x(m[0][0])} y1={y(m[0][1])} x2={x(ex)} y2={y(ey)} markerEnd="url(#guide-arrow)" />;
  };

  return (
    <svg className="guide guide--over" width={size} height={size} aria-hidden>
      <defs>
        <marker id="guide-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M1 1L8 5L1 9" />
        </marker>
      </defs>
      {/* Подсказка — под точками, чтобы номер черты оставался виден */}
      {cue !== null && cue >= written && cue < medians.length && (
        <g className="guide__cue">
          <circle cx={x(starts[cue][0])} cy={y(starts[cue][1])} r={r * 1.6} />
          {arrow(cue)}
        </g>
      )}
      {/* Слои снизу вверх: линии к номерам, номера, изломы, точки начала — цель внимания сверху */}
      {guide === 'dots' && numbered && (
        <>
          {/* Тонкая линия от точки к номеру — направление начала черты */}
          {medians.map((m, i) => {
            if (i < written) return null;
            const [bx, by] = badgesOf(hanzi, medians)[i];
            return <line key={i} className="guide__lead" x1={x(m[0][0])} y1={y(m[0][1])} x2={x(bx)} y2={y(by)} />;
          })}
          {group(badgesOf(hanzi, medians), BADGE_MERGE).map((g) => {
            const nums = left(g.strokes);
            if (!nums.length) return null;
            return (
              <g key={g.strokes[0]} className="guide__badge">
                <circle cx={x(g.at[0])} cy={y(g.at[1])} r={nums.length > 1 ? badge * 1.35 : badge} />
                <text x={x(g.at[0])} y={y(g.at[1])} fontSize={Math.max(10, badge * 1.05)}>
                  {nums.map((s) => s + 1).join('·')}
                </text>
              </g>
            );
          })}
        </>
      )}
      {/* Изломы ещё не написанных черт — полые кольца: где черта поворачивает */}
      {guide === 'dots' &&
        cornersOf(hanzi, medians).flatMap((cs, i) =>
          i < written
            ? []
            : cs.map(([cx, cy], k) => (
                <circle key={`${i}-${k}`} className="guide__corner" cx={x(cx)} cy={y(cy)} r={r * 0.8} />
              )),
        )}
      {guide === 'dots' &&
        group(starts, MERGE).map((g) =>
          left(g.strokes).length ? (
            <circle key={g.strokes[0]} className="guide__dot" cx={x(g.at[0])} cy={y(g.at[1])} r={r} />
          ) : null,
        )}
      {pulse && pulse.stroke < medians.length && (
        <circle
          key={pulse.key}
          className="guide__pulse"
          cx={x(starts[pulse.stroke][0])}
          cy={y(starts[pulse.stroke][1])}
          r={r * 1.6}
        />
      )}
    </svg>
  );
}
