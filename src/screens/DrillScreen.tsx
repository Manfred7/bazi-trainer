import { useEffect, useReducer, useState } from 'react';
import { CharPicker } from '../components/CharPicker';
import { GLANCE_FIRST_MS, IntroStep, OrderStep, WriteStep } from '../components/PathSteps';
import { SessionTop } from '../components/SessionTop';
import type { BaziChar } from '../data/characters';
import { strokeCount } from '../data/strokes';
import { drillClean, drillReducer, drillStart, drillSteps } from '../logic/drill';
import { PASS_MISTAKES } from '../logic/session';
import type { Speed } from '../logic/settings';

interface Props {
  char: BaziChar;
  speed: Speed;
  onExit: () => void;
}

/** Свободная практика: один знак по всем шагам подряд; правило шагов — logic/drill.ts */
export function DrillScreen({ char: first, speed, onExit }: Props) {
  const [char, setChar] = useState(first);
  const [picking, setPicking] = useState(false);
  /** Новый прогон (другой знак или «ещё раз»): смена key сбрасывает состояние шагов */
  const [run, setRun] = useState(0);

  const start = (c: BaziChar) => {
    setChar(c);
    setPicking(false);
    setRun((r) => r + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  if (picking) {
    return (
      <main className="screen" data-screen="drill-pick">
        <SessionTop done={0} total={1} onExit={onExit} />
        <section className="panel">
          <h2>Какой знак пройти?</h2>
          <CharPicker onPick={start} />
        </section>
      </main>
    );
  }

  return (
    <DrillRun
      key={`${char.id}-${run}`}
      char={char}
      speed={speed}
      onAgain={() => start(char)}
      onOther={() => setPicking(true)}
      onExit={onExit}
    />
  );
}

function DrillRun({
  char,
  speed,
  onAgain,
  onOther,
  onExit,
}: {
  char: BaziChar;
  speed: Speed;
  onAgain: () => void;
  onOther: () => void;
  onExit: () => void;
}) {
  const steps = drillSteps(strokeCount(char.hanzi));
  const [state, dispatch] = useReducer(drillReducer, steps.length, drillStart);
  const { index, tries, current, attempt } = state;
  const step = steps[index];
  const last = index === steps.length - 1;
  const result = (mistakes: number) => dispatch({ type: 'result', mistakes });

  if (state.done) {
    const clean = drillClean(state);
    return (
      <main className="screen result" data-screen="drill-result" data-char={char.id}>
        <section className="result__score">
          <div className={`result__pct hanzi el-${char.element} drill__glyph`}>{char.hanzi}</div>
          <p className="muted" data-testid="drill-summary">
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
                <li key={s.id} data-step={s.id} data-tries={t.join(',')}>
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
          <button className="btn btn--primary btn--wide" data-testid="drill-again" onClick={onAgain}>
            Этот знак ещё раз
          </button>
          <button className="btn btn--wide" data-testid="drill-other" onClick={onOther}>
            Другой знак
          </button>
          <button className="btn btn--ghost btn--wide" data-testid="menu" onClick={onExit}>
            В меню
          </button>
        </div>
      </main>
    );
  }

  const failed = current && !current.ok;
  const tryNo = (tries[index]?.length ?? 0) + (current ? 0 : 1);

  return (
    <main
      className="screen study path"
      data-screen="drill"
      data-char={char.id}
      data-step={step.id}
      data-try={tryNo}
      data-result={current ? (current.ok ? 'ok' : 'fail') : 'pending'}
    >
      <SessionTop done={index + (current?.ok ? 1 : 0)} total={steps.length} onExit={onExit} />

      <section key={`${index}-${attempt}`} className="card card--study">
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
          <OrderStep char={char} onResult={(_, m) => result(m)} />
        ) : (
          <WriteStep
            char={char}
            stage={step.id}
            numbered={false}
            glanceMs={GLANCE_FIRST_MS}
            practiceAfter={false}
            onResult={(_, __, m) => result(m)}
          />
        )}
      </section>

      <div className="study__nav study__nav--one">
        {step.id === 'intro' ? (
          <button
            className="btn btn--primary"
            data-testid="next"
            onClick={() => {
              result(0);
              dispatch({ type: 'next' });
            }}
          >
            Понятно, дальше →
          </button>
        ) : failed ? (
          <button className="btn btn--primary" data-testid="retry-step" onClick={() => dispatch({ type: 'retry' })}>
            ↺ Повторить шаг
          </button>
        ) : (
          <button className="btn btn--primary" data-testid="next" onClick={() => dispatch({ type: 'next' })} disabled={!current}>
            {last ? 'Итоги' : 'Дальше →'}
          </button>
        )}
      </div>
    </main>
  );
}
