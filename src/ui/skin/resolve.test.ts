import { describe, expect, it } from 'vitest';
import { emperorDeck } from '../../core/decks/emperor';
import { buildCards, type Card } from '../../core/deck';
import { SkinError } from './manifest';
import { chainFor, collectSkins, parseAssetPath, resolveChrome, resolveFace, resolveUi, settingsFor, unknownFiles } from './resolve';

const deck = emperorDeck;
const card = (id: string): Card => buildCards(deck).find((c) => c.id === id)!;

/** Build skins from `{ id: { manifest, files: [...] } }`; file values are their own paths. */
function skins(def: Record<string, { manifest?: object; files?: string[] }>) {
  const manifests: Record<string, unknown> = {};
  const files: Record<string, string> = {};
  for (const [id, s] of Object.entries(def)) {
    manifests[`/skins/${id}/skin.json`] = s.manifest ?? {};
    for (const f of s.files ?? []) files[`/skins/${id}/${f}`] = `/skins/${id}/${f}`;
  }
  return collectSkins(manifests, files);
}

const resolve = (all: ReturnType<typeof skins>, id: string, cardId: string) => {
  const chain = chainFor(all.skins, id);
  return resolveFace(chain, settingsFor(chain), deck, card(cardId));
};

describe('asset paths', () => {
  it('splits layer and extension off', () => {
    expect(parseAssetPath('center/7-clubs.ink.png')).toEqual({ key: 'center/7-clubs', layer: 'ink' });
    expect(parseAssetPath('center/7-clubs.svg')).toEqual({ key: 'center/7-clubs', layer: 'paint' });
    expect(parseAssetPath('notes.txt')).toBeNull();
  });

  it('reports two files for the same layer', () => {
    const { problems } = skins({ classic: { files: ['index/A.png', 'index/A.webp'] } });
    expect(problems).toHaveLength(1);
  });
});

describe('chain', () => {
  it('extends classic by default', () => {
    const all = skins({ classic: {}, mine: {} });
    expect(chainFor(all.skins, 'mine').map((s) => s.id)).toEqual(['mine', 'classic']);
  });

  it('rejects cycles and unknown parents', () => {
    const all = skins({ classic: {}, a: { manifest: { extends: 'b' } }, b: { manifest: { extends: 'a' } }, c: { manifest: { extends: 'x' } } });
    expect(() => chainFor(all.skins, 'a')).toThrow(SkinError);
    expect(() => chainFor(all.skins, 'c')).toThrow(/unknown skin "x"/);
  });

  it('leaves out skins with a broken manifest', () => {
    const all = skins({ classic: {}, bad: { manifest: { pips: { sise: 0.2 } } } });
    expect(all.skins.has('bad')).toBe(false);
    expect(all.problems[0]).toMatch(/bad\/skin\.json\.pips\.sise: unknown setting/);
  });
});

describe('centre', () => {
  const all = skins({
    classic: {
      manifest: { pips: { layouts: { '2': [[0.5, 0], [0.5, 1]], '7': [[0.5, 0.5]] } } },
      files: ['center/K-hearts.ink.png', 'center/7-clubs.png', 'index/clubs.ink.png'],
    },
    mine: {
      manifest: { pips: { layouts: { '7': [[0.2, 0.2], [0.8, 0.8, { flip: false, scale: 2 }]] } } },
      files: ['center/K.png', 'pips/clubs.ink.png'],
    },
  });

  it('prefers rank-suit art, then rank art, within a skin', () => {
    const own = resolve(all, 'classic', 'HK').center;
    expect(own).toEqual({ kind: 'art', art: { ink: '/skins/classic/center/K-hearts.ink.png' } });
    expect(resolve(all, 'mine', 'HK').center).toEqual({ kind: 'art', art: { paint: '/skins/mine/center/K.png' } });
  });

  it("uses the child's layout before the parent's art", () => {
    const c = resolve(all, 'mine', 'C7').center;
    expect(c.kind).toBe('pips');
    if (c.kind !== 'pips') return;
    expect(c.pip).toEqual({ ink: '/skins/mine/pips/clubs.ink.png' });
    expect(c.points).toEqual([
      { x: 0.2, y: 0.2, flip: false, scale: 1 },
      { x: 0.8, y: 0.8, flip: false, scale: 2 },
    ]);
  });

  it('inherits layouts per rank and flips the bottom half', () => {
    const c = resolve(all, 'mine', 'S2').center;
    expect(c.kind === 'pips' && c.points.map((p) => p.flip)).toEqual([false, true]);
    expect(c.kind === 'pips' && c.narrow).toEqual([{ x: 0.5, y: 0.5, flip: false, scale: 2.5 }]);
  });

  it('falls back to one big pip, half the card wide whatever the pip size', () => {
    expect(resolve(all, 'mine', 'S5').center).toEqual({ kind: 'pips', pip: {}, points: [{ x: 0.5, y: 0.5, flip: false, scale: 2.5 }] });
    const small = skins({ classic: { manifest: { pips: { size: 0.25 } } } });
    expect(resolve(small, 'classic', 'S5').center.kind === 'pips' && resolve(small, 'classic', 'S5').center).toMatchObject({ points: [{ scale: 2 }] });
  });
});

