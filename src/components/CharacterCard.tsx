import { type BaziChar, ELEMENTS, YIN_YANG } from '../data/characters';

const KIND = { stem: { title: 'Ствол', of: 10 }, branch: { title: 'Ветвь', of: 12 } } as const;

/** Подписи знака: чтения, стихия, инь/ян и (у ветвей) животное */
export function CharacterInfo({ char }: { char: BaziChar }) {
  const kind = KIND[char.kind];
  return (
    <div className="info">
      <p className="info__reading">
        <span className="info__ru">{char.ru}</span>
        <span className="info__pinyin">{char.pinyin}</span>
      </p>
      <p className="info__tags">
        <span className={`tag el-${char.element}`}>{ELEMENTS[char.element]}</span>
        <span className="tag">{YIN_YANG[char.yinYang]}</span>
        {char.animal && <span className={`tag tag--animal el-${char.element}`}>{char.animal}</span>}
      </p>
      <p className="muted info__kind">
        {kind.title} {char.order} из {kind.of}
      </p>
    </div>
  );
}
