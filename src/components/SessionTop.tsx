interface Props {
  done: number;
  total: number;
  onExit: () => void;
}

/** Шапка сессии: выход, полоса прогресса и счётчик */
export function SessionTop({ done, total, onExit }: Props) {
  return (
    <div className="quiz__top">
      <button className="icon-btn" onClick={onExit} aria-label="В меню">
        ←
      </button>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="progress__fill" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="quiz__count">
        {done}/{total}
      </span>
    </div>
  );
}
