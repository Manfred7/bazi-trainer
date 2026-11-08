import { useEffect, useState } from 'react';
import { CharacterInfo } from '../components/CharacterCard';
import { SessionTop } from '../components/SessionTop';
import { WritingBoard } from '../components/WritingBoard';
import type { BaziChar } from '../data/characters';
import { strokeCount } from '../data/strokes';
import { type WriteResult, isPass } from '../logic/session';
import { logEvent, logStrokeMistake } from '../logic/stats';

interface Props {
  chars: BaziChar[];
  /** Знак обведён впервые в сессии: записываем в прогресс */
  onResult: (r: WriteResult) => void;
  onFinish: (results: WriteResult[]) => void;
  onExit: () => void;
}

/** После стольких ошибок на одной черте она показывается анимацией */
const HINT_AFTER = 2;

/** Режим «Обводка»: пишем по бледному контуру, каждая черта проверяется */
export function TraceScreen({ chars, onResult, onFinish, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<WriteResult[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [written, setWritten] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);

  const char = chars[index];
  const total = strokeCount(char.hanzi);
  const last = index === chars.length - 1;

  const reset = () => {
    setWritten(0);
    setMistakes(0);
    setDone(false);
    setAttempt((a) => a + 1);
  };

  const complete = (m: number) => {
    setMistakes(m);
    setDone(true);
    logEvent(char.id, 'trace', { kind: 'done', mistakes: m });
    // В счёт идёт первая попытка: «Заново» — для практики, на прогресс не влияет
    if (results.length === index) {
      const r = { char, mistakes: m, ok: isPass(m) };
      setResults([...results, r]);
      onResult(r);
    }
  };

  /** «Заново» посреди знака записываем: на этой черте сбились; после конца знака это просто ещё раз */
  const again = () => {
    if (!done && (written > 0 || mistakes > 0)) logEvent(char.id, 'trace', { kind: 'restart', stroke: written });
    reset();
  };

  const next = () => {
    if (last) return onFinish(results);
    setIndex((i) => i + 1);
    reset();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  return (
    <main className="screen study" data-screen="trace">
      <SessionTop done={index + (done ? 1 : 0)} total={chars.length} onExit={onExit} />

      <section key={char.id} className="card card--study">
        <p className="card__prompt">Обведите знак по порядку черт</p>
        <WritingBoard
          hanzi={char.hanzi}
          outline
          hintAfterMisses={HINT_AFTER}
          attempt={attempt}
          onStroke={setWritten}
          onMistake={(s) => {
            setMistakes(s.totalMistakes);
            logStrokeMistake(char, 'trace', s);
          }}
          onComplete={complete}
        />
        <p className={`player__status ${done ? (isPass(mistakes) ? 'is-ok' : 'is-bad') : ''}`}>
          {done
            ? mistakes
              ? `Готово · ошибок: ${mistakes}`
              : 'Готово · без ошибок'
            : `Черта ${Math.min(written + 1, total)} из ${total}${mistakes ? ` · ошибок: ${mistakes}` : ''}`}
        </p>
        <CharacterInfo char={char} />
      </section>

      <div className="study__nav">
        <button className="btn" data-testid="restart" onClick={again}>
          ↺ Заново
        </button>
        <button className="btn btn--primary" data-testid="next" onClick={next} disabled={results.length <= index}>
          {last ? 'Итоги' : 'Дальше →'}
        </button>
      </div>
      <p className="hint">Неверная черта не засчитывается. После {HINT_AFTER} ошибок на черте она покажется сама.</p>
    </main>
  );
}
