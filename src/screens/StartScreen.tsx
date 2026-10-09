import { DECKS, type Deck, deckById, isAvailable } from '../logic/decks';
import { useInstall } from '../logic/install';
import { type Progress, UNLOCK_SHARE, mastery } from '../logic/progress';
import { DIRECTIONS, canAsk, quizMastery } from '../logic/quiz';
import { PASS_MISTAKES } from '../logic/session';
import { MODES, QUIZ_LENGTHS, SESSION_LENGTHS, type Settings } from '../logic/settings';
import { THEMES } from '../logic/theme';

interface Props {
  settings: Settings;
  progress: Progress;
  /** Колода, которая реально будет запущена (выбранная, если она открыта) */
  deck: Deck;
  onChange: (s: Settings) => void;
  onResetProgress: () => void;
  onStart: () => void;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

const MODE_NOTES = {
  study: 'Знак на клетке, чтения и значение. Порядок черт — анимацией, целиком или по одной черте.',
  trace:
    'Обведите знак пальцем по бледному контуру. Черты проверяются по порядку и направлению; после двух ошибок на черте она покажется сама.',
  recall: `Пустая клетка, сверху чтение и значение — напишите знак целиком. Подсказка по кнопке считается ошибкой; знак засчитан, если ошибок не больше ${PASS_MISTAKES}.`,
  quiz: 'Выбор из четырёх. Чем лучше знаете знак, тем труднее неверные варианты: сначала случайные, потом той же стихии, потом похожие по виду (己/巳, 戊/戌, 未/末, 辛/幸).',
} as const;

const START_LABELS = {
  study: 'Смотреть',
  trace: 'Обводить',
  recall: 'Писать',
  quiz: 'Начать',
} as const;

export function StartScreen({ settings, progress, deck, onChange, onResetProgress, onStart }: Props) {
  const { canInstall, iosHint, install } = useInstall();
  const { mode } = settings;
  const track = mode === 'trace' || mode === 'recall' ? mode : null;
  const directions = DIRECTIONS.filter((d) => settings.directionIds.includes(d.id));
  const deckMastery = (chars: Deck['chars']) =>
    mode === 'quiz' ? quizMastery(progress, chars, directions) : track ? mastery(progress, chars, track) : 0;
  const canStart = mode !== 'quiz' || canAsk(deck.chars, directions);
  const toggle = (id: string) => {
    const has = settings.directionIds.includes(id);
    onChange({ ...settings, directionIds: has ? settings.directionIds.filter((d) => d !== id) : [...settings.directionIds, id] });
  };

  const reset = () => {
    if (window.confirm('Сбросить весь прогресс? Открытые колоды снова закроются.')) onResetProgress();
  };

  return (
    <main className="screen start">
      <header className="start__hero">
        <div className="start__glyphs hanzi" aria-hidden>
          甲乙丙丁 子丑寅卯
        </div>
        <h1>Прописи БаЦзы</h1>
        <p className="muted">Как пишется, читается и что значит каждый знак</p>
      </header>

      <section className="panel">
        <h2>Режим</h2>
        <div className="segmented segmented--4" role="radiogroup" aria-label="Режим">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={mode === m.id}
              className={mode === m.id ? 'is-on' : ''}
              onClick={() => onChange({ ...settings, mode: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="panel__note">{MODE_NOTES[mode]}</p>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Колода</h2>
          {mode === 'recall' && (
            <button className="link" onClick={() => onChange({ ...settings, unlockAll: !settings.unlockAll })}>
              {settings.unlockAll ? 'Открывать по порядку' : 'Открыть все'}
            </button>
          )}
        </div>
        <ul className="decks" role="radiogroup" aria-label="Колода">
          {DECKS.map((d) => {
            const open = isAvailable(d, mode, progress, settings.unlockAll);
            const on = d.id === deck.id;
            const m = deckMastery(d.chars);
            return (
              <li key={d.id}>
                <button
                  role="radio"
                  aria-checked={on}
                  disabled={!open}
                  className={`deck ${on ? 'is-on' : ''}`}
                  onClick={() => onChange({ ...settings, deckId: d.id })}
                >
                  <span className="deck__main">
                    <span className="deck__title">{d.title}</span>
                    <span className={`deck__sub ${open ? 'hanzi' : ''}`}>
                      {open
                        ? d.chars.map((c) => c.hanzi).join(' ')
                        : `Нужно ${pct(UNLOCK_SHARE)} по памяти: ${deckById(d.requires!).title}`}
                    </span>
                  </span>
                  {open && mode !== 'study' ? (
                    <span className="deck__progress">
                      <span className="deck__pct">{pct(m)}</span>
                      <span className="bar bar--small">
                        <span className="bar__fill" style={{ width: pct(m) }} />
                      </span>
                    </span>
                  ) : open ? null : (
                    <span className="deck__lock" aria-hidden>
                      🔒
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {mode !== 'study' && (
          <p className="panel__note">
            {mode === 'quiz'
              ? 'Процент — пары «знак × направление», на которые вы верно ответили несколько раз подряд.'
              : `Процент — знаки, которые ${mode === 'trace' ? 'обведены' : 'написаны по памяти'} верно несколько раз подряд.`}
          </p>
        )}
      </section>

      {mode === 'recall' && (
        <section className="panel">
          <h2>Знаков за сессию</h2>
          <div className="segmented" role="radiogroup" aria-label="Знаков за сессию">
            {SESSION_LENGTHS.map((n) => (
              <button
                key={n}
                role="radio"
                aria-checked={settings.length === n}
                className={settings.length === n ? 'is-on' : ''}
                onClick={() => onChange({ ...settings, length: n })}
              >
                {n}
              </button>
            ))}
          </div>
        </section>
      )}

      {mode === 'quiz' && (
        <>
          <section className="panel">
            <h2>Направления</h2>
            <ul className="checks">
              {DIRECTIONS.map((d) => (
                <li key={d.id}>
                  <label className="check">
                    <input type="checkbox" checked={settings.directionIds.includes(d.id)} onChange={() => toggle(d.id)} />
                    <span>{d.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="panel__note">«Животное → ветвь» спрашивается только по земным ветвям.</p>
          </section>
          <section className="panel">
            <h2>Вопросов за сессию</h2>
            <div className="segmented" role="radiogroup" aria-label="Вопросов за сессию">
              {QUIZ_LENGTHS.map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={settings.quizLength === n}
                  className={settings.quizLength === n ? 'is-on' : ''}
                  onClick={() => onChange({ ...settings, quizLength: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <button className="btn btn--primary btn--wide" disabled={!canStart} onClick={onStart}>
        {START_LABELS[mode]}: {deck.title}
      </button>
      {!canStart && <p className="hint">Выберите направление, подходящее для этой колоды</p>}

      {canInstall && (
        <button className="btn btn--wide" onClick={install}>
          Установить на устройство
        </button>
      )}
      {iosHint && (
        <p className="hint">Чтобы установить на iPhone: «Поделиться» → «На экран „Домой“». Работает и без интернета.</p>
      )}

      <section className="panel">
        <h2>Тема</h2>
        <div className="segmented" role="radiogroup" aria-label="Тема">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={settings.theme === t.id}
              className={settings.theme === t.id ? 'is-on' : ''}
              onClick={() => onChange({ ...settings, theme: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="panel__note">«Авто» — как в настройках телефона.</p>
      </section>

      <button className="btn btn--ghost btn--small" onClick={reset}>
        Сбросить прогресс
      </button>
    </main>
  );
}
