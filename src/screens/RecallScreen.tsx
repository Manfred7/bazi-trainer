import { useEffect, useRef, useState } from 'react';
import { SessionTop } from '../components/SessionTop';
import { type BoardHandle, WritingBoard } from '../components/WritingBoard';
import { type BaziChar, ELEMENTS, YIN_YANG } from '../data/characters';
import { PASS_MISTAKES, type WriteResult, isPass, pickNext } from '../logic/session';

interface Props {
  /** Из каких знаков спрашивать */
  pool: BaziChar[];
  length: number;
  levelOf: (charId: string) => number;
  /** Знак написан: сразу записываем в прогресс */
  onResult: (r: WriteResult) => void;
  onFinish: (results: WriteResult[]) => void;
  onExit: () => void;
}

/** Режим «По памяти»: пустая клетка, сверху чтение и значение — написать знак целиком */
export function RecallScreen({ pool, length, levelOf, onResult, onFinish, onExit }: Props) {
  const [results, setResults] = useState<WriteResult[]>([]);
  const [char, setChar] = useState(() => pickNext(pool, [], levelOf));
  const [written, setWritten] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [result, setResult] = useState<WriteResult | null>(null);
  const board = useRef<BoardHandle>(null);

  // Подсказанная черта считается ошибкой
  const score = mistakes + hints;
  const last = results.length + 1 >= length;

  const complete = (m: number) => {
    const r = { char, mistakes: m + hints, ok: isPass(m + hints) };
    setMistakes(m);
    setResult(r);
    onResult(r);
  };

  const next = () => {
    if (!result) return;
    const all = [...results, result];
    if (last) return onFinish(all);
    setResults(all);
    setChar(pickNext(pool, all, levelOf));
    setWritten(0);
    setMistakes(0);
    setHints(0);
    setResult(null);
  };

  const hint = () => {
    board.current?.hint();
    setHints((h) => h + 1);
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
      <SessionTop done={results.length + (result ? 1 : 0)} total={length} onExit={onExit} />

      <section key={`${results.length}-${char.id}`} className="card card--study">
        <div className="ask">
          <p className="ask__reading">
            <span className="info__ru">{char.ru}</span>
            <span className="info__pinyin">{char.pinyin}</span>
          </p>
          <p className="info__tags">
            <span className={`tag el-${char.element}`}>{ELEMENTS[char.element]}</span>
            <span className="tag">{YIN_YANG[char.yinYang]}</span>
            {char.animal && <span className={`tag el-${char.element}`}>{char.animal}</span>}
            <span className="tag tag--muted">{char.kind === 'stem' ? 'ствол' : 'ветвь'}</span>
          </p>
        </div>

        <WritingBoard
          ref={board}
          hanzi={char.hanzi}
          outline={false}
          hintAfterMisses={false}
          attempt={0}
          onStroke={setWritten}
          onMistake={setMistakes}
          onComplete={complete}
        />

        <p className={`player__status ${result ? (result.ok ? 'is-ok' : 'is-bad') : ''}`}>
          {result
            ? `${result.ok ? 'Засчитано' : 'Не засчитано'} · ошибок: ${result.mistakes}`
            : // Сколько всего черт, не показываем: это тоже подсказка
              `Написано черт: ${written}${score ? ` · ошибок: ${score}` : ''}`}
        </p>
      </section>

      <div className="study__nav">
        {result ? (
          <button className="btn" onClick={() => board.current?.animate()}>
            ▶ Порядок черт
          </button>
        ) : (
          <button className="btn" onClick={hint}>
            Подсказка
          </button>
        )}
        <button className="btn btn--primary" onClick={next} disabled={!result}>
          {last ? 'Итоги' : 'Дальше →'}
        </button>
      </div>
      <p className="hint">
        Знак засчитан, если ошибок не больше {PASS_MISTAKES}. Подсказка показывает следующую черту и считается
        ошибкой.
      </p>
    </main>
  );
}
