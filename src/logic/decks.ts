import { type BaziChar, BRANCHES, CHARACTERS, ELEMENTS, type Element, STEMS } from '../data/characters';
import { type Progress, UNLOCK_SHARE, mastery } from './progress';
import type { Mode } from './settings';

export interface Deck {
  id: string;
  title: string;
  chars: BaziChar[];
  /** Колода, которую нужно освоить по памяти, чтобы открылась эта */
  requires?: string;
}

const ELEMENT_ORDER: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

export const DECKS: Deck[] = [
  { id: 'stems', title: 'Небесные стволы', chars: STEMS },
  { id: 'branches', title: 'Земные ветви', chars: BRANCHES, requires: 'stems' },
  { id: 'all', title: 'Все 22 знака', chars: CHARACTERS, requires: 'branches' },
  // По стихиям — вперемешку стволы и ветви, открываются вместе со «Все 22»
  ...ELEMENT_ORDER.map((el) => ({
    id: `el-${el}`,
    title: ELEMENTS[el],
    chars: CHARACTERS.filter((c) => c.element === el),
    requires: 'branches',
  })),
];

export const deckById = (id: string) => DECKS.find((d) => d.id === id) ?? DECKS[0];

export const isUnlocked = (deck: Deck, p: Progress, unlockAll: boolean) =>
  unlockAll || !deck.requires || p.unlocked.includes(deck.id);

/** По порогу открывается только письмо по памяти; знакомство, обводка и узнавание — для любой колоды */
export const isAvailable = (deck: Deck, mode: Mode, p: Progress, unlockAll: boolean) =>
  mode !== 'recall' || isUnlocked(deck, p, unlockAll);

/** Открывает колоды, у которых требуемая освоена по памяти на UNLOCK_SHARE */
export function withUnlocks(p: Progress): Progress {
  let unlocked = p.unlocked;
  for (const deck of DECKS) {
    if (!deck.requires || unlocked.includes(deck.id)) continue;
    const req = deckById(deck.requires);
    const reqOpen = !req.requires || unlocked.includes(req.id);
    if (reqOpen && mastery(p, req.chars, 'recall') >= UNLOCK_SHARE) unlocked = [...unlocked, deck.id];
  }
  return unlocked === p.unlocked ? p : { ...p, unlocked };
}
