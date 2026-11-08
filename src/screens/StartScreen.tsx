import { CharPicker } from '../components/CharPicker';
import { DailyCard } from '../components/DailyCard';
import { RankCard } from '../components/RankBadge';
import { Seal } from '../components/Seal';
import { type BaziChar, CHARACTERS } from '../data/characters';
import { DECKS, type Deck, deckById, isAvailable } from '../logic/decks';
import { useInstall } from '../logic/install';
import { todayIso } from '../logic/calendar';
import { CHAINS_FROM_RANK, CHAIN_PASS_MISTAKES } from '../logic/chain';
import type { Journal } from '../logic/journal';
import { STAGES, STAGE_LABEL, dueReviews, ladder } from '../logic/path';
import { type Progress, UNLOCK_SHARE, mastery } from '../logic/progress';
import { DIRECTIONS, canAsk, quizMastery } from '../logic/quiz';
import { RANKS, type RankProgress } from '../logic/ranks';
import { PASS_MISTAKES } from '../logic/session';
import { MODES, QUIZ_LENGTHS, SESSION_LENGTHS, type Settings } from '../logic/settings';
import { THEMES } from '../logic/theme';
import { APP_VERSION } from '../logic/update';

interface Props {
  settings: Settings;
  progress: Progress;
  journal: Journal;
  rank: RankProgress;
  /** Колода, которая реально будет запущена (выбранная, если она открыта) */
  deck: Deck;
  onChange: (s: Settings) => void;
  onResetProgress: () => void;
  onStart: () => void;
  onPath: () => void;
  onCharts: () => void;
  onCycle: () => void;
  onHistory: () => void;
  onStats: () => void;
  /** Свободная практика: один знак по всем шагам подряд */
  onDrill: (char: BaziChar) => void;
  onDaily: (ok: boolean | null) => void;
  /** Начать цепочку: столпы этого момента или случайной даты */
  onChain: (moment: boolean) => void;
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

export function StartScreen({
  settings,
  progress,
  journal,
  rank,
  deck,
  onChange,
  onResetProgress,
  onStart,
  onPath,
  onCharts,
  onCycle,
  onHistory,
  onStats,
  onDrill,
  onDaily,
  onChain,
}: Props) {
  const counts = ladder(progress);
  const chainsNeed = RANKS[RANKS.length - 1].chains;
  const due = dueReviews(progress).length;
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
    if (
      window.confirm(
        'Сбросить всё? Знаки вернутся к знакомству, звание — к «Новичку»; сотрутся история званий, дни столпа, сохранённые карты и статистика, открытые колоды закроются. Останутся только тема и скорость анимации.',
      )
    )
      onResetProgress();
  };

  return (
    <main className="screen start" data-screen="start">
      <header className="start__hero">
        <div className="start__glyphs hanzi" aria-hidden>
          甲乙丙丁 子丑寅卯
        </div>
        <h1>Прописи БаЦзы</h1>
        <p className="muted">Как пишется, читается и что значит каждый знак</p>
      </header>

      <RankCard progress={rank} onHistory={onHistory} />

      <section className="panel">
        <div className="panel__head">
          <h2>Путь знака</h2>
          <span className="panel__note">
            Печатей: {counts.done} из {CHARACTERS.length}
          </span>
        </div>
        <ol className="ladder">
          {STAGES.map((s) => (
            <li key={s.id} className={counts[s.id] ? 'is-on' : ''}>
              <span className="ladder__n">{counts[s.id]}</span>
              <span className="ladder__label">{STAGE_LABEL[s.id]}</span>
            </li>
          ))}
        </ol>
        <div className="seals">
          {CHARACTERS.map((c) => (
            <Seal key={c.id} char={c} progress={progress} />
          ))}
        </div>
        <button className="btn btn--primary btn--wide" data-testid="path-start" onClick={onPath}>
          Продолжить путь
        </button>
        {counts.done > 0 && (
          <p className={`panel__note ${due ? 'due' : ''}`}>
            {due ? `К повторению сегодня: ${due} ${due === 1 ? 'знак' : due < 5 ? 'знака' : 'знаков'}` : 'Повторения на сегодня сделаны'}
          </p>
        )}
        <p className="panel__note">
          Приложение само ведёт каждый знак: знакомство → обводка → полуконтур → взгляни и напиши → по памяти →
          тетрадь. Две чистые попытки — ступень пройдена. Освоенные знаки возвращаются на повторение через 1, 3,
          8, 20… дней.
        </p>
      </section>

      <DailyCard progress={progress} daily={journal.daily} onDone={onDaily} />

      {(rank.index >= CHAINS_FROM_RANK || settings.unlockAll) && (
        <section className="panel">
          <div className="panel__head">
            <h2>Цепочки столпов</h2>
            <span className="panel__note">
              Чистых дней: {Math.min(journal.chains.length, chainsNeed)} из {chainsNeed}
            </span>
          </div>
          <p className="panel__note">
            Год, месяц, день и час — восемь знаков подряд по памяти, по чтениям. Цепочка чистая, если ошибок не больше{' '}
            {CHAIN_PASS_MISTAKES}. Чистые дни нужны для звания «Гранд мастер».
            {journal.chains.includes(todayIso()) && ' Сегодня уже засчитано.'}
          </p>
          <div className="study__nav">
            <button className="btn" onClick={() => onChain(true)}>
              Этот момент
            </button>
            <button className="btn btn--primary" onClick={() => onChain(false)}>
              Случайная дата
            </button>
          </div>
        </section>
      )}

      <div className="study__nav">
        <button className="btn" data-testid="charts" onClick={onCharts}>
          {journal.charts.length ? 'Мои карты' : 'Моя карта'}
        </button>
        <button className="btn" data-testid="cycle" onClick={onCycle}>
          Цикл 60
        </button>
      </div>
      <button className="btn btn--wide" data-testid="stats" onClick={onStats}>
        Моя статистика
      </button>

      <details className="panel free" data-testid="free">
        <summary>
          <h2>Свободная практика</h2>
        </summary>
        <p className="panel__note">Любой режим и колода вручную — прогресс общий с путём.</p>

        <section className="panel">
          <h2>Один знак — все шаги</h2>
          <p className="panel__note">
            Знакомство → какая черта следующая → обводка → полуконтур → взгляни и напиши → по памяти. Шаг засчитан, если
            ошибок не больше {PASS_MISTAKES}, иначе его повторяют. На прогресс пути не влияет.
          </p>
          <CharPicker onPick={onDrill} />
        </section>

        <section className="panel">
          <h2>Режим</h2>
          <div className="segmented segmented--4" role="radiogroup" aria-label="Режим">
            {MODES.map((m) => (
              <button
                key={m.id}
                data-mode={m.id}
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
                    data-deck={d.id}
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
                  data-length={n}
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
                    data-quiz-length={n}
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

        <button className="btn btn--primary btn--wide" data-testid="free-start" disabled={!canStart} onClick={onStart}>
          {START_LABELS[mode]}: {deck.title}
        </button>
        {!canStart && <p className="hint">Выберите направление, подходящее для этой колоды</p>}
      </details>

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
              data-theme-option={t.id}
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
        Сбросить всё
      </button>
      <p className="app-version">Версия от {APP_VERSION}</p>
    </main>
  );
}
