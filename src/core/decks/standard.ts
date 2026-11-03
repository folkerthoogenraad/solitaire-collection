import type { DeckDefinition } from '../deck';
import { emperorDeck } from './emperor';

/** Standard 52 cards: the Emperor deck without the Emperor. Same card ids, so skins resolve the same faces. */
export const standardDeck: DeckDefinition = {
  id: 'standard',
  suits: emperorDeck.suits,
  ranks: emperorDeck.ranks.filter((r) => r.id !== 'E'),
};
