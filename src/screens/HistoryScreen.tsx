import { MomentPillars, RankEmblem } from '../components/RankBadge';
import { type Award, awardDate } from '../logic/journal';
import type { Progress } from '../logic/progress';
import { RANKS, type RankProgress } from '../logic/ranks';

interface Props {
  awards: Award[];
  rank: RankProgress;
  progress: Progress;
  onExit: () => void;
}

/** Мой путь: звания по порядку, когда присвоены — датой и четырьмя столпами того момента; дальше — следующее */
export function HistoryScreen({ awards, rank, progress, onExit }: Props) {
  const byRank = new Map(awards.map((a) => [a.rank, a]));
  const { next, share, steps, days, chains } = rank;

  return (
    <main className="screen" data-screen="history">
      <div className="quiz__top">
        <button className="icon-btn" onClick={onExit} aria-label="В меню">
          ←
        </button>
        <h1 className="screen__title">Мой путь</h1>
      </div>

      <ol className="timeline">
        {RANKS.slice(0, rank.index + 1).map((r, i) => {
          const award = byRank.get(i);
          return (
            <li key={r.id} className="timeline__item">
              <RankEmblem index={i} size={56} />
              <div className="timeline__body">
                <strong className="timeline__title">{r.title}</strong>
                {award ? (
                  <>
                    <span className="muted">
                      {i === 0 ? 'Начало пути' : 'Присвоено'} {awardDate(award)}
                    </span>
                    <MomentPillars award={award} progress={progress} />
                  </>
                ) : (
                  <span className="muted">Дата не записана</span>
                )}
              </div>
            </li>
          );
        })}
        {next && (
          <li className="timeline__item is-next">
            <RankEmblem index={rank.index + 1} size={56} locked />
            <div className="timeline__body">
              <strong className="timeline__title">{next.title}</strong>
              <span className="bar">
                <span className="bar__fill" style={{ width: `${Math.round(share * 100)}%` }} />
              </span>
              <span className="muted">
                Ступеней {Math.min(steps, next.steps)}/{next.steps}
                {next.days > 0 && ` · дней столпа ${Math.min(days, next.days)}/${next.days}`}
                {next.chains > 0 && ` · дней цепочек ${Math.min(chains, next.chains)}/${next.chains}`}
              </span>
            </div>
          </li>
        )}
      </ol>
      <p className="hint">
        Время — по часам устройства; столпы часа, дня, месяца и года — того момента, когда звание присвоено.
      </p>
    </main>
  );
}
