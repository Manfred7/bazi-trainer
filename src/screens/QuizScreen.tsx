import { useCallback, useEffect, useReducer } from 'react';
import { CharacterInfo } from '../components/CharacterCard';
import { SessionTop } from '../components/SessionTop';
import type { BaziChar } from '../data/characters';
import type { Progress } from '../logic/progress';
import { type Direction, type Option, type Question, type QuizAnswer, makeQuestion } from '../logic/quiz';

export interface QuizConfig {
  /** Из каких знаков спрашивать */
  pool: BaziChar[];
  /** Откуда в первую очередь брать неверные варианты */
  deck: BaziChar[];
  directions: Direction[];
  length: number;
}

interface State {
  current: Question;
  pickedId: string | null;
  answers: QuizAnswer[];
}

type Action = { type: 'answer'; id: string } | { type: 'next'; question: Question };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'answer':
      if (state.pickedId !== null) return state;
      return {
        ...state,
        pickedId: action.id,
        answers: [...state.answers, { question: state.current, pickedId: action.id }],
      };
    case 'next':
      return { ...state, current: action.question, pickedId: null };
  }
}

const AUTO_NEXT_MS = 800;

interface Props {
  config: QuizConfig;
  /** Текущий прогресс — для веса пар и уровня трудности вариантов */
  progress: Progress;
  onAnswer: (answer: QuizAnswer) => void;
  onFinish: (answers: QuizAnswer[]) => void;
  onExit: () => void;
}

/** Что показать в вопросе. Знак — тушью, не цветом стихии: цвет подсказал бы ответ */
function Ask({ q }: { q: Question }) {
  switch (q.direction.id) {
    case 'reading>char':
      return (
        <p className="ask__reading">
          <span className="ask__big">{q.char.ru}</span>
          <span className="info__pinyin">{q.char.pinyin}</span>
        </p>
      );
    case 'animal>branch':
      return <span className="ask__big">{q.char.animal}</span>;
    default:
      return <span className="hanzi ask__hanzi">{q.char.hanzi}</span>;
  }
}

function OptionView({ o }: { o: Option }) {
  if (o.hanzi) return <span className="hanzi answer__hanzi">{o.hanzi}</span>;
  return (
    <span className="answer__text">
      {o.text}
      {o.sub && <span className="answer__sub">{o.sub}</span>}
    </span>
  );
}

/** Режим «Узнавание»: выбор из четырёх */
export function QuizScreen({ config, progress, onAnswer, onFinish, onExit }: Props) {
  const [state, dispatch] = useReducer(reducer, config, (c) => ({
    current: makeQuestion(c.pool, c.deck, c.directions, progress, []),
    pickedId: null,
    answers: [],
  }));

  const { current, pickedId, answers } = state;
  const revealed = pickedId !== null;
  const correct = pickedId === current.answerId;

  const answer = useCallback(
    (id: string) => {
      if (pickedId !== null) return;
      dispatch({ type: 'answer', id });
      onAnswer({ question: current, pickedId: id });
    },
    [pickedId, current, onAnswer],
  );

  const next = useCallback(() => {
    if (answers.length >= config.length) return onFinish(answers);
    dispatch({ type: 'next', question: makeQuestion(config.pool, config.deck, config.directions, progress, answers) });
  }, [answers, config, progress, onFinish]);

  useEffect(() => {
    if (!revealed || !correct) return;
    const t = setTimeout(next, AUTO_NEXT_MS);
    return () => clearTimeout(t);
  }, [revealed, correct, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const n = Number(e.key);
      if (!revealed && n >= 1 && n <= current.options.length) answer(current.options[n - 1].id);
      else if (revealed && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      } else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, current, next, answer, onExit]);

  const glyphs = current.options.some((o) => o.hanzi);

  return (
    <main className="screen quiz">
      <SessionTop done={answers.length} total={config.length} onExit={onExit} />

      <section
        key={answers.length - (revealed ? 1 : 0)}
        className={`card ${revealed ? (correct ? 'card--ok' : 'card--bad') : ''}`}
        aria-live="polite"
      >
        {revealed ? (
          <>
            <span className={`hanzi ask__hanzi el-${current.char.element} is-colored`}>{current.char.hanzi}</span>
            <CharacterInfo char={current.char} />
          </>
        ) : (
          <>
            <div className="card__ask">
              <Ask q={current} />
            </div>
            <p className="card__prompt">{current.direction.prompt}</p>
          </>
        )}
      </section>

      <div className={`answers ${glyphs ? 'answers--glyphs' : ''}`}>
        {current.options.map((opt, i) => {
          const isRight = opt.id === current.answerId;
          const isPicked = opt.id === pickedId;
          let cls = 'answer';
          if (revealed) {
            if (isRight) cls += ' answer--ok';
            else if (isPicked) cls += ' answer--bad';
            else cls += ' answer--dim';
          }
          return (
            <button key={opt.id} className={cls} disabled={revealed} onClick={() => answer(opt.id)}>
              <span className="answer__key" aria-hidden>
                {i + 1}
              </span>
              <OptionView o={opt} />
              {revealed && isRight && (
                <span className="answer__mark" aria-label="верно">
                  ✓
                </span>
              )}
              {revealed && isPicked && !isRight && (
                <span className="answer__mark" aria-label="неверно">
                  ✗
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="quiz__footer">
        {revealed && !correct && (
          <button className="btn btn--primary btn--wide" onClick={next} autoFocus>
            Дальше
          </button>
        )}
      </div>
    </main>
  );
}
