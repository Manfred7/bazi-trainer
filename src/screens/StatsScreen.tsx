import { useMemo, useState } from 'react';
import { StrokeFocus } from '../components/StrokeGuide';
import { todayIso } from '../logic/calendar';
import { STAGE_LABEL, stageOf } from '../logic/path';
import type { Progress } from '../logic/progress';
import {
  EMPTY_STATS,
  KEEP_DAYS,
  KEEP_EVENTS,
  MONTH_DAYS,
  type PeriodSummary,
  type Stats,
  type TroubleType,
  clearStats,
  compact,
  loadStats,
  summarize,
} from '../logic/stats';

interface Props {
  progress: Progress;
  onExit: () => void;
}

const plural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return `${n} ${one}`;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
};
const times = (n: number) => plural(n, 'раз', 'раза', 'раз');

const TYPE_LABEL: Record<TroubleType, string> = {
  order: 'Вероятно, порядок черт',
  direction: 'Направление',
  shape: 'Форма или место',
  hint: 'Подсказки',
};

/** Что чаще всего случается на черте — без оценки, как наблюдение */
const STROKE_NOTE: Record<TroubleType, string> = {
  order: 'чаще всего раньше неё, вероятно, пишется другая',
  direction: 'чаще всего ведётся в обратную сторону',
  shape: 'чаще всего не сходится форма или место',
  hint: 'чаще всего здесь нужна подсказка',
};

const TYPE_ORDER: TroubleType[] = ['order', 'direction', 'shape', 'hint'];

