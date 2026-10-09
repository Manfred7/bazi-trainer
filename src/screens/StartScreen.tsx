import { DECKS, type Deck, deckById, isAvailable } from '../logic/decks';
import { useInstall } from '../logic/install';
import { type Progress, UNLOCK_SHARE, mastery } from '../logic/progress';
import { PASS_MISTAKES } from '../logic/session';
import { MODES, SESSION_LENGTHS, type Settings } from '../logic/settings';

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
  quiz: 'Выбор из четырёх: чтение, стихия, знак, животное. Появится в следующей версии.',
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
              disabled={!m.ready}
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
            const m = track ? mastery(progress, d.chars, track) : 0;
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
                  {open && track ? (
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
        {track && (
          <p className="panel__note">
            Процент — знаки, которые {track === 'trace' ? 'обведены' : 'написаны по памяти'} верно несколько раз подряд.
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

      <button className="btn btn--primary btn--wide" onClick={onStart}>
        {START_LABELS[mode]}: {deck.title}
      </button>

      {canInstall && (
        <button className="btn btn--wide" onClick={install}>
          Установить на устройство
        </button>
      )}
      {iosHint && (
        <p className="hint">Чтобы установить на iPhone: «Поделиться» → «На экран „Домой“». Работает и без интернета.</p>
      )}

      <button className="btn btn--ghost btn--small" onClick={reset}>
        Сбросить прогресс
      </button>
    </main>
  );
}
