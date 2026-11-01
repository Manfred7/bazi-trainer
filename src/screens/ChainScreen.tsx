import { useEffect, useRef, useState } from 'react';
import { SessionTop } from '../components/SessionTop';
import { type BoardHandle, WritingBoard } from '../components/WritingBoard';
import { CHAIN_PASS_MISTAKES, type Chain, isCleanChain } from '../logic/chain';
import { logEvent, logStrokeMistake } from '../logic/stats';

const MODE = 'chain';
/** Пауза после знака: увидеть его написанным, прежде чем клетка очистится для следующего */
const NEXT_MS = 600;
/** Столбцы карты слева направо — как в «Моей карте»: час, день, месяц, год (номера столпов в порядке письма) */
const COLUMNS = [3, 2, 1, 0];

interface Props {
  chain: Chain;
  /** Сколько дней с чистой цепочкой и сколько нужно для звания */
  cleanDays: number;
  needDays: number;
  onDone: (clean: boolean) => void;
  onAgain: () => void;
  onExit: () => void;
}

/**
 * Цепочка: восемь знаков четырёх столпов подряд, по памяти. Для пальца восемь клеток на одном экране малы,
 * поэтому сверху вся карта с чтениями, куда складываются написанные знаки, а писать — в одной большой клетке.
 */
export function ChainScreen({ chain, cleanDays, needDays, onDone, onAgain, onExit }: Props) {
  const { cells } = chain;
  const board = useRef<BoardHandle>(null);
  /** Ошибки написанных знаков, по клеткам */
  const [scores, setScores] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [written, setWritten] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  /** Ошибки брошенных попыток знака: «Заново» их не стирает */
  const [carry, setCarry] = useState(0);
  const [hints, setHints] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const finished = scores.length === cells.length;
  const waiting = scores.length > index;
  const total = scores.reduce((a, b) => a + b, 0) + carry + mistakes + hints;
  const cell = cells[index];

  useEffect(() => {
    if (!waiting || finished) return;
    const t = setTimeout(() => setIndex(scores.length), NEXT_MS);
    return () => clearTimeout(t);
  }, [waiting, finished, scores.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const complete = (m: number) => {
    const sum = carry + m + hints;
    const next = [...scores, sum];
    logEvent(cell.char.id, MODE, { kind: 'done', mistakes: sum });
    setScores(next);
    setWritten(0);
    setMistakes(0);
    setCarry(0);
    setHints(0);
    if (next.length === cells.length) onDone(isCleanChain(next.reduce((a, b) => a + b, 0)));
  };

  const hint = () => {
    board.current?.hint();
    setHints((h) => h + 1);
    logEvent(cell.char.id, MODE, { kind: 'hint', stroke: written });
  };

  const restart = () => {
    logEvent(cell.char.id, MODE, { kind: 'restart', stroke: written });
    setCarry((c) => c + mistakes);
    setMistakes(0);
    setWritten(0);
    setAttempt((a) => a + 1);
  };

  return (
    <main className="screen study path">
      <SessionTop done={scores.length} total={cells.length} onExit={onExit} />

      <section className="card card--study">
        <div className="stage-chip">
          <span>Цепочка · {chain.label}</span>
        </div>
        <div className={`chain-map ${finished ? 'chain-map--done' : ''}`}>
          {COLUMNS.map((p) => (
            <div key={p} className="chain-map__col">
              <span className="pillar__title">{cells[p * 2].pillar}</span>
              {[p * 2, p * 2 + 1].map((i) => {
                const { char } = cells[i];
                const isWritten = i < scores.length;
                return (
                  <span
                    key={i}
                    className={`chain-cell el-${char.element} ${i === index && !waiting ? 'is-current' : ''} ${isWritten ? 'is-written hanzi' : ''} ${isWritten && scores[i] ? 'is-bad' : ''}`}
                  >
                    {isWritten ? char.hanzi : char.ru.split(' ')[0]}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        {finished ? (
          <>
            <p className={`player__status ${isCleanChain(total) ? 'is-ok' : 'is-bad'}`}>
              {isCleanChain(total)
                ? `Чистая цепочка${total ? ` · ошибок: ${total}` : ''}`
                : `Ошибок: ${total}. Для зачёта — не больше ${CHAIN_PASS_MISTAKES}`}
            </p>
            <p className="muted">
              Дней с чистой цепочкой: {Math.min(cleanDays, needDays)} из {needDays}. За день засчитывается один раз.
            </p>
          </>
        ) : (
          <>
            <p className="card__prompt">
              {cell.pillar}, {cell.part}: <strong>{cell.char.ru.split(' ')[0]}</strong> {cell.char.pinyin}
            </p>
            <WritingBoard
              key={index}
              ref={board}
              hanzi={cell.char.hanzi}
              outline={false}
              hintAfterMisses={false}
              attempt={attempt}
              fit
              onStroke={setWritten}
              onMistake={(s) => {
                setMistakes(s.totalMistakes);
                logStrokeMistake(cell.char, MODE, s);
              }}
              onComplete={complete}
            />
            <div className="step-row">
              <p className="player__status">
                Знак {Math.min(index + 1, cells.length)} из {cells.length}
                {total ? ` · ошибок: ${total}` : ''}
              </p>
              {!waiting && (
                <div className="step-row__actions">
                  {(written > 0 || mistakes > 0) && (
                    <button className="btn btn--small btn--icon" onClick={restart} aria-label="Заново" title="Заново — ошибки останутся в счёте">
                      ↺
                    </button>
                  )}
                  <button className="btn btn--small" onClick={hint} title="Подсказка считается ошибкой">
                    Подсказка
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {finished && (
        <div className="study__nav">
          <button className="btn" onClick={onExit}>
            В меню
          </button>
          <button className="btn btn--primary" onClick={onAgain}>
            Ещё цепочка
          </button>
        </div>
      )}
    </main>
  );
}
