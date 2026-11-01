import type { StrokeData } from 'hanzi-writer';
import { useEffect, useRef, useState } from 'react';
import { CharacterAsk, CharacterInfo } from '../components/CharacterCard';
import { OrderBoard } from '../components/OrderBoard';
import { SessionTop } from '../components/SessionTop';
import { StrokePlayer } from '../components/StrokePlayer';
import { type BoardHandle, WritingBoard } from '../components/WritingBoard';
import type { BaziChar } from '../data/characters';
import { strokeCount } from '../data/strokes';
import {
  DEMOTE_MISTAKES,
  STAGE_LABEL,
  type Slot,
  type Stage,
  slotStage,
  stageIndex,
  stageOf,
  stageSteps,
} from '../logic/path';
import type { Progress } from '../logic/progress';
import { isPass } from '../logic/session';
import type { Speed } from '../logic/settings';
import { type PaperReason, logEvent, logStrokeMistake } from '../logic/stats';

interface Props {
  slots: Slot[];
  /** Живой прогресс: по нему ступень следующего слота и сообщение о переходе */
  progress: Progress;
  speed: Speed;
  onStep: (charId: string, stage: Stage, ok: boolean, demote: boolean) => void;
  /** Ответ на «Какая черта следующая?»: на ступени не влияет, копится отдельно */
  onOrder: (charId: string, ok: boolean) => void;
  onFinish: () => void;
  onExit: () => void;
}

const PROMPTS: Record<Stage, string> = {
  intro: 'Новый знак — посмотрите порядок черт',
  trace: 'Обведите знак по порядку черт',
  half: 'Первые черты — по контуру, остальные — сами',
  dots: 'Точки — там, где начинается каждая черта',
  glance: 'Запомните знак — скоро он исчезнет',
  recall: 'Напишите знак по памяти',
  paper: 'Напишите знак в тетради два-три раза',
  done: '',
};

/** После скольких ошибок на одной черте она показывается сама */
const HINT_AFTER: Partial<Record<Stage, number>> = { trace: 2, half: 3, dots: 3 };

/** «Взгляни и напиши»: сколько виден знак — пока нет чистой попытки дольше, потом короче */
const GLANCE_FIRST_MS = 3000;
const GLANCE_NEXT_MS = 2000;
/** «Какая черта следующая?» — столько вопросов подряд на один знак */
const ORDER_QUESTIONS = 3;

/**
 * «Продолжить путь»: каждый слот — шаг на текущей ступени знака.
 * Экран помещается в окно без прокрутки: клетки ужимаются по высоте (fit), сообщение о переходе
 * встаёт на место подсказки к заданию, а не добавляет строку.
 */
