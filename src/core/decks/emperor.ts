import type { DeckDefinition } from '../deck';

/** Standard four suits, A–K plus an Emperor above the King. */
export const emperorDeck: DeckDefinition = {
  id: 'emperor',
  suits: [
    { id: 'S', name: 'spades', glyph: '♠' },
    { id: 'H', name: 'hearts', glyph: '♥' },
    { id: 'D', name: 'diamonds', glyph: '♦' },
    { id: 'C', name: 'clubs', glyph: '♣' },
  ],
  ranks: [
    { id: 'A', label: 'A' },
    { id: '2', label: '2' },
    { id: '3', label: '3' },
    { id: '4', label: '4' },
    { id: '5', label: '5' },
    { id: '6', label: '6' },
    { id: '7', label: '7' },
    { id: '8', label: '8' },
    { id: '9', label: '9' },
    { id: 'T', label: '10' },
    { id: 'J', label: 'J' },
    { id: 'Q', label: 'Q' },
    { id: 'K', label: 'K' },
    { id: 'E', label: 'E' },
  ],
};
