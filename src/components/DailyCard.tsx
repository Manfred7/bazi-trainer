import { useState } from 'react';
import { chartFor, parseIso, todayIso } from '../logic/calendar';
import { dailyStreak } from '../logic/journal';
import { knowsByHeart } from '../logic/path';
import type { Progress } from '../logic/progress';
import { PillarView } from './Seal';

interface Props {
  progress: Progress;
  daily: string[];
  /** Столп дня записан в тетрадь; ok — по памяти и верно (идёт в прогресс тетради) */
  onDone: (ok: boolean | null) => void;
}

function daysLabel(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
}

/**
 * Столп дня: каждый день записать в тетрадь столп сегодняшнего дня. Знаки, освоенные по памяти,
 * сначала скрыты — пишем по чтениям и сверяем; незнакомые — просто переписываем.
 */
export function DailyCard({ progress, daily, onDone }: Props) {
  const today = todayIso();
  const chart = chartFor(...parseIso(today));
  const known = knowsByHeart(progress, chart.day.stem.id) && knowsByHeart(progress, chart.day.branch.id);
  const [revealed, setRevealed] = useState(!known);
  const done = daily.includes(today);
  const streak = dailyStreak(daily);

  return (
    <section className="panel daily">
      <div className="panel__head">
        <h2>Столп дня</h2>
        {streak > 0 && (
          <span className="daily__streak">
            {streak} {daysLabel(streak)} подряд
          </span>
        )}
      </div>
      <div className="pillars">
        <PillarView title="День" pillar={chart.day} progress={progress} hidden={!revealed} />
        <PillarView title="Месяц" pillar={chart.month} progress={progress} />
        <PillarView title="Год" pillar={chart.year} progress={progress} />
      </div>
      {done ? (
        <p className="panel__note is-ok">Сегодня записан. Завтра — новый столп.</p>
      ) : !revealed ? (
        <>
          <p className="panel__note">Напишите столп дня в тетради по чтениям, потом сверьте.</p>
          <button className="btn" onClick={() => setRevealed(true)}>
            Сверить
          </button>
        </>
      ) : known ? (
        <div className="study__nav">
          <button className="btn" onClick={() => onDone(false)}>
            Ошибся
          </button>
          <button className="btn btn--primary" onClick={() => onDone(true)}>
            Написал верно
          </button>
        </div>
      ) : (
        <>
          <p className="panel__note">Перепишите столп дня в тетрадь — знаки дня станут знакомыми раньше, чем дойдёт путь.</p>
          <button className="btn btn--primary" onClick={() => onDone(null)}>
            Записал(а) в тетрадь
          </button>
        </>
      )}
    </section>
  );
}
