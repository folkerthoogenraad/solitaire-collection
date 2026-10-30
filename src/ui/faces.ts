import type { Card, DeckDefinition } from '../core/deck';

/** Produces the visual face of a card. Swap this to change deck art. */
export interface CardFaceRenderer {
  render(card: Card, deck: DeckDefinition): HTMLElement;
}

/** Placeholder faces built from rank label + suit glyph; colours come from theme variables. */
export const generatedFaces: CardFaceRenderer = {
  render(card, deck) {
    const suit = deck.suits[card.suit]!;
    const rank = deck.ranks[card.rank]!;
    const court = /^[A-Z]$/.test(rank.label) && rank.label !== 'A';

    const face = document.createElement('div');
    face.className = court ? 'face court' : 'face';
    face.dataset.suit = suit.name;
    face.setAttribute('aria-label', `${rank.label} of ${suit.name}`);

    const idx = `<span class="r">${rank.label}</span><span class="s">${suit.glyph}</span>`;
    const pip = court ? `<span class="cr">${rank.label}</span><span class="cs">${suit.glyph}</span>` : suit.glyph;
    face.innerHTML = `<div class="idx">${idx}</div><div class="pip">${pip}</div><div class="idx br">${idx}</div>`;
    return face;
  },
};
