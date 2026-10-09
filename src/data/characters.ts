// Знаки БаЦзы по прописям (docs/stage0-pdf-review.md): чтения — как в прописях, пиньинь без тонов

export type Kind = 'stem' | 'branch';
export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export type YinYang = 'yang' | 'yin';

export interface BaziChar {
  /** Пиньинь латиницей в нижнем регистре; у 戊 и 午 совпадает, поэтому с префиксом вида */
  id: string;
  hanzi: string;
  kind: Kind;
  /** Номер внутри своего ряда: 1–10 у стволов, 1–12 у ветвей */
  order: number;
  pinyin: string;
  ru: string;
  element: Element;
  yinYang: YinYang;
  animal?: string;
}

export const ELEMENTS: Record<Element, string> = {
  wood: 'Дерево',
  fire: 'Огонь',
  earth: 'Земля',
  metal: 'Металл',
  water: 'Вода',
};

export const YIN_YANG: Record<YinYang, string> = { yang: 'Ян', yin: 'Инь' };

type Row = [hanzi: string, pinyin: string, ru: string, element: Element, yinYang: YinYang, animal?: string];

const STEM_ROWS: Row[] = [
  ['甲', 'Jia', 'Дзя', 'wood', 'yang'],
  ['乙', 'Yi', 'И', 'wood', 'yin'],
  ['丙', 'Bing', 'Бин', 'fire', 'yang'],
  ['丁', 'Ding', 'Дин', 'fire', 'yin'],
  ['戊', 'Wu', 'У', 'earth', 'yang'],
  ['己', 'Ji', 'Джи', 'earth', 'yin'],
  ['庚', 'Geng', 'Гэн', 'metal', 'yang'],
  ['辛', 'Xin', 'Синь', 'metal', 'yin'],
  ['壬', 'Ren', 'Рэн', 'water', 'yang'],
  ['癸', 'Gui', 'Квэй или Гуй', 'water', 'yin'],
];

const BRANCH_ROWS: Row[] = [
  ['子', 'Zi', 'Цзы', 'water', 'yang', 'Крыса'],
  ['丑', 'Chou', 'Чоу', 'earth', 'yin', 'Бык'],
  ['寅', 'Yin', 'Инь', 'wood', 'yang', 'Тигр'],
  ['卯', 'Mao', 'Мао', 'wood', 'yin', 'Кролик'],
  ['辰', 'Chen', 'Чэн', 'earth', 'yang', 'Дракон'],
  ['巳', 'Si', 'Сы', 'fire', 'yin', 'Змея'],
  ['午', 'Wu', 'Ву', 'fire', 'yang', 'Лошадь'],
  ['未', 'Wei', 'Вэй', 'earth', 'yin', 'Коза'],
  ['申', 'Shen', 'Шэн', 'metal', 'yang', 'Обезьяна'],
  ['酉', 'You', 'Ю', 'metal', 'yin', 'Петух'],
  ['戌', 'Xu', 'Сюй', 'earth', 'yang', 'Собака'],
  ['亥', 'Hai', 'Хай', 'water', 'yin', 'Свинья'],
];

const build = (kind: Kind, rows: Row[]): BaziChar[] =>
  rows.map(([hanzi, pinyin, ru, element, yinYang, animal], i) => ({
    id: `${kind}-${pinyin.toLowerCase()}`,
    hanzi,
    kind,
    order: i + 1,
    pinyin,
    ru,
    element,
    yinYang,
    ...(animal ? { animal } : {}),
  }));

export const STEMS = build('stem', STEM_ROWS);
export const BRANCHES = build('branch', BRANCH_ROWS);
export const CHARACTERS = [...STEMS, ...BRANCHES];
