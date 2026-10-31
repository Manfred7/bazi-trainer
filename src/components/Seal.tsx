import type { BaziChar } from '../data/characters';
import type { Pillar } from '../logic/calendar';
import { STAGE_LABEL, knowsByHeart, stageOf } from '../logic/path';
import type { Progress } from '../logic/progress';

/**
 * Печать знака: освоен целиком (по памяти и в тетради) — красная печать, только по памяти — красная рамка,
 * в работе — тушь, не начат — бледно
 */
function sealClass(p: Progress, charId: string) {
  const stage = stageOf(p, charId);
  if (stage === 'done') return 'seal seal--done';
  if (stage === 'paper') return 'seal seal--heart';
  if (stage === 'intro') return 'seal seal--none';
  return 'seal seal--learning';
}

export function Seal({ char, progress, size = 'md' }: { char: BaziChar; progress: Progress; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`${sealClass(progress, char.id)} seal--${size} hanzi`}
      title={`${char.ru} · ${STAGE_LABEL[stageOf(progress, char.id)]}`}
    >
      {char.hanzi}
    </span>
  );
}

/** Столп: ствол над ветвью; hidden — вместо знаков чтения (проверка себя) */
export function PillarView({
  title,
  pillar,
  progress,
  hidden = false,
}: {
  title: string;
  pillar: Pillar;
  progress: Progress;
  hidden?: boolean;
}) {
  return (
    <div className="pillar">
      <span className="pillar__title">{title}</span>
      {[pillar.stem, pillar.branch].map((c) =>
        hidden ? (
          <span key={c.id} className={`pillar__reading el-${c.element}`}>
            {c.ru.split(' ')[0]}
          </span>
        ) : (
          <span key={c.id} className={`pillar__char el-${c.element} hanzi ${knowsByHeart(progress, c.id) ? 'is-sealed' : ''}`}>
            {c.hanzi}
          </span>
        ),
      )}
    </div>
  );
}
