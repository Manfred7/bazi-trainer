import { SIXTY, type Pillar, dayPillar, parseIso, todayIso } from '../logic/calendar';
import { knowsByHeart } from '../logic/path';
import type { Progress } from '../logic/progress';

interface Props {
  progress: Progress;
  /** Номера пар цикла из своих карт — отмечаются точкой */
  chartPairs: Set<number>;
  onExit: () => void;
}

/** Пара открыта, когда оба её знака освоены по памяти */
const pairOpen = (p: Progress, pillar: Pillar) => knowsByHeart(p, pillar.stem.id) && knowsByHeart(p, pillar.branch.id);

/** Цикл 60 пар 甲子 … 癸亥: карта прогресса по настоящему календарному циклу */
export function CycleScreen({ progress, chartPairs, onExit }: Props) {
  const today = dayPillar(...parseIso(todayIso())).index;
  const open = SIXTY.filter((p) => pairOpen(progress, p)).length;

  return (
    <main className="screen">
      <div className="quiz__top">
        <button className="icon-btn" onClick={onExit} aria-label="В меню">
          ←
        </button>
        <h1 className="screen__title">Цикл 60</h1>
      </div>
      <section className="panel">
        <div className="result__mastery-row">
          <span>Открыто пар</span>
          <strong>
            {open} из 60
          </strong>
        </div>
        <div className="bar">
          <div className="bar__fill" style={{ width: `${(open / 60) * 100}%` }} />
        </div>
        <p className="panel__note">
          Пара открывается, когда оба знака написаны по памяти. Рамка — столп сегодняшнего дня, точка — столп
          из ваших карт.
        </p>
      </section>
      <ol className="cycle">
        {SIXTY.map((p) => (
          <li
            key={p.index}
            className={`cycle__pair hanzi ${pairOpen(progress, p) ? 'is-open' : ''} ${p.index === today ? 'is-today' : ''}`}
            title={`${p.index + 1}. ${p.stem.ru.split(' ')[0]} ${p.branch.ru}`}
          >
            <span className={`el-${p.stem.element}`}>{p.stem.hanzi}</span>
            <span className={`el-${p.branch.element}`}>{p.branch.hanzi}</span>
            {chartPairs.has(p.index) && <i className="cycle__mark" aria-label="из карты" />}
          </li>
        ))}
      </ol>
    </main>
  );
}
