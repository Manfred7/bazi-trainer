import type { StrokeData } from 'hanzi-writer';
import { useEffect, useRef, useState } from 'react';
import type { BaziChar } from '../data/characters';
import { strokeCount } from '../data/strokes';
import { DEMOTE_MISTAKES, type Stage } from '../logic/path';
import { isPass } from '../logic/session';
import type { Speed } from '../logic/settings';
import { logEvent, logStrokeMistake } from '../logic/stats';
import { CharacterAsk, CharacterInfo } from './CharacterCard';
import { OrderBoard } from './OrderBoard';
import { StrokePlayer } from './StrokePlayer';
import { type BoardHandle, WritingBoard } from './WritingBoard';

// Шаги письма знака — общие для «Пути знака» и прогона одного знака в свободной практике

/** После скольких ошибок на одной черте она показывается сама */
const HINT_AFTER: Partial<Record<Stage, number>> = { trace: 2, half: 3, dots: 3 };

/** «Взгляни и напиши»: сколько виден знак — пока нет чистой попытки дольше, потом короче */
export const GLANCE_FIRST_MS = 3000;
export const GLANCE_NEXT_MS = 2000;
/** «Какая черта следующая?» — столько вопросов подряд на один знак */
const ORDER_QUESTIONS = 3;

export function IntroStep({ char, speed }: { char: BaziChar; speed: Speed }) {
  return (
    <>
      <StrokePlayer hanzi={char.hanzi} speed={speed} fit />
      <CharacterInfo char={char} />
    </>
  );
}

export function WriteStep({
  char,
  stage,
  numbered,
  glanceMs,
  practiceAfter = true,
  onResult,
}: {
  char: BaziChar;
  stage: Stage;
  /** Точки с номерами — первая попытка на «Точках»; вторая уже без номеров (фиксируется на весь шаг) */
  numbered: boolean;
  /** «Взгляни и напиши»: сколько миллисекунд виден знак */
  glanceMs: number;
  /** После засчитанной попытки можно писать ещё раз — тренировка вне счёта; false — только анимация порядка */
  practiceAfter?: boolean;
  onResult: (ok: boolean, demote: boolean, mistakes: number) => void;
}) {
  const board = useRef<BoardHandle>(null);
  const glance = stage === 'glance';
  /** Знак виден целиком («Взгляни и напиши»); key перезапускает показ */
  const [peek, setPeek] = useState<{ ms: number; key: number } | null>(() => (glance ? { ms: glanceMs, key: 1 } : null));

  useEffect(() => {
    if (!peek) return;
    const t = setTimeout(() => setPeek(null), peek.ms);
    return () => clearTimeout(t);
  }, [peek]);
  /** Мигание точки ожидаемой черты после ошибки */
  const [pulse, setPulse] = useState<{ stroke: number; key: number } | null>(null);
  /** Подсказка на «Точках»: точка и стрелка этой черты */
  const [cue, setCue] = useState<number | null>(null);
  const guided = stage === 'half' || stage === 'dots';
  const [attempt, setAttempt] = useState(0);
  const [written, setWritten] = useState(0);
  /** Ошибки текущей попытки на клетке */
  const [mistakes, setMistakes] = useState(0);
  /** Ошибки брошенных попыток: «Заново» до конца знака их не стирает */
  const [carry, setCarry] = useState(0);
  const [hints, setHints] = useState(0);
  /** Засчитанная (первая) попытка — она идёт в прогресс */
  const [result, setResult] = useState<{ ok: boolean; mistakes: number } | null>(null);
  /** Тренировочный круг после засчитанной попытки: null — не начат, иначе — закончен ли */
  const [practice, setPractice] = useState<{ done: boolean } | null>(null);
  const score = carry + mistakes + hints;
  const total = strokeCount(char.hanzi);
  // С подсказкой на клетке число черт не секрет; по памяти и после взгляда — секрет
  const showTotal = stage !== 'recall' && !glance;
  const writing = !result || (practice && !practice.done);

  const complete = (m: number) => {
    setMistakes(m);
    if (result) {
      logEvent(char.id, stage, { kind: 'done', mistakes: m });
      return setPractice({ done: true });
    }
    const sum = carry + m + hints;
    logEvent(char.id, stage, { kind: 'done', mistakes: sum });
    setResult({ ok: isPass(sum), mistakes: sum });
    onResult(isPass(sum), sum >= DEMOTE_MISTAKES, sum);
  };

  /** Переписать знак: до конца — ошибки остаются в счёте, после — тренировка без влияния на прогресс */
  const restart = () => {
    if (!result) {
      setCarry((c) => c + mistakes);
      logEvent(char.id, stage, { kind: 'restart', stroke: written });
    } else {
      setPractice({ done: false });
      // Тренировочный круг «Взгляни и напиши» снова начинается со взгляда — бесплатно, в счёт он не идёт
      if (glance) setPeek({ ms: glanceMs, key: Date.now() });
    }
    setMistakes(0);
    setWritten(0);
    setPulse(null);
    setCue(null);
    setAttempt((a) => a + 1);
  };

  const mistake = (s: StrokeData) => {
    setMistakes(s.totalMistakes);
    logStrokeMistake(char, stage, s);
    if (guided) setPulse({ stroke: written, key: Date.now() });
  };

  // На обводке и в тренировке подсказка бесплатна: контур и так виден / в счёт не идёт.
  // На «Точках» подсказка — только откуда и куда вести черту, а не вся черта
  // «Взгляни и напиши»: подсказка — ещё раз увидеть знак целиком
  const hint = () => {
    if (stage === 'dots') setCue(written);
    else if (glance) setPeek({ ms: glanceMs, key: Date.now() });
    else board.current?.hint();
    if (stage !== 'trace' && !result) setHints((h) => h + 1);
    logEvent(char.id, stage, { kind: 'hint', stroke: written });
  };

  const progressText = `${showTotal ? `Черта ${Math.min(written + 1, total)} из ${total}` : `Черт: ${written}`}`;
  const status = peek
    ? 'Запоминайте…'
    : !result
      ? `${progressText}${score ? ` · ошибок: ${score}` : ''}`
      : !practice
        ? `${result.ok ? 'Засчитано' : 'Не засчитано'} · ошибок: ${result.mistakes}`
        : practice.done
          ? `Ещё раз · ошибок: ${mistakes}. В счёт — первая попытка`
          : `Ещё раз: ${progressText}${mistakes ? ` · ошибок: ${mistakes}` : ''}`;

  return (
    <>
      {stage !== 'trace' && <CharacterAsk char={char} />}
      <WritingBoard
        ref={board}
        hanzi={char.hanzi}
        outline={stage === 'trace'}
        guide={stage === 'half' || stage === 'dots' ? stage : undefined}
        cues={{ written, numbered, pulse, cue }}
        hintAfterMisses={HINT_AFTER[stage] ?? false}
        attempt={attempt}
        fit
        peek={peek}
        onStroke={setWritten}
        onMistake={mistake}
        onComplete={complete}
      />
      {/* Статус и кнопки — в одну строку, чтобы клетке осталось больше места */}
      <div className="step-row">
        <p className={`player__status ${result && !practice ? (result.ok ? 'is-ok' : 'is-bad') : ''}`}>{status}</p>
        <div className="step-row__actions">
          {peek ? null : writing ? (
            <>
              {(written > 0 || mistakes > 0) && (
                <button
                  className="btn btn--small btn--icon"
                  onClick={restart}
                  aria-label="Заново"
                  title={result ? 'Заново' : 'Заново — ошибки останутся в счёте'}
                >
                  ↺
                </button>
              )}
              <button
                className="btn btn--small"
                onClick={hint}
                title={stage === 'trace' || result ? 'Подсветить черту, которую ждёт проверка' : 'Подсказка считается ошибкой'}
              >
                {stage === 'trace' ? 'Какая черта?' : glance ? 'Ещё взглянуть' : 'Подсказка'}
              </button>
            </>
          ) : (
            <>
              {practiceAfter && (
                <button className="btn btn--small" onClick={restart}>
                  ↺ Ещё раз
                </button>
              )}
              <button className="btn btn--small btn--icon" onClick={() => board.current?.animate()} aria-label="Порядок черт" title="Порядок черт">
                ▶
              </button>
            </>
          )}
        </div>
      </div>
      {stage === 'trace' && <CharacterInfo char={char} />}
    </>
  );
}