export function PathScreen({ slots, progress, speed, onStep, onOrder, onFinish, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [recorded, setRecorded] = useState(false);
  // Ступень слота фиксируется при первом показе — по прогрессу, где уже учтён предыдущий шаг
  const stages = useRef<Stage[]>([]);
  const slot = slots[index];
  stages.current[index] ??= slotStage(progress, slot);
  const stage = stages.current[index];
  // Номера на «Точках» — тоже на весь шаг: пока у ступени нет ни одной чистой попытки
  const numberedSlots = useRef<boolean[]>([]);
  numberedSlots.current[index] ??= stage === 'dots' && stageSteps(progress, slot.char.id, stage).have === 0;
  const numbered = numberedSlots.current[index];
  // Сколько виден знак на «Взгляни и напиши» — тоже на весь шаг
  const glanceSlots = useRef<number[]>([]);
  glanceSlots.current[index] ??= stageSteps(progress, slot.char.id, stage).have === 0 ? GLANCE_FIRST_MS : GLANCE_NEXT_MS;
  const glanceMs = glanceSlots.current[index];
  const last = index === slots.length - 1;

  const record = (ok: boolean, demote = false) => {
    if (slot.order) onOrder(slot.char.id, ok);
    else onStep(slot.char.id, stage, ok, demote);
    // С обводки спускаться некуда (recordStep), такое понижением не считаем
    if (demote && !slot.order && stageIndex(stage) > stageIndex('trace')) logEvent(slot.char.id, stage, { kind: 'demote' });
    setRecorded(true);
  };

  const next = () => {
    if (last) return onFinish();
    setIndex(index + 1);
    setRecorded(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const steps = stageSteps(progress, slot.char.id, stage);
  const move = recorded && !slot.order ? moveOf(stage, stageOf(progress, slot.char.id), !!slot.review) : null;

  return (
    <main className="screen study path">
      <SessionTop done={index + (recorded ? 1 : 0)} total={slots.length} onExit={onExit} />

      {slot.order ? (
        <section key={index} className="card card--study">
          <div className="stage-chip">
            <span>Порядок черт</span>
          </div>
          <p className="card__prompt">Какая черта следующая? Нажмите на неё</p>
          <OrderStep char={slot.char} onResult={(ok) => record(ok)} />
        </section>
      ) : (
        <section key={index} className="card card--study">
          <div className="stage-chip">
            <span>{slot.review ? 'Повторение' : STAGE_LABEL[stage]}</span>
            {!slot.review && steps.need > 1 && (
              <span className="pips" aria-label={`${steps.have} из ${steps.need}`}>
                {Array.from({ length: steps.need }, (_, i) => (
                  <span key={i} className={i < steps.have ? 'is-on' : ''} />
                ))}
              </span>
            )}
          </div>
          {move ? (
            <p className={`move move--${move.dir}`}>{move.text}</p>
          ) : (
            <p className="card__prompt">
              {slot.review
                ? 'Повторение: напишите знак по памяти'
                : numbered
                  ? 'Номера — в каком порядке писать черты'
                  : PROMPTS[stage]}
            </p>
          )}

          {stage === 'intro' ? (
            <IntroStep char={slot.char} speed={speed} />
          ) : stage === 'paper' ? (
            <PaperStep char={slot.char} speed={speed} recorded={recorded} onResult={record} />
          ) : (
            <WriteStep char={slot.char} stage={stage} numbered={numbered} glanceMs={glanceMs} onResult={record} />
          )}
        </section>
      )}

      <div className="study__nav study__nav--one">
        {stage === 'intro' && !slot.order ? (
          <button
            className="btn btn--primary"
            onClick={() => {
              record(true);
              next();
            }}
          >
            Понятно, обводить →
          </button>
        ) : (
          <button className="btn btn--primary" onClick={next} disabled={!recorded}>
            {last ? 'Итоги' : 'Дальше →'}
          </button>
        )}
      </div>
    </main>
  );
}

/** Что стало со знаком после шага: перешёл, спустился; null — остался на той же ступени */
function moveOf(from: Stage, to: Stage, review: boolean): { dir: 'up' | 'down'; text: string } | null {
  if (from === 'intro') return null;
  const d = stageIndex(to) - stageIndex(from);
  if (review) return d < 0 ? { dir: 'down', text: 'Знак вернулся на «По памяти»' } : null;
  if (to === 'done') return { dir: 'up', text: 'Знак освоен — печать поставлена' };
  if (d > 0) return { dir: 'up', text: `Ступень пройдена → ${STAGE_LABEL[to]}` };
  if (d < 0) return { dir: 'down', text: `Шаг назад → ${STAGE_LABEL[to]}. Один чистый проход — и вернётесь` };
  return null;
}

function IntroStep({ char, speed }: { char: BaziChar; speed: Speed }) {
  return (
    <>
      <StrokePlayer hanzi={char.hanzi} speed={speed} fit />
      <CharacterInfo char={char} />
    </>
  );
}

function WriteStep({
  char,
  stage,
  numbered,
  glanceMs,
  onResult,
}: {
  char: BaziChar;
  stage: Stage;
  /** Точки с номерами — первая попытка на «Точках»; вторая уже без номеров (фиксируется на весь шаг) */
  numbered: boolean;
  /** «Взгляни и напиши»: сколько миллисекунд виден знак */
  glanceMs: number;
  onResult: (ok: boolean, demote: boolean) => void;
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
    onResult(isPass(sum), sum >= DEMOTE_MISTAKES);
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
              <button className="btn btn--small" onClick={restart}>
                ↺ Ещё раз
              </button>
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
 * Неверная мигает, верная подсвечивается, пока её не нажмут. Засчитано, если ни одной ошибки
 */
function OrderStep({ char, onResult }: { char: BaziChar; onResult: (ok: boolean) => void }) {
  const total = strokeCount(char.hanzi);
  const [start] = useState(() => Math.floor(Math.random() * (total - ORDER_QUESTIONS + 1)));
  const asked = Math.min(ORDER_QUESTIONS, total - start);
  const [written, setWritten] = useState(start);
  const [mistakes, setMistakes] = useState(0);
  const [reveal, setReveal] = useState(false);
  const done = written >= start + asked;

  const answer = (stroke: number) => {
    if (done) return;
    if (stroke !== written) {
      setMistakes((m) => m + 1);
      setReveal(true);
      return;
    }
    setReveal(false);
    setWritten(written + 1);
    if (written + 1 >= start + asked) onResult(mistakes === 0);
  };

  return (
    <>
      <CharacterAsk char={char} />
      <OrderBoard hanzi={char.hanzi} written={written} reveal={reveal} onAnswer={answer} />
      <div className="step-row">
        <p className={`player__status ${done ? (mistakes ? 'is-bad' : 'is-ok') : ''}`}>
          {done
            ? mistakes
              ? `Готово · ошибок: ${mistakes}`
              : 'Всё верно'
            : `Вопрос ${written - start + 1} из ${asked} · черта ${written + 1} из ${total}${mistakes ? ` · ошибок: ${mistakes}` : ''}`}
        </p>
      </div>
    </>
  );
}

const SELF_CHECK: { id: PaperReason; label: string; ok: boolean; demote: boolean }[] = [
  { id: 'ok', label: 'Верно', ok: true, demote: false },
  { id: 'order', label: 'Ошибся в порядке', ok: false, demote: false },
  { id: 'forgot', label: 'Не вспомнил', ok: false, demote: true },
];

/** Тетрадь: пишем на бумаге, потом сверяем с анимацией порядка черт и честно оцениваем себя */
function PaperStep({
  char,
  speed,
  recorded,
  onResult,
}: {
  char: BaziChar;
  speed: Speed;
  recorded: boolean;
  onResult: (ok: boolean, demote: boolean) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const answer = (id: PaperReason, ok: boolean, demote: boolean) => {
    setChoice(id);
    logEvent(char.id, 'paper', { kind: 'paper', reason: id });
    onResult(ok, demote);
  };

  if (!checking) {
    return (
      <>
        <CharacterAsk char={char} />
        <div className="paper-sheet" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <p className="muted">Пишите в клетке тетради, как в прописи, — потом сверим порядок черт</p>
        <button className="btn" onClick={() => setChecking(true)}>
          Сверить
        </button>
      </>
    );
  }

  return (
    <>
      <StrokePlayer hanzi={char.hanzi} speed={speed} fit />
      <p className="muted">Как получилось в тетради?</p>
      <div className="self-check">
        {SELF_CHECK.map((o) => (
          <button
            key={o.id}
            className={`btn ${choice === o.id ? 'btn--primary' : ''}`}
            disabled={recorded}
            onClick={() => answer(o.id, o.ok, o.demote)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </>
  );
}
