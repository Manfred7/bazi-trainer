import { type BaziChar, CHARACTERS, ELEMENTS, type Element, YIN_YANG, type YinYang } from '../data/characters';
import { MASTERED_LEVEL, MAX_LEVEL, type Progress, levelOf } from './progress';

export interface Direction {
  id: string;
  label: string;
  /** Вопрос под тем, что показано */
  prompt: string;
  /** Только для земных ветвей (у стволов нет животных) */
  branchesOnly?: boolean;
}

export const DIRECTIONS: Direction[] = [
  { id: 'char>reading', label: 'Знак → чтение', prompt: 'Как читается?' },
  { id: 'char>element', label: 'Знак → стихия и инь/ян', prompt: 'Какая стихия?' },
  { id: 'reading>char', label: 'Чтение → знак', prompt: 'Какой знак?' },
  { id: 'animal>branch', label: 'Животное → ветвь', prompt: 'Какая ветвь?', branchesOnly: true },
];

export const quizTrack = (directionId: string) => `quiz:${directionId}` as const;

export const appliesTo = (d: Direction, c: BaziChar) => !d.branchesOnly || c.kind === 'branch';

/** Вариант ответа: знак (в том числе похожий знак не из набора), чтение или стихия */
export interface Option {
  id: string;
  /** Иероглиф — крупно шрифтом с засечками */
  hanzi?: string;
  text?: string;
  sub?: string;
}

export interface Question {
  char: BaziChar;
  direction: Direction;
  options: Option[];
  answerId: string;
}

export interface QuizAnswer {
  question: Question;
  pickedId: string;
}

export const isCorrect = (a: QuizAnswer) => a.pickedId === a.question.answerId;

/**
 * Похожие по виду знаки — самые трудные неверные варианты (раздел 2 ТЗ).
 * Знаки не из набора (已 戍 末 幸) годятся только там, где ответ — сам иероглиф.
 */
const LOOKALIKES: Record<string, string[]> = {
  己: ['巳', '已'],
  巳: ['己', '已'],
  戊: ['戌', '戍'],
  戌: ['戊', '戍'],
  未: ['末'],
  辛: ['幸'],
};

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const byHanzi = new Map(CHARACTERS.map((c) => [c.hanzi, c]));
const ELEMENT_IDS = Object.keys(ELEMENTS) as Element[];
const YY_IDS = Object.keys(YIN_YANG) as YinYang[];

const charOption = (c: BaziChar): Option => ({ id: c.id, hanzi: c.hanzi });
const readingOption = (c: BaziChar): Option => ({ id: c.id, text: c.ru, sub: c.pinyin });
const elementId = (el: Element, yy: YinYang) => `${el}-${yy}`;
const elementOption = (el: Element, yy: YinYang): Option => ({
  id: elementId(el, yy),
  text: ELEMENTS[el],
  sub: YIN_YANG[yy],
});

/** Набирает n вариантов из групп по очереди: сначала трудные, дальше проще; без повторов */
function fill(n: number, exclude: string, groups: Option[][]): Option[] {
  const seen = new Set([exclude]);
  const out: Option[] = [];
  for (const group of groups) {
    for (const o of shuffle(group)) {
      if (out.length >= n) return out;
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(o);
    }
  }
  return out;
}

/**
 * Неверные варианты по уровню пары: 0–1 — случайные, 2–3 — той же стихии,
 * 4–5 — похожие по виду (если у знака есть пара), затем той же стихии.
 */