/**
 * «Какая черта следующая?»: знак написан до случайной черты, нажимаем следующую — ORDER_QUESTIONS раз подряд.
 * Неверная мигает, верная подсвечивается, пока её не нажмут. Засчитано, если ни одной ошибки.
 * После засчитанных вопросов знак можно дособрать до конца — это уже не в счёт
 */
export function OrderStep({ char, onResult }: { char: BaziChar; onResult: (ok: boolean, mistakes: number) => void }) {
  const total = strokeCount(char.hanzi);
  const [start] = useState(() => Math.floor(Math.random() * (total - ORDER_QUESTIONS + 1)));
  const asked = Math.min(ORDER_QUESTIONS, total - start);
  const [written, setWritten] = useState(start);
  const [mistakes, setMistakes] = useState(0);
  const [reveal, setReveal] = useState(false);
  const done = written >= start + asked;

  const answer = (stroke: number) => {
    if (stroke !== written) {
      if (!done) setMistakes((m) => m + 1);
      setReveal(true);
      return;
    }
    setReveal(false);
    setWritten(written + 1);
    if (written + 1 === start + asked) onResult(mistakes === 0, mistakes);
  };

  return (
    <>
      <CharacterAsk char={char} />
      <OrderBoard hanzi={char.hanzi} written={written} reveal={reveal} onAnswer={answer} />
      <div className="step-row">
        <p className={`player__status ${done ? (mistakes ? 'is-bad' : 'is-ok') : ''}`}>
          {done
            ? `${mistakes ? `Готово · ошибок: ${mistakes}` : 'Всё верно'} · ${written < total ? `черта ${written + 1} из ${total}` : 'знак собран'}`
            : `Вопрос ${written - start + 1} из ${asked} · черта ${written + 1} из ${total}${mistakes ? ` · ошибок: ${mistakes}` : ''}`}
        </p>
      </div>
    </>
  );
}

