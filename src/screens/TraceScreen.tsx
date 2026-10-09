import { useEffect, useState } from 'react';
import { CharacterInfo } from '../components/CharacterCard';
import { SessionTop } from '../components/SessionTop';
import { WritingBoard } from '../components/WritingBoard';
import type { BaziChar } from '../data/characters';
import { strokeCount } from '../data/strokes';

export interface WriteResult {
  char: BaziChar;
  mistakes: number;
}

interface Props {
  chars: BaziChar[];
  onFinish: (results: WriteResult[]) => void;
  onExit: () => void;
}

/** После стольких ошибок на одной черте она показывается анимацией */
const HINT_AFTER = 2;

/** Режим «Обводка»: пишем по бледному контуру, каждая черта проверяется */
export function TraceScreen({ chars, onFinish, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<WriteResult[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [written, setWritten] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);

  const char = chars[index];
  const total = strokeCount(char.hanzi);
  const last = index === chars.length - 1;

  const restart = () => {
    setWritten(0);
    setMistakes(0);
    setDone(false);
    setAttempt((a) => a + 1);
  };

  const next = () => {
    // В итог идёт последняя попытка по знаку
    const all = [...results, { char, mistakes }];
    if (last) return onFinish(all);
    setResults(all);
    setIndex((i) => i + 1);
    restart();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  return (
    <main className="screen study">
      <SessionTop done={index + (done ? 1 : 0)} total={chars.length} onExit={onExit} />

      <section key={char.id} className="card card--study">
        <p className="card__prompt">Обведите знак по порядку черт</p>
        <WritingBoard
          hanzi={char.hanzi}
          outline
          hintAfterMisses={HINT_AFTER}
          attempt={attempt}
          onStroke={setWritten}
          onMistake={setMistakes}
          onComplete={(m) => {
            setMistakes(m);
            setDone(true);
          }}
        />
        <p className={`player__status ${done ? (mistakes ? 'is-bad' : 'is-ok') : ''}`}>
          {done
            ? mistakes
              ? `Готово · ошибок: ${mistakes}`
              : 'Готово · без ошибок'
            : `Черта ${Math.min(written + 1, total)} из ${total}${mistakes ? ` · ошибок: ${mistakes}` : ''}`}
        </p>
        <CharacterInfo char={char} />
      </section>

      <div className="study__nav">
        <button className="btn" onClick={restart}>
          ↺ Заново
        </button>
        <button className="btn btn--primary" onClick={next} disabled={!done}>
          {last ? 'Итоги' : 'Дальше →'}
        </button>
      </div>
      <p className="hint">Неверная черта не засчитывается. После {HINT_AFTER} ошибок на черте она покажется сама.</p>
    </main>
  );
}
