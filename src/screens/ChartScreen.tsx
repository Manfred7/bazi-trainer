import { useState } from 'react';
import { PillarView } from '../components/Seal';
import { chartChars } from '../logic/calendar';
import { type Journal, type SavedChart, chartOf, newChartId } from '../logic/journal';
import { knowsByHeart } from '../logic/path';
import type { Progress } from '../logic/progress';

interface Props {
  journal: Journal;
  progress: Progress;
  onChange: (j: Journal) => void;
  onLearn: () => void;
  onExit: () => void;
}

/** Мои карты: своя (первая) и близких — четыре столпа, проверка себя «по чтениям» и знаки к изучению */
export function ChartScreen({ journal, progress, onChange, onLearn, onExit }: Props) {
  const [adding, setAdding] = useState(journal.charts.length === 0);

  const add = (c: SavedChart) => {
    onChange({ ...journal, charts: [...journal.charts, c] });
    setAdding(false);
  };
  const remove = (c: SavedChart) => {
    if (window.confirm(`Удалить карту «${c.name}»?`)) onChange({ ...journal, charts: journal.charts.filter((x) => x.id !== c.id) });
  };

  return (
    <main className="screen" data-screen="charts">
      <div className="quiz__top">
        <button className="icon-btn" onClick={onExit} aria-label="В меню">
          ←
        </button>
        <h1 className="screen__title">Мои карты</h1>
      </div>

      {journal.charts.map((c, i) => (
        <ChartCard key={c.id} chart={c} mine={i === 0} progress={progress} onRemove={() => remove(c)} />
      ))}

      {journal.charts.length > 0 && (
        <section className="panel">
          <label className="check">
            <input
              type="checkbox"
              checked={journal.focusChart}
              onChange={() => onChange({ ...journal, focusChart: !journal.focusChart })}
            />
            <span>В пути сначала знаки моей карты</span>
          </label>
          <button className="btn btn--primary btn--wide" onClick={onLearn}>
            Продолжить путь
          </button>
        </section>
      )}

      {adding ? (
        <ChartForm first={journal.charts.length === 0} onSave={add} onCancel={journal.charts.length ? () => setAdding(false) : undefined} />
      ) : (
        <button className="btn btn--wide" onClick={() => setAdding(true)}>
          + Карта близкого
        </button>
      )}
      <p className="hint">Даты рождения хранятся только на этом устройстве.</p>
    </main>
  );
}

function ChartCard({
  chart,
  mine,
  progress,
  onRemove,
}: {
  chart: SavedChart;
  mine: boolean;
  progress: Progress;
  onRemove: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const c = chartOf(chart);
  const chars = chartChars(c);
  const known = chars.filter((ch) => knowsByHeart(progress, ch.id)).length;
  const pillars = [
    { title: 'Час', p: c.hour },
    { title: 'День', p: c.day },
    { title: 'Месяц', p: c.month },
    { title: 'Год', p: c.year },
  ];

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>{mine ? `Моя карта · ${chart.name}` : chart.name}</h2>
        <button className="link" onClick={onRemove}>
          Удалить
        </button>
      </div>
      <p className="panel__note">
        {chart.date.split('-').reverse().join('.')}
        {chart.time ? `, ${chart.time}` : ', час неизвестен'}
      </p>
      <div className="pillars">
        {pillars.map(({ title, p }) =>
          p ? (
            <PillarView key={title} title={title} pillar={p} progress={progress} hidden={hidden} />
          ) : (
            <div key={title} className="pillar pillar--empty">
              <span className="pillar__title">{title}</span>
              <span className="muted">—</span>
            </div>
          ),
        )}
      </div>
      <div className="panel__head">
        <span className="panel__note">
          Знаков по памяти: {known} из {chars.length}
        </span>
        <button className="link" onClick={() => setHidden(!hidden)}>
          {hidden ? 'Показать знаки' : 'Проверить себя'}
        </button>
      </div>
      {hidden && (
        <p className="panel__note">Напишите карту в тетради по чтениям, затем нажмите «Показать знаки» и сверьте.</p>
      )}
      {c.nearBoundary && (
        <p className="panel__note warn">
          Рядом смена сезона — столп месяца (и года, если это начало февраля) стоит сверить с калькулятором.
        </p>
      )}
    </section>
  );
}

function ChartForm({
  first,
  onSave,
  onCancel,
}: {
  first: boolean;
  onSave: (c: SavedChart) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(first ? 'Я' : '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const ok = name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date);

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSave({ id: newChartId(), name: name.trim(), date, ...(time ? { time } : {}) });
      }}
    >
      <h2>{first ? 'Моя карта' : 'Новая карта'}</h2>
      {first && (
        <p className="panel__note">
          Знаки своей карты — самые нужные: путь начнёт с них, а когда выучите все — карту можно будет записать
          в тетрадь по памяти.
        </p>
      )}
      <label className="field">
        <span>Имя</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </label>
      <label className="field">
        <span>Дата рождения</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} min="1900-01-01" max="2100-12-31" />
      </label>
      <label className="field">
        <span>Время (если известно)</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <p className="panel__note">
        Время — по местным часам; поправку на солнечное время и раннюю Крысу (23:00) приложение не делает.
      </p>
      <div className="study__nav">
        {onCancel ? (
          <button type="button" className="btn" onClick={onCancel}>
            Отмена
          </button>
        ) : (
          <span />
        )}
        <button className="btn btn--primary" disabled={!ok}>
          Сохранить
        </button>
      </div>
    </form>
  );
}
