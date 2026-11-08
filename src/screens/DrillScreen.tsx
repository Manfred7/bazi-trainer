import { useEffect, useState } from 'react';
import { CharPicker } from '../components/CharPicker';
import { GLANCE_FIRST_MS, IntroStep, OrderStep, WriteStep } from '../components/PathSteps';
import { SessionTop } from '../components/SessionTop';
import type { BaziChar } from '../data/characters';
import { strokeCount } from '../data/strokes';
import { isPass, PASS_MISTAKES } from '../logic/session';
import type { Speed } from '../logic/settings';

/**
 * Свободная практика: один знак по всем шагам подряд — от знакомства до письма по памяти.
 * Шаг засчитан, если ошибок не больше PASS_MISTAKES, иначе его повторяют. На прогресс пути не влияет.
 */
type StepId = 'intro' | 'order' | 'trace' | 'half' | 'glance' | 'recall';

const STEPS: { id: StepId; label: string; prompt: string }[] = [
  { id: 'intro', label: 'Знакомство', prompt: 'Посмотрите порядок черт' },
  { id: 'order', label: 'Какая черта следующая?', prompt: 'Нажмите на черту, которая идёт следующей' },
  { id: 'trace', label: 'Обводка', prompt: 'Обведите знак по порядку черт' },
  { id: 'half', label: 'Полуконтур', prompt: 'Первые черты — по контуру, остальные — сами' },
  { id: 'glance', label: 'Взгляни и напиши', prompt: 'Запомните знак — скоро он исчезнет' },
  { id: 'recall', label: 'Финал: по памяти', prompt: 'Напишите знак по памяти, без подсказок' },
];

/** У «Какая черта следующая?» должно быть о чём спросить: знакам из 1–2 черт шаг не нужен */
const ORDER_MIN_STROKES = 3;
const stepsFor = (c: BaziChar) => STEPS.filter((s) => s.id !== 'order' || strokeCount(c.hanzi) >= ORDER_MIN_STROKES);

interface Props {
  char: BaziChar;
  speed: Speed;
  onExit: () => void;
}

export function DrillScreen({ char: first, speed, onExit }: Props) {
  const [char, setChar] = useState(first);
  /** pick — выбор другого знака после итогов */
  const [phase, setPhase] = useState<'steps' | 'result' | 'pick'>('steps');
  const [index, setIndex] = useState(0);
  /** Ошибки каждой попытки по шагам: [шаг][попытка] */
  const [tries, setTries] = useState<number[][]>([]);
  /** Попытка шага: смена перезапускает шаг с нуля */
  const [attempt, setAttempt] = useState(0);
  /** Итог текущей попытки; null — шаг ещё идёт */
  const [current, setCurrent] = useState<{ ok: boolean; mistakes: number } | null>(null);

  const steps = stepsFor(char);
  const step = steps[index];
  const last = index === steps.length - 1;

  const start = (c: BaziChar) => {
    setChar(c);
    setPhase('steps');
    setIndex(0);
    setTries([]);
    setAttempt((a) => a + 1);
    setCurrent(null);
  };

  const result = (ok: boolean, mistakes: number) => {
    setCurrent({ ok, mistakes });
    setTries((t) => {
      const next = [...t];
      next[index] = [...(next[index] ?? []), mistakes];
      return next;
    });
  };

  const next = () => {
    setCurrent(null);
    setAttempt((a) => a + 1);
    if (last) return setPhase('result');
    setIndex(index + 1);
  };

  const retry = () => {
    setCurrent(null);
    setAttempt((a) => a + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  if (phase === 'pick') {
    return (
      <main className="screen">
        <SessionTop done={0} total={1} onExit={onExit} />
        <section className="panel">
          <h2>Какой знак пройти?</h2>
          <CharPicker onPick={start} />
        </section>
      </main>
    );
  }

  if (phase === 'result') {
    const clean = steps.filter((_, i) => tries[i]?.length === 1).length;
    return (
      <main className="screen result">
        <section className="result__score">
          <div className={`result__pct hanzi el-${char.element} drill__glyph`}>{char.hanzi}</div>
          <p className="muted">
            {char.ru} · {char.pinyin} — все шаги пройдены
            {clean === steps.length ? ', каждый с первого раза' : `, с первого раза — ${clean} из ${steps.length}`}
          </p>
        </section>

        <section className="panel">
          <h2>Итог по шагам</h2>
          <ul className="mistakes drill__steps">
            {steps.map((s, i) => {
              const t = tries[i] ?? [];
              const passed = t[t.length - 1] ?? 0;
              return (
                <li key={s.id}>
                  <span>{s.label}</span>
                  <span className={t.length > 1 ? 'mistakes__count' : 'drill__ok'}>
                    {s.id === 'intro'
                      ? '✓'
                      : t.length > 1
                        ? `попыток: ${t.length} · ошибки: ${t.join(', ')}`
                        : passed
                          ? `ошибок: ${passed}`
                          : 'без ошибок'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="result__actions">
          <button className="btn btn--primary btn--wide" onClick={() => start(char)}>
            Этот знак ещё раз
          </button>
          <button className="btn btn--wide" onClick={() => setPhase('pick')}>
            Другой знак
          </button>
          <button className="btn btn--ghost btn--wide" onClick={onExit}>
            В меню
          </button>
        </div>
      </main>
    );
  }

  const failed = current && !current.ok;
  const tryNo = (tries[index]?.length ?? 0) + (current ? 0 : 1);

  return (
    <main className="screen study path">
      <SessionTop done={index + (current?.ok ? 1 : 0)} total={steps.length} onExit={onExit} />

      <section key={`${char.id}-${index}-${attempt}`} className="card card--study">
        <div className="stage-chip">
          <span>
            {step.label}
            {tryNo > 1 && ` · попытка ${tryNo}`}
          </span>
        </div>
        {failed ? (
          <p className="move move--down">
            Ошибок: {current.mistakes} — нужно не больше {PASS_MISTAKES}. Повторите шаг
          </p>
        ) : (
          <p className="card__prompt">{step.prompt}</p>
        )}

        {step.id === 'intro' ? (
          <IntroStep char={char} speed={speed} />
        ) : step.id === 'order' ? (
          <OrderStep char={char} onResult={(_, m) => result(isPass(m), m)} />
        ) : (
          <WriteStep
            char={char}
            stage={step.id}
            numbered={false}
            glanceMs={GLANCE_FIRST_MS}
            practiceAfter={false}
            onResult={(ok, _, m) => result(ok, m)}
          />
        )}
      </section>

      <div className="study__nav study__nav--one">
        {step.id === 'intro' ? (
          <button
            className="btn btn--primary"
            onClick={() => {
              result(true, 0);
              next();
            }}
          >
            Понятно, дальше →
          </button>
        ) : failed ? (
          <button className="btn btn--primary" onClick={retry}>
            ↺ Повторить шаг
          </button>
        ) : (
          <button className="btn btn--primary" onClick={next} disabled={!current}>
            {last ? 'Итоги' : 'Дальше →'}
          </button>
        )}
      </div>
    </main>
  );
}