/** Доли типов за период: подпись, полоса одного цвета и значение рядом */
function TypeBars({ period }: { period: PeriodSummary }) {
  if (!period.total) return <p className="panel__note">За это время ошибок и подсказок не было.</p>;
  return (
    <ul className="shares">
      {TYPE_ORDER.map((t) => {
        const share = Math.round((period.counts[t] / period.total) * 100);
        return (
          <li key={t} className="shares__row">
            <span>{TYPE_LABEL[t]}</span>
            <span className="shares__value">
              {share}% · {period.counts[t]}
            </span>
            <span className="bar" aria-hidden>
              <span className="bar__fill" style={{ width: `${share}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Файл собирается здесь же, в браузере, и сохраняется на устройство */
function download(stats: Stats) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `bazi-stats-${todayIso()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Моя статистика: что получается и на чём стоит задержаться. Всё считается на устройстве */
export function StatsScreen({ progress, onExit }: Props) {
  const [stats, setStats] = useState<Stats>(() => compact(loadStats()));
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const s = useMemo(() => summarize(stats), [stats]);
  const empty = !stats.events.length && !Object.keys(stats.months).length;

  const clear = () => {
    if (!window.confirm('Очистить статистику? Прогресс знаков и звания останутся.')) return;
    clearStats();
    setStats(EMPTY_STATS);
  };

  const fewer = s.week.rate !== null && s.prevWeek.rate !== null && s.week.rate < s.prevWeek.rate;

  return (
    <main className="screen stats" data-screen="stats">
      <div className="quiz__top">
        <button className="icon-btn" onClick={onExit} aria-label="В меню">
          ←
        </button>
        <h1 className="screen__title">Моя статистика</h1>
      </div>

      {empty ? (
        <section className="panel">
          <p>Пока здесь пусто — и это нормально.</p>
          <p className="panel__note">
            Напишите несколько знаков: здесь появится, что уже получается и на каких чертах стоит задержаться.
          </p>
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>Что получается</h2>
            <p>
              За {MONTH_DAYS} дней: {plural(s.days, 'день', 'дня', 'дней')} занятий,{' '}
              {plural(s.strokes, 'черта написана', 'черты написано', 'черт написано')}.
              {s.allStrokes > s.strokes && ` Всего: ${plural(s.allStrokes, 'черта', 'черты', 'черт')}.`}
            </p>
            {s.steady.length > 0 && (
              <div>
                <p className="panel__note">Последние три раза — без единой ошибки:</p>
                <p className="hanzi stats__steady">{s.steady.map((c) => c.hanzi).join(' ')}</p>
              </div>
            )}
            {s.week.clean > 0 && (
              <p className="panel__note">
                Без единой ошибки на этой неделе: {plural(s.week.clean, 'знак', 'знака', 'знаков')}
                {s.prevWeek.clean > 0 && ` (на прошлой — ${s.prevWeek.clean})`}.
              </p>
            )}
            {fewer && (
              <p className="panel__note">
                Ошибок на 100 черт стало меньше: {Math.round(s.week.rate!)} против {Math.round(s.prevWeek.rate!)} на
                прошлой неделе.
              </p>
            )}
          </section>

          <section className="panel">
            <h2>Знаки, на которых стоит задержаться</h2>
            {s.hardChars.length ? (
              <ul className="stats__list">
                {s.hardChars.map(({ char, per100 }) => (
                  <li key={char.id} className="stats__row">
                    <span className="hanzi stats__hanzi">{char.hanzi}</span>
                    <span className="stats__body">
                      <span>{char.ru}</span>
                      <span className="panel__note">
                        {STAGE_LABEL[stageOf(progress, char.id)]} · {plural(per100, 'ошибка', 'ошибки', 'ошибок')} на 100 черт
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel__note">За {MONTH_DAYS} дней таких знаков нет.</p>
            )}
          </section>

          {s.hardStrokes.length > 0 && (
            <section className="panel">
              <h2>Черты, на которых стоит задержаться</h2>
              <ul className="stats__list">
                {s.hardStrokes.map(({ char, stroke, count, top }) => (
                  <li key={`${char.id}-${stroke}`} className="stats__row">
                    <StrokeFocus hanzi={char.hanzi} stroke={stroke} size={72} />
                    <span className="stats__body">
                      <span>
                        {stroke + 1}-я черта <span className="hanzi">{char.hanzi}</span>
                      </span>
                      <span className="panel__note">
                        {STROKE_NOTE[top]} · {times(count)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel">
            <h2>Какие бывают сложности</h2>
            <div className="segmented" role="radiogroup" aria-label="За какое время">
              {(
                [
                  ['week', 'Неделя'],
                  ['month', `${MONTH_DAYS} дней`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={period === id}
                  className={period === id ? 'is-on' : ''}
                  onClick={() => setPeriod(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <TypeBars period={period === 'week' ? s.week : s.month} />
            <p className="panel__note">
              «Вероятно, порядок» — штрих похож на другую, ещё не написанную черту. Это догадка: короткий штрих бывает
              похож на несколько черт сразу.
            </p>
          </section>

          {s.pairs.length > 0 && (
            <section className="panel">
              <h2>Что путается в узнавании</h2>
              <ul className="stats__pairs">
                {s.pairs.map(({ a, b, count, lookalike }) => (
                  <li key={`${a}${b}`}>
                    <span className="hanzi stats__pair">
                      {a} ↔ {b}
                    </span>
                    <span className="panel__note">
                      {times(count)}
                      {lookalike && ' · похожи по виду'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="panel">
        <h2>Что собираем</h2>
        <p className="panel__note">
          Всё лежит только на этом устройстве, наружу ничего не уходит: приложение никуда не отправляет статистику.
        </p>
        <ul className="stats__facts">
          <li>Какой знак, на какой ступени, номер черты, тип ошибки и день — без времени суток.</li>
          <li>Подсказки, «Заново», шаги назад, ответы в тетради, неверные варианты в узнавании.</li>
          <li>Сам штрих не хранится: он нужен на миг, чтобы понять тип ошибки.</li>
          <li>Карты рождения, имена и даты сюда не попадают.</li>
          <li>
            Хранятся последние {KEEP_DAYS} дней, не больше {KEEP_EVENTS} записей; что старше — только счётчики по месяцам.
          </li>
          <li>Файл из «Выгрузить» останется у вас, пока вы сами его кому-нибудь не передадите.</li>
        </ul>
        <div className="study__nav">
          <button className="btn" disabled={empty} onClick={() => download(stats)}>
            Выгрузить в JSON
          </button>
          <button className="btn" disabled={empty} onClick={clear}>
            Очистить
          </button>
        </div>
      </section>
    </main>
  );
}
