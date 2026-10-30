import { describe, expect, it } from 'vitest';
import { emperorDeck } from '../../core/decks/emperor';
import { catalog } from './catalog';
import { chainFor, unknownFiles } from './resolve';

/** Checks the real skins in /skins, so a broken skin fails the build instead of the game. */
describe('skins folder', () => {
  const cat = catalog();

  it('has a valid registry with every listed skin present', () => {
    expect(cat.problems.filter((p) => !p.includes('is not listed'))).toEqual([]);
    expect(cat.registry.skins).toContain(cat.registry.default);
  });

  for (const id of cat.registry.skins) {
    it(`${id}: resolves and has no unknown files`, () => {
      expect(() => chainFor(cat.skins, id)).not.toThrow();
      expect(unknownFiles(cat.skins.get(id)!, emperorDeck)).toEqual([]);
    });
  }

  it('classic covers every index glyph', () => {
    const classic = cat.skins.get('classic')!;
    for (const r of emperorDeck.ranks) expect(classic.assets.has(`index/${r.label}`), r.label).toBe(true);
    for (const s of emperorDeck.suits) expect(classic.assets.has(`index/${s.name}`), s.name).toBe(true);
  });
});
