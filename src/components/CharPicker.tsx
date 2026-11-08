import { BRANCHES, type BaziChar, STEMS } from '../data/characters';

/** Сетка из 22 знаков: стволы, потом ветви; цвет — стихия знака */
export function CharPicker({ onPick }: { onPick: (c: BaziChar) => void }) {
  return (
    <div className="char-pick">
      {[
        { title: 'Стволы', chars: STEMS },
        { title: 'Ветви', chars: BRANCHES },
      ].map((g) => (
        <div key={g.title} className="char-pick__group">
          <p className="panel__note">{g.title}</p>
          <div className="char-pick__grid">
            {g.chars.map((c) => (
              <button
                key={c.id}
                className={`char-pick__btn hanzi el-${c.element}`}
                onClick={() => onPick(c)}
                aria-label={`${c.ru} (${c.pinyin})`}
                title={`${c.ru} · ${c.pinyin}`}
              >
                {c.hanzi}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