describe('index, background and chrome', () => {
  const all = skins({
    classic: { files: ['index/A.ink.png', 'index/spades.ink.png', 'card/background.png', 'table/felt.png'] },
    mine: {
      files: ['index/A-hearts.png', 'card/background-hearts.png', 'card/outline.ink.png', 'card/shape.ink.png', 'table/slot.ink.png', 'table/slot.png', 'ui/button.png'],
    },
  });

  it('resolves the most specific file down the chain', () => {
    expect(resolve(all, 'mine', 'HA').rank).toEqual({ paint: '/skins/mine/index/A-hearts.png' });
    expect(resolve(all, 'mine', 'SA').rank).toEqual({ ink: '/skins/classic/index/A.ink.png' });
    expect(resolve(all, 'mine', 'HA').background).toEqual({ paint: '/skins/mine/card/background-hearts.png' });
    expect(resolve(all, 'mine', 'SA').background).toEqual({ paint: '/skins/classic/card/background.png' });
    expect(resolve(all, 'mine', 'H2').suit).toEqual({});
    expect(resolve(all, 'mine', 'H2').outline).toEqual({ ink: '/skins/mine/card/outline.ink.png' });
    expect(resolve(all, 'classic', 'H2').outline).toEqual({});
  });

  it('resolves table and UI images', () => {
    expect(resolveChrome(chainFor(all.skins, 'mine'))).toEqual({
      shape: '/skins/mine/card/shape.ink.png',
      felt: '/skins/classic/table/felt.png',
      button: '/skins/mine/ui/button.png',
      slot: '/skins/mine/table/slot.png',
      slotInk: '/skins/mine/table/slot.ink.png',
      slotStock: undefined,
      slotStockInk: undefined,
      stock: undefined,
      stockInk: undefined,
      drop: undefined,
      dropInk: undefined,
      panel: undefined,
    });
  });

  it('uses pips for the corner suit and the corner suit for pips, whichever the skin has', () => {
    const own = skins({ classic: { files: ['index/hearts.ink.png'] }, mine: { files: ['pips/hearts.ink.png'] } });
    expect(resolve(own, 'mine', 'H2').suit).toEqual({ ink: '/skins/mine/pips/hearts.ink.png' });
    expect(resolve(own, 'classic', 'H2').center).toMatchObject({ pip: { ink: '/skins/classic/index/hearts.ink.png' } });
  });

  it('resolves the emblem per variant, the control labels and the counter digits', () => {
    const own = skins({
      classic: { files: ['index/0.ink.png', 'index/1.ink.png', 'index/10.ink.png', 'ui/wins.png'] },
      mine: { files: ['emblem/bbb.png', 'emblem/other.png', 'index/1.png', 'ui/new-deal.ink.png'] },
    });
    const ui = resolveUi(chainFor(own.skins, 'mine'), 'bbb');
    expect(ui.emblem).toEqual({ paint: '/skins/mine/emblem/bbb.png' });
    expect(ui.wins).toEqual({ paint: '/skins/classic/ui/wins.png' });
    expect(ui['new-deal']).toEqual({ ink: '/skins/mine/ui/new-deal.ink.png' });
    expect(ui['0']).toEqual({ ink: '/skins/classic/index/0.ink.png' });
    expect(ui['1']).toEqual({ paint: '/skins/mine/index/1.png' });
    expect(ui['2']).toEqual({});
    expect(resolveUi(chainFor(own.skins, 'mine'), 'klondike').emblem).toEqual({});
    expect(unknownFiles(own.skins.get('mine')!, deck)).toEqual([]);
  });

  it('inherits the image scaling', () => {
    const pixel = skins({ classic: {}, a: { manifest: { scaling: 'pixelated' } }, b: { manifest: { extends: 'a' } } });
    expect(settingsFor(chainFor(pixel.skins, 'classic')).scaling).toBe('smooth');
    expect(settingsFor(chainFor(pixel.skins, 'b')).scaling).toBe('pixelated');
    expect(skins({ classic: { manifest: { scaling: 'blurry' } } }).problems[0]).toMatch(/scaling: expected/);
  });

  it('inherits the card and slot scale', () => {
    const scaled = skins({
      classic: {},
      a: { manifest: { card: { scale: 1.1 }, table: { slotScale: 1.2 } } },
      b: { manifest: { extends: 'a', table: { felt: 'tile' } } },
    });
    expect(settingsFor(chainFor(scaled.skins, 'classic'))).toMatchObject({ card: { scale: 1 }, table: { slotScale: 1 } });
    expect(settingsFor(chainFor(scaled.skins, 'b'))).toMatchObject({ card: { scale: 1.1 }, table: { felt: 'tile', slotScale: 1.2 } });
  });
});

describe('unknown files', () => {
  it('lists typos and tinted table images', () => {
    const all = skins({ classic: { files: ['center/7-club.png', 'center/7-clubs.png', 'table/felt.ink.png', 'ui/panel.png', 'card/shape.png', 'card/outline-hearts.png', 'table/slot.ink.png'] } });
    expect(unknownFiles(all.skins.get('classic')!, deck)).toEqual(['center/7-club', expect.stringMatching(/^table\/felt\.ink/)]);
  });
});
