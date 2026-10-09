import { type BaziChar, BRANCHES, CHARACTERS, STEMS } from '../data/characters';

export interface Deck {
  id: string;
  title: string;
  chars: BaziChar[];
}

// Открытие колод по прогрессу появится вместе с Лейтнером (этап 4)
export const DECKS: Deck[] = [
  { id: 'stems', title: 'Небесные стволы', chars: STEMS },
  { id: 'branches', title: 'Земные ветви', chars: BRANCHES },
  { id: 'all', title: 'Все 22 знака', chars: CHARACTERS },
];

export const deckById = (id: string) => DECKS.find((d) => d.id === id) ?? DECKS[0];
