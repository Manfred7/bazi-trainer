import type { BaziChar } from '../data/characters';
import type { WriteResult } from '../logic/session';

export interface SessionSummary {
  deckTitle: string;
  masteryBefore: number;
  masteryAfter: number;
  /** Названия колод, открывшихся за эту сессию */
  newlyUnlocked: string[];
}

interface Props {
  /** Письмо — считаем ошибки в чертах; узнавание — неверные ответы */
  kind: 'write' | 'quiz';
  results: WriteResult[];
  summary: SessionSummary;
  onRetryMistakes: (chars: BaziChar[]) => void;
  onRestart: () => void;
  onMenu: () => void;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Итоги сессии: сколько засчитано, как вырос прогресс, что стоит повторить */
export function ResultScreen({ kind, results, summary, onRetryMistakes, onRestart, onMenu }: Props) {
  const passed = results.filter((r) => r.ok).length;

  // По памяти знак может выпасть несколько раз — собираем по знаку
  const failed = new Map<string, { char: BaziChar; times: number; mistakes: number }>();
  for (const r of results) {
    if (r.ok) continue;
    const e = failed.get(r.char.id) ?? { char: r.char, times: 0, mistakes: 0 };
    e.times++;
    e.mistakes += r.mistakes;
    failed.set(r.char.id, e);
  }
  const hardest = [...failed.values()].sort((a, b) => b.mistakes - a.mistakes);

  return (
    <main className="screen result">
      <section className="result__score">
        <div className="result__pct">
          {passed}/{results.length}
        </div>
        <p className="muted">{kind === 'quiz' ? 'ответов верно' : 'знаков засчитано'}</p>
      </section>

      <section className="panel result__mastery">
        <div className="result__mastery-row">
          <span>Освоено: {summary.deckTitle}</span>
          <strong>
            {pct(summary.masteryBefore)} → {pct(summary.masteryAfter)}
          </strong>
        </div>
        <div className="bar">
          <div className="bar__fill" style={{ width: pct(summary.masteryAfter) }} />
        </div>
        {summary.newlyUnlocked.map((title) => (
          <p key={title} className="result__unlocked">
            Открыта колода «{title}»
          </p>
        ))}
      </section>

      {hardest.length > 0 ? (
        <section className="panel">
          <h2>Стоит повторить</h2>
          <ul className="mistakes">
            {hardest.map(({ char, times, mistakes }) => (
              <li key={char.id}>
                <span className="mistakes__char">
                  <span className={`hanzi mistakes__hanzi el-${char.element}`}>{char.hanzi}</span>
                  <span>
                    {char.ru} <span className="muted">{char.pinyin}</span>
                  </span>
                </span>
                <span className="mistakes__count">
                  {kind === 'quiz'
                    ? `×${times}`
                    : `ошибок: ${mistakes}${times > 1 ? ` (${times} раза)` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="result__perfect">{kind === 'quiz' ? 'Без ошибок' : 'Все знаки засчитаны'}</p>
      )}

      <div className="result__actions">
        {hardest.length > 0 && (
          <button className="btn btn--primary btn--wide" onClick={() => onRetryMistakes(hardest.map((m) => m.char))}>
            Повторить ошибки
          </button>
        )}
        <button className={`btn btn--wide ${hardest.length ? '' : 'btn--primary'}`} onClick={onRestart}>
          Ещё сессия
        </button>
        <button className="btn btn--ghost btn--wide" onClick={onMenu}>
          В меню
        </button>
      </div>
    </main>
  );
}
