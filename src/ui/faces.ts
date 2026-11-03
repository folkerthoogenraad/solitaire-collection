import type { Card, DeckDefinition } from '../core/deck';

/** Produces the visual face of a card. Swap this to change deck art; see `skin/faces.ts`. */
export interface CardFaceRenderer {
  render(card: Card, deck: DeckDefinition): HTMLElement;
  /** The back, shown while a card lies face down. The same for every card. */
  back(): HTMLElement;
}