function distractors(char: BaziChar, direction: Direction, deck: BaziChar[], level: number, n: number): Option[] {
  const sameKind = (cs: BaziChar[]) => (direction.branchesOnly ? cs.filter((c) => c.kind === 'branch') : cs);
  const others = (cs: BaziChar[]) => sameKind(cs).filter((c) => c.id !== char.id);
  const sameElement = others(CHARACTERS).filter((c) => c.element === char.element);
  const look = level >= 4 ? (LOOKALIKES[char.hanzi] ?? []) : [];
  const hard = level >= 2 ? sameElement : [];

  if (direction.id === 'char>element') {
    const all = ELEMENT_IDS.flatMap((el) => YY_IDS.map((yy) => elementOption(el, yy)));
    // Трудные: та же стихия с другой полярностью — обязательно, затем та же полярность у других стихий
    const opposite = level >= 2 ? [elementOption(char.element, char.yinYang === 'yang' ? 'yin' : 'yang')] : [];
    const samePolarity = level >= 2 ? ELEMENT_IDS.map((el) => elementOption(el, char.yinYang)) : [];
    return fill(n, elementId(char.element, char.yinYang), [opposite, samePolarity, all]);
  }

  if (direction.id === 'char>reading') {
    const lookChars = look.map((h) => byHanzi.get(h)).filter((c): c is BaziChar => !!c);
    return fill(n, char.id, [lookChars, hard, others(deck), others(CHARACTERS)].map((g) => g.map(readingOption)));
  }

  // Ответ — иероглиф: похожие берутся и не из набора
  const lookOptions = look.map((h) => {
    const c = byHanzi.get(h);
    return c ? charOption(c) : { id: `extra-${h}`, hanzi: h };
  });
  return fill(n, char.id, [lookOptions, ...[hard, others(deck), others(CHARACTERS)].map((g) => g.map(charOption))]);
}

function answerOption(char: BaziChar, direction: Direction): Option {
  if (direction.id === 'char>element') return elementOption(char.element, char.yinYang);
  if (direction.id === 'char>reading') return readingOption(char);
  return charOption(char);
}

/**
 * pool — из каких знаков спрашивать, deck — колода, откуда в первую очередь неверные варианты.
 * Пока в сессии есть не показанные знаки — спрашиваем из них. Пара (знак, направление)
 * выбирается с весом MAX_LEVEL + 1 − уровень. Один знак не выпадает дважды подряд.
 */
export function makeQuestion(
  pool: BaziChar[],
  deck: BaziChar[],
  directions: Direction[],
  progress: Progress,
  answers: QuizAnswer[],
): Question {
  const shown = new Set(answers.map((a) => a.question.char.id));
  const fresh = pool.filter((c) => !shown.has(c.id));
  const prevId = answers[answers.length - 1]?.question.char.id;
  let chars = fresh.length ? fresh : pool;
  if (chars.length > 1) chars = chars.filter((c) => c.id !== prevId);

  const pairs = chars.flatMap((char) =>
    directions
      .filter((d) => appliesTo(d, char))
      .map((direction) => ({
        char,
        direction,
        w: MAX_LEVEL + 1 - levelOf(progress, char.id, quizTrack(direction.id)),
      })),
  );
  let r = Math.random() * pairs.reduce((sum, p) => sum + p.w, 0);
  const { char, direction } = pairs.find((p) => (r -= p.w) < 0) ?? pairs[pairs.length - 1];

  const level = levelOf(progress, char.id, quizTrack(direction.id));
  const answer = answerOption(char, direction);
  const options = shuffle([answer, ...distractors(char, direction, deck, level, 3)]);
  return { char, direction, options, answerId: answer.id };
}

/** Есть ли что спросить: хотя бы одно направление подходит хотя бы к одному знаку */
export const canAsk = (chars: BaziChar[], directions: Direction[]) =>
  directions.some((d) => chars.some((c) => appliesTo(d, c)));

/** Доля освоенных пар (знак × направление) колоды; неподходящие пары не считаются */
export function quizMastery(p: Progress, chars: BaziChar[], directions: Direction[]): number {
  let total = 0;
  let mastered = 0;
  for (const c of chars) {
    for (const d of directions) {
      if (!appliesTo(d, c)) continue;
      total++;
      if (levelOf(p, c.id, quizTrack(d.id)) >= MASTERED_LEVEL) mastered++;
    }
  }
  return total ? mastered / total : 0;
}
