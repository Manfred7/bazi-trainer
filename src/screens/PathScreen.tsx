import { useEffect, useRef, useState } from 'react';
import { CharacterAsk, CharacterInfo } from '../components/CharacterCard';
import { SessionTop } from '../components/SessionTop';
import { StrokePlayer } from '../components/StrokePlayer';
import { type BoardHandle, WritingBoard } from '../components/WritingBoard';
import type { BaziChar } from '../data/characters';
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

interface Props {
  slots: Slot[];
  /** Живой прогресс: по нему ступень следующего слота и сообщение о переходе */
  progress: Progress;
  speed: Speed;
  onStep: (charId: string, stage: Stage, ok: boolean, demote: boolean) => void;
  onFinish: () => void;
  onExit: () => void;
}

const PROMPTS: Record<Stage, string> = {
  intro: 'Новый знак — посмотрите порядок черт',
  trace: 'Обведите знак по порядку черт',
  half: 'Первые черты — по контуру, остальные — сами',
  dots: 'Точки — там, где начинается каждая черта',
  recall: 'Напишите знак по памяти',
  paper: 'Напишите знак в тетради два-три раза',
  done: '',
};

/** После скольких ошибок на одной черте она показывается сама */
const HINT_AFTER: Partial<Record<Stage, number>> = { trace: 2, half: 3, dots: 3 };

/**
 * «Продолжить путь»: каждый слот — шаг на текущей ступени знака.
 * Экран помещается в окно без прокрутки: клетки ужимаются по высоте (fit), сообщение о переходе
 * встаёт на место подсказки к заданию, а не добавляет строку.
 */
export function PathScreen({ slots, progress, speed, onStep, onFinish, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [recorded, setRecorded] = useState(false);
  // Ступень слота фиксируется при первом показе — по прогрессу, где уже учтён предыдущий шаг
  const stages = useRef<Stage[]>([]);
  const slot = slots[index];
  stages.current[index] ??= slotStage(progress, slot);
  const stage = stages.current[index];
  const last = index === slots.length - 1;

  const record = (ok: boolean, demote = false) => {
    onStep(slot.char.id, stage, ok, demote);
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
  const move = recorded ? moveOf(stage, stageOf(progress, slot.char.id), !!slot.review) : null;

  return (
    <main className="screen study path">
      <SessionTop done={index + (recorded ? 1 : 0)} total={slots.length} onExit={onExit} />

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
          <p className="card__prompt">{slot.review ? 'Повторение: напишите знак по памяти' : PROMPTS[stage]}</p>
        )}

        {stage === 'intro' ? (
          <IntroStep char={slot.char} speed={speed} />
        ) : stage === 'paper' ? (
          <PaperStep char={slot.char} speed={speed} recorded={recorded} onResult={record} />
        ) : (
          <WriteStep char={slot.char} stage={stage} onResult={record} />
        )}
      </section>

      <div className="study__nav study__nav--one">
        {stage === 'intro' ? (
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
  onResult,
}: {
  char: BaziChar;
  stage: Stage;
  onResult: (ok: boolean, demote: boolean) => void;
}) {
  const board = useRef<BoardHandle>(null);
  const [written, setWritten] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; mistakes: number } | null>(null);
  const score = mistakes + hints;

  const complete = (m: number) => {
    const total = m + hints;
    setMistakes(m);
    setResult({ ok: isPass(total), mistakes: total });
    onResult(isPass(total), total >= DEMOTE_MISTAKES);
  };

  const hint = () => {
    board.current?.hint();
    setHints((h) => h + 1);
  };

  return (
    <>
      {stage !== 'trace' && <CharacterAsk char={char} />}
      <WritingBoard
        ref={board}
        hanzi={char.hanzi}
        outline={stage === 'trace'}
        guide={stage === 'half' || stage === 'dots' ? stage : undefined}
        hintAfterMisses={HINT_AFTER[stage] ?? false}
        attempt={0}
        fit
        onStroke={setWritten}
        onMistake={setMistakes}
        onComplete={complete}
      />
      {/* Статус и кнопка — в одну строку, чтобы клетке осталось больше места */}
      <div className="step-row">
        <p className={`player__status ${result ? (result.ok ? 'is-ok' : 'is-bad') : ''}`}>
          {result
            ? `${result.ok ? 'Засчитано' : 'Не засчитано'} · ошибок: ${result.mistakes}`
            : `Черт: ${written}${score ? ` · ошибок: ${score}` : ''}`}
        </p>
        {result ? (
          <button className="btn btn--small" onClick={() => board.current?.animate()}>
            ▶ Порядок черт
          </button>
        ) : (
          stage !== 'trace' && (
            <button className="btn btn--small" onClick={hint} title="Подсказка считается ошибкой">
              Подсказка
            </button>
          )
        )}
      </div>
      {stage === 'trace' && <CharacterInfo char={char} />}
    </>
  );
}

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
  const answer = (id: string, ok: boolean, demote: boolean) => {
    setChoice(id);
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
        {[
          { id: 'ok', label: 'Верно', ok: true, demote: false },
          { id: 'order', label: 'Ошибся в порядке', ok: false, demote: false },
          { id: 'forgot', label: 'Не вспомнил', ok: false, demote: true },
        ].map((o) => (
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
