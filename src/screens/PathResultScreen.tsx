import { Seal } from '../components/Seal';
import { type BaziChar, CHARACTERS } from '../data/characters';
import { STAGE_LABEL, type Stage, stageIndex, stageOf } from '../logic/path';
import type { Progress } from '../logic/progress';

interface Props {
  /** Ступени знаков сессии до её начала */
  before: { char: BaziChar; stage: Stage }[];
  progress: Progress;
  onAgain: () => void;
  onMenu: () => void;
}

function movedLabel(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'знак продвинулся';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'знака продвинулись';
  return 'знаков продвинулись';
}

/** Итоги пути: кто куда продвинулся, новые печати и что дальше */
export function PathResultScreen({ before, progress, onAgain, onMenu }: Props) {
  const moves = before.map(({ char, stage }) => ({ char, from: stage, to: stageOf(progress, char.id) }));
  const up = moves.filter((m) => stageIndex(m.to) > stageIndex(m.from)).length;
  const done = CHARACTERS.filter((c) => stageOf(progress, c.id) === 'done').length;
  const paperNext = moves.some((m) => m.to === 'paper');

  return (
    <main className="screen result">
      <section className="result__score">
        <div className="result__pct">{up}</div>
        <p className="muted">{movedLabel(up)} по пути</p>
      </section>

      <section className="panel">
        <h2>Знаки сессии</h2>
        <ul className="mistakes">
          {moves.map(({ char, from, to }) => {
            const d = stageIndex(to) - stageIndex(from);
            return (
              <li key={char.id}>
                <span className="mistakes__char">
                  <Seal char={char} progress={progress} />
                  <span>
                    {char.ru} <span className="muted">{char.pinyin}</span>
                  </span>
                </span>
                <span className={`move ${d > 0 ? 'move--up' : d < 0 ? 'move--down' : ''}`}>
                  {d ? `${STAGE_LABEL[from]} → ${STAGE_LABEL[to]}` : STAGE_LABEL[to]}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel">
        <div className="result__mastery-row">
          <span>Печатей поставлено</span>
          <strong>
            {done} из {CHARACTERS.length}
          </strong>
        </div>
        <div className="bar">
          <div className="bar__fill" style={{ width: `${(done / CHARACTERS.length) * 100}%` }} />
        </div>
        {paperNext && <p className="panel__note">Следующий шаг для части знаков — тетрадь: держите её рядом.</p>}
      </section>

      <div className="result__actions">
        <button className="btn btn--primary btn--wide" onClick={onAgain}>
          Ещё шаг по пути
        </button>
        <button className="btn btn--ghost btn--wide" onClick={onMenu}>
          В меню
        </button>
      </div>
    </main>
  );
}
