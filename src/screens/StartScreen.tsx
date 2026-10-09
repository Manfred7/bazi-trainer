import { useInstall } from '../logic/install';
import { DECKS } from '../logic/decks';
import { MODES, type Settings } from '../logic/settings';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onStart: () => void;
}

const MODE_NOTES = {
  study: 'Знак на клетке, чтения и значение. Порядок черт — анимацией, целиком или по одной черте.',
  trace:
    'Обведите знак пальцем по бледному контуру. Черты проверяются по порядку и направлению; после двух ошибок на черте она покажется сама.',
  recall: 'Письмо по памяти на пустой клетке.',
  quiz: 'Выбор из четырёх: чтение, стихия, знак, животное.',
} as const;

const START_LABELS = {
  study: 'Смотреть',
  trace: 'Обводить',
  recall: 'Писать',
  quiz: 'Начать',
} as const;

export function StartScreen({ settings, onChange, onStart }: Props) {
  const { canInstall, iosHint, install } = useInstall();
  const { mode } = settings;
  const deck = DECKS.find((d) => d.id === settings.deckId) ?? DECKS[0];

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
        <p className="panel__note">
          {MODE_NOTES[mode]}
          {MODES.some((m) => !m.ready) && ' Остальные режимы появятся в следующих версиях.'}
        </p>
      </section>

      <section className="panel">
        <h2>Колода</h2>
        <ul className="decks" role="radiogroup" aria-label="Колода">
          {DECKS.map((d) => {
            const on = d.id === deck.id;
            return (
              <li key={d.id}>
                <button
                  role="radio"
                  aria-checked={on}
                  className={`deck ${on ? 'is-on' : ''}`}
                  onClick={() => onChange({ ...settings, deckId: d.id })}
                >
                  <span className="deck__main">
                    <span className="deck__title">{d.title}</span>
                    <span className="deck__sub hanzi">{d.chars.map((c) => c.hanzi).join(' ')}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

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
    </main>
  );
}
