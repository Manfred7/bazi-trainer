import type { BaziChar } from '../data/characters';
import type { WriteResult } from './TraceScreen';

interface Props {
  title: string;
  results: WriteResult[];
  onRetryMistakes: (chars: BaziChar[]) => void;
  onRestart: () => void;
  onMenu: () => void;
}

/** Итоги сессии письма: сколько знаков без ошибок и какие стоит повторить */
export function ResultScreen({ title, results, onRetryMistakes, onRestart, onMenu }: Props) {
  const clean = results.filter((r) => r.mistakes === 0).length;
  const hardest = results.filter((r) => r.mistakes > 0).sort((a, b) => b.mistakes - a.mistakes);

  return (
    <main className="screen result">
      <section className="result__score">
        <div className="result__pct">
          {clean}/{results.length}
        </div>
        <p className="muted">{title}: знаков без ошибок</p>
      </section>

      {hardest.length > 0 ? (
        <section className="panel">
          <h2>Стоит повторить</h2>
          <ul className="mistakes">
            {hardest.map(({ char, mistakes }) => (
              <li key={char.id}>
                <span className="mistakes__char">
                  <span className={`hanzi mistakes__hanzi el-${char.element}`}>{char.hanzi}</span>
                  <span>
                    {char.ru} <span className="muted">{char.pinyin}</span>
                  </span>
                </span>
                <span className="mistakes__count">ошибок: {mistakes}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="result__perfect">Все знаки без ошибок</p>
      )}

      <div className="result__actions">
        {hardest.length > 0 && (
          <button className="btn btn--primary btn--wide" onClick={() => onRetryMistakes(hardest.map((r) => r.char))}>
            Повторить с ошибками
          </button>
        )}
        <button className={`btn btn--wide ${hardest.length ? '' : 'btn--primary'}`} onClick={onRestart}>
          Ещё раз
        </button>
        <button className="btn btn--ghost btn--wide" onClick={onMenu}>
          В меню
        </button>
      </div>
    </main>
  );
}
