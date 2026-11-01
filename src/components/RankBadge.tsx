import { useState } from 'react';
import { type Award, awardChart, awardDate } from '../logic/journal';
import type { Progress } from '../logic/progress';
import { RANKS, type RankProgress } from '../logic/ranks';
import { PillarView } from './Seal';

/** Эмблема звания: картинка из public/ranks (рисует Codex, scripts/gen-ranks.ps1), без неё — печать с номером */
export function RankEmblem({ index, size = 64, locked = false }: { index: number; size?: number; locked?: boolean }) {
  const [broken, setBroken] = useState(false);
  const rank = RANKS[index];
  return (
    <span className={`emblem ${locked ? 'is-locked' : ''}`} style={{ width: size, height: size }}>
      {broken ? (
        <span className="emblem__fallback" style={{ fontSize: size * 0.4 }}>
          {index + 1}
        </span>
      ) : (
        <img src={`${import.meta.env.BASE_URL}ranks/${rank.id}.webp`} alt="" onError={() => setBroken(true)} />
      )}
    </span>
  );
}

/** Звание, шкала до следующего и что для него нужно; по нажатию — лестница всех званий */
export function RankCard({ progress, onHistory }: { progress: RankProgress; onHistory: () => void }) {
  const [open, setOpen] = useState(false);
  const { rank, index, next, share, steps, days } = progress;

  return (
    <section className="panel rank">
      <button className="rank__history" onClick={onHistory} aria-label="Мой путь: когда получены звания">
        Мой путь ›
      </button>
      <button className="rank__head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <RankEmblem index={index} size={72} />
        <span className="rank__main">
          <span className="rank__label">Звание</span>
          <span className="rank__title">{rank.title}</span>
          <span className="bar">
            <span className="bar__fill" style={{ width: `${Math.round(share * 100)}%` }} />
          </span>
          <span className="rank__next">
            {next ? (
              <>
                До «{next.title}»: ступеней {Math.min(steps, next.steps)}/{next.steps}
                {next.days > 0 && ` · дней столпа ${Math.min(days, next.days)}/${next.days}`}
              </>
            ) : (
              'Высшее звание — полный цикл пройден'
            )}
          </span>
        </span>
      </button>

      {open && (
        <>
          <ol className="ranks">
            {RANKS.map((r, i) => (
              <li key={r.id} className={i === index ? 'is-current' : i > index ? 'is-locked' : ''}>
                <RankEmblem index={i} size={44} locked={i > index} />
                <span>
                  <strong>{r.title}</strong>
                  <span className="muted">
                    {i === 0
                      ? 'Начало пути'
                      : `${r.steps} ступеней${r.days ? ` · ${r.days} ${r.days === 3 ? 'дня' : 'дней'} столпа` : ''}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="panel__note">
            Ступень — шаг одного знака по пути (у 22 знаков по 5 ступеней). Дни столпа — сколько дней столп дня
            записан в тетрадь. Полученное звание не отнимается.
          </p>
        </>
      )}
    </section>
  );
}

/** Момент по китайскому календарю: четыре столпа — час, день, месяц, год */
export function MomentPillars({ award, progress }: { award: Award; progress: Progress }) {
  const c = awardChart(award);
  const pillars = [
    { title: 'Час', p: c.hour! },
    { title: 'День', p: c.day },
    { title: 'Месяц', p: c.month },
    { title: 'Год', p: c.year },
  ];
  return (
    <div className="pillars pillars--small">
      {pillars.map(({ title, p }) => (
        <PillarView key={title} title={title} pillar={p} progress={progress} />
      ))}
    </div>
  );
}

/** Поздравление с новым званием */
export function RankUp({
  index,
  award,
  progress,
  onClose,
  onHistory,
}: {
  index: number;
  award?: Award;
  progress: Progress;
  onClose: () => void;
  onHistory: () => void;
}) {
  const rank = RANKS[index];
  const next = RANKS[index + 1];
  return (
    <div className="rankup" role="dialog" aria-modal="true" aria-labelledby="rankup-title">
      <div className="rankup__card">
        <p className="rankup__label">Новое звание</p>
        <RankEmblem index={index} size={160} />
        <h2 id="rankup-title" className="rankup__title">
          {rank.title}
        </h2>
        {award && (
          <>
            <p className="muted">Присвоено {awardDate(award)}</p>
            <MomentPillars award={award} progress={progress} />
          </>
        )}
        <p className="muted">
          {next
            ? `Следующее — «${next.title}»: ${next.steps} ступеней${next.days ? ` и ${next.days} ${next.days === 3 ? 'дня' : 'дней'} столпа` : ''}.`
            : 'Все знаки освоены, цикл из 60 дней пройден.'}
        </p>
        <button className="btn btn--primary btn--wide" onClick={onClose} autoFocus>
          Продолжить
        </button>
        <button className="link" onClick={onHistory}>
          Мой путь
        </button>
      </div>
    </div>
  );
}
