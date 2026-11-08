import { useEffect, useRef, useState } from 'react';
import { CharacterAsk } from '../components/CharacterCard';
import { GLANCE_FIRST_MS, GLANCE_NEXT_MS, IntroStep, OrderStep, WriteStep } from '../components/PathSteps';
import { SessionTop } from '../components/SessionTop';
import { StrokePlayer } from '../components/StrokePlayer';
import type { BaziChar } from '../data/characters';
import { STAGE_LABEL, type Slot, type Stage, slotStage, stageIndex, stageOf, stageSteps } from '../logic/path';
import type { Progress } from '../logic/progress';
import type { Speed } from '../logic/settings';
import { type PaperReason, logEvent } from '../logic/stats';

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
