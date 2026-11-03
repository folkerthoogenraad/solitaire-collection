import '../../../../src/styles/theme.css';
import '../../../../src/styles/app.css';
import './selector.css';
import { buildCards, type Card, type DeckDefinition } from '../../../../src/core/deck';
import { emperorDeck } from '../../../../src/core/decks/emperor';
import { createRng, shuffle } from '../../../../src/core/rng';
import { foundationId, tableauId, type PileId } from '../../../../src/core/state';
import { bbb } from '../../../../src/core/variants/bbb';
import { createControls, createWinCount } from '../../../../src/ui/controls';
import { CARD_RATIO, computeLayout, MAX_CARD_W, type Layout, type Rect, type Slot } from '../../../../src/ui/layout';
import { loadSkin } from '../../../../src/ui/skin/load';
import klondikeEmblemUrl from './klondike.svg?url';

/*
 * Static mockup of the variant selector and the Klondike layout. Nothing here is playable: each variant shows a fixed
 * mid-game board. Click the emblem to open the selector, pick a variant to switch boards.
 */

const board = document.getElementById('board')!;
const params = new URLSearchParams(location.search);
const skin = await loadSkin([bbb], board, params.get('skin') ?? undefined);

/** Klondike's deck: the Emperor deck without the Emperor. Same card ids, so the skin resolves the same faces. */
const standardDeck: DeckDefinition = { ...emperorDeck, id: 'standard', ranks: emperorDeck.ranks.slice(0, 13) };
const cardsById = new Map<string, Card>(buildCards(emperorDeck).map((c) => [c.id, c]));

// ---- Static games -----------------------------------------------------------------------------------------------

interface Mock {
  id: 'bbb' | 'klondike';
  name: string;
  wins: number;
  emblem(): HTMLElement;
  emblemAr: number;
  /** Card ids per pile, bottom → top. */
  piles: Record<PileId, string[]>;
  /** Face-down cards at the bottom of each pile. */
  down: Record<PileId, number>;
  layout(width: number, height: number): MockLayout;
}

type MockLayout = Omit<Layout, 'downFan'> & { controlsFont?: number };

function bbbGame(): Pick<Mock, 'piles' | 'down'> {
  const piles = structuredClone(bbb.deal(20261103).piles);
  const take = (id: string) => {
    for (const p of Object.values(piles)) {
      const i = p.indexOf(id);
      if (i >= 0) p.splice(i, 1);
    }
    return id;
  };
  piles[foundationId(0)] = ['SA', 'S2', 'S3'].map(take);
  piles[foundationId(1)] = ['HA'].map(take);
  return { piles, down: {} };
}

function klondikeGame(): Pick<Mock, 'piles' | 'down'> {
  const cards = shuffle(buildCards(standardDeck), createRng(1103)).map((c) => c.id);
  const piles: Record<PileId, string[]> = { stock: [], waste: [] };
  const down: Record<PileId, number> = {};
  for (let f = 0; f < 4; f++) piles[foundationId(f)] = [];
  for (let t = 0; t < 7; t++) {
    piles[tableauId(t)] = cards.splice(0, t + 1);
    down[tableauId(t)] = t;
  }
  // A few cards drawn, an ace played from the stock
  piles.stock = cards;
  piles.waste = piles.stock.splice(-4);
  const ace = piles.stock.findIndex((id) => id.endsWith('A'));
  if (ace >= 0) piles[foundationId(0)] = piles.stock.splice(ace, 1);
  down.stock = piles.stock.length;
  return { piles, down };
}

const mocks: Mock[] = [
  {
    id: 'bbb',
    name: "Bobbie's Beautiful Bugs",
    wins: 12,
    emblem: () => skin.ui.glyph('emblem', 'emblem/bbb', "Bobbie's Beautiful Bugs"),
    emblemAr: skin.ui.ar('emblem/bbb') ?? 2,
    ...bbbGame(),
    layout(w, h) {
      return computeLayout(w, h, bbb, this.emblemAr);
    },
  },
  {
    id: 'klondike',
    name: 'Klondike',
    wins: 3,
    emblem: () => {
      const el = document.createElement('i');
      el.className = 'g emblem paint';
      el.style.setProperty('--paint', `url("${klondikeEmblemUrl}")`);
      el.style.setProperty('--ar', '2');
      return el;
    },
    emblemAr: 2,
    ...klondikeGame(),
    layout: (w, h) => klondikeLayout(w, h, 2),
  },
];

// ---- Klondike layout (prototype for src/ui/layout.ts) -------------------------------------------------------------

const KL = {
  columns: 7,
  /** Smallest fan (× card width) that still shows a one-line index, and the fan of face-down cards. */
  minFan: 0.34,
  downFan: { wide: 0.15, narrow: 0.1 },
  /** Height budget: a column of 6 face-down and 8 face-up cards at minimum fan. */
  budgetDown: 6,
  budgetUp: 8,
};

/**
 * Seven columns fit a phone in one band, so card size doesn't tell the two apart like it does for BBB: portrait gets
 * the phone layout, with the emblem and controls large enough to read and tap.
 */
function klondikeLayout(width: number, height: number, emblemAr: number): MockLayout {
  return height > width ? klondikeNarrow(width, height, emblemAr) : klondikeWide(width, height, emblemAr);
}

/** Stock, waste, [emblem over controls], four foundations; seven columns below. */
function klondikeWide(width: number, height: number, emblemAr: number): MockLayout {
  const n = KL.columns;
  const pad = Math.min(Math.max(Math.min(width, height) * 0.035, 8), 40);
  // Seven columns leave room to spare on most screens; wider gaps also give the emblem column more space.
  const gapR = 0.25;
  const byWidth = (width - 2 * pad) / (n + (n - 1) * gapR);
  const column = KL.budgetDown * KL.downFan.wide + (KL.budgetUp - 1) * KL.minFan;
  const byHeight = (height - 2 * pad) / (CARD_RATIO + 0.3 + CARD_RATIO + column);
  const cw = Math.max(Math.min(byWidth, byHeight, MAX_CARD_W.wide), 10);
  const ch = cw * CARD_RATIO;
  const gap = cw * gapR;
  const left = (width - (n * cw + (n - 1) * gap)) / 2;
  const colX = (i: number) => left + i * (cw + gap);

  const slots: Record<PileId, Slot> = { stock: { x: colX(0), y: pad, scale: 1 }, waste: { x: colX(1), y: pad, scale: 1 } };
  for (let f = 0; f < 4; f++) slots[foundationId(f)] = { x: colX(3 + f), y: pad, scale: 1 };

  // The third column, reaching halfway into the gaps on either side: emblem on top, controls below.
  const x = colX(2) - gap / 2;
  const w = cw + gap;
  let ew = w;
  let eh = ew / emblemAr;
  if (eh > ch * 0.5) {
    eh = ch * 0.5;
    ew = eh * emblemAr;
  }
  const emblem: Rect = { x: x + (w - ew) / 2, y: pad, w: ew, h: eh };
  const controls: Rect = { x, y: pad + eh, w, h: ch - eh };

  const y = pad + ch + cw * 0.3;
  const bottom: Record<PileId, number> = {};
  for (let i = 0; i < n; i++) {
    slots[tableauId(i)] = { x: colX(i), y, scale: 1 };
    bottom[tableauId(i)] = height - pad;
  }
  return {
    mode: 'wide',
    cardW: cw,
    cardH: ch,
    slots,
    bottom,
    fan: cw * 0.4,
    compact: false,
    controls,
    emblem,
    dividers: [],
    controlsFont: 0.165,
  };
}

/** Like BBB on a phone: emblem and controls in a row of their own, then stock, waste and foundations, then one band. */
function klondikeNarrow(width: number, height: number, emblemAr: number): MockLayout {
  const n = KL.columns;
  const pad = 8;
  const gapR = 0.09;
  const byWidth = (width - 2 * pad) / (n + (n - 1) * gapR);
  const column = KL.budgetDown * KL.downFan.narrow + (KL.budgetUp - 1) * KL.minFan;
  const byHeight = (height - 2 * pad) / (1.1 + 0.3 + CARD_RATIO + 0.25 + CARD_RATIO + column);
  const cw = Math.max(Math.min(byWidth, byHeight, MAX_CARD_W.narrow), 10);
  const ch = cw * CARD_RATIO;
  const gap = cw * gapR;
  const total = n * cw + (n - 1) * gap;
  const left = (width - total) / 2;
  const colX = (i: number) => left + i * (cw + gap);

  const headerH = cw * 1.1;
  const ew = Math.min(headerH * emblemAr, total - gap - cw * 1.5);
  const emblem: Rect = { x: left, y: pad + (headerH - ew / emblemAr) / 2, w: ew, h: ew / emblemAr };
  const controls: Rect = { x: left + ew + gap, y: pad, w: total - ew - gap, h: headerH };

  const pileY = pad + cw * 1.4;
  const slots: Record<PileId, Slot> = { stock: { x: colX(0), y: pileY, scale: 1 }, waste: { x: colX(1), y: pileY, scale: 1 } };
  for (let f = 0; f < 4; f++) slots[foundationId(f)] = { x: colX(3 + f), y: pileY, scale: 1 };

  const y = pileY + ch + cw * 0.25;
  const bottom: Record<PileId, number> = {};
  for (let i = 0; i < n; i++) {
    slots[tableauId(i)] = { x: colX(i), y, scale: 1 };
    bottom[tableauId(i)] = height - pad;
  }
  return { mode: 'narrow', cardW: cw, cardH: ch, slots, bottom, fan: cw * 0.38, compact: true, controls, emblem, dividers: [] };
}

// ---- Static board -----------------------------------------------------------------------------------------------

const snap = (v: number) => Math.round(v * devicePixelRatio) / devicePixelRatio;
const place = (el: HTMLElement, r: { x: number; y: number }) => {
  el.style.transform = `translate3d(${snap(r.x)}px, ${snap(r.y)}px, 0)`;
};
function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

const back = () => skin.faces.back();

// ?variant=klondike starts on that board
let current = mocks.find((m) => m.id === params.get('variant')) ?? mocks[0]!;
let emblemEl: HTMLElement;
const layer = div('layer');
board.append(layer);

function show(m: Mock) {
  const { width, height } = board.getBoundingClientRect();
  const L = m.layout(width, height);
  board.style.setProperty('--cw', `${L.cardW}px`);
  board.dataset.mode = L.mode;
  board.dataset.variant = m.id;
  layer.replaceChildren();

  for (const [id, s] of Object.entries(L.slots)) {
    const slot = div('slot');
    if (id === 'stock') {
      slot.classList.add('stock');
      const label = div('slot-label');
      label.textContent = 'Stock';
      slot.append(label);
    }
    place(slot, s);
    layer.append(slot);
  }

  emblemEl = m.emblem();
  emblemEl.classList.add('opens-selector');
  emblemEl.setAttribute('role', 'button');
  emblemEl.setAttribute('aria-label', 'Choose a game');
  emblemEl.tabIndex = 0;
  if (L.emblem) {
    Object.assign(emblemEl.style, { width: `${L.emblem.w}px`, height: `${L.emblem.h}px` });
    place(emblemEl, L.emblem);
  }
  emblemEl.addEventListener('click', () => openSelector(emblemEl));
  emblemEl.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && openSelector(emblemEl));
  layer.append(emblemEl);

  for (const [pile, ids] of Object.entries(m.piles)) {
    const slot = L.slots[pile]!;
    const tableau = pile.startsWith('t');
    const down = m.down[pile] ?? 0;
    const downFan = L.cardW * (L.mode === 'wide' ? KL.downFan.wide : KL.downFan.narrow);
    const ups = ids.length - down;
    const room = (L.bottom[pile] ?? Infinity) - slot.y - L.cardH - down * downFan;
    const upFan = ups > 1 ? Math.max(Math.min(L.fan, room / (ups - 1)), L.cardW * 0.12) : L.fan;
    ids.forEach((id, i) => {
      const el = div('card');
      const up = i >= down;
      if (up) el.append(skin.faces.render(cardsById.get(id)!, emperorDeck));
      else el.append(back());
      el.classList.toggle('down', !up);
      el.classList.toggle('compact', tableau && L.compact);
      const y = !tableau ? slot.y : slot.y + Math.min(i, down) * downFan + Math.max(0, i - down) * upFan;
      place(el, { x: slot.x, y });
      el.style.zIndex = String(i + 1);
      layer.append(el);
    });
  }

  const controls = createControls(skin.ui, () => {});
  controls.setWins(m.wins);
  const c = L.controls;
  Object.assign(controls.el.style, { width: `${c.w}px`, height: `${c.h}px` });
  if (L.controlsFont) controls.el.style.fontSize = `calc(var(--cw) * ${L.controlsFont})`;
  place(controls.el, c);
  layer.append(controls.el);
}

let shown = false;
new ResizeObserver(() => {
  show(current);
  // Still covering the whole screen after a resize or rotation
  if (circleFrom && selector.classList.contains('open')) setCircle(origin(emblemEl));
  // ?open starts with the selector open
  if (!shown && params.has('open')) openSelector(emblemEl);
  shown = true;
}).observe(board);

// ---- Selector ---------------------------------------------------------------------------------------------------

const selector = div('selector');
selector.hidden = true;
selector.setAttribute('role', 'dialog');
selector.setAttribute('aria-modal', 'true');
selector.setAttribute('aria-label', 'Choose a game');

const list = div('sel-list');
const buttons = new Map<Mock, HTMLButtonElement>();
for (const m of mocks) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sel-variant';
  btn.setAttribute('aria-label', `${m.name}, ${m.wins} wins`);
  const emblem = m.emblem();
  emblem.classList.add('sel-emblem');
  const wins = createWinCount(skin.ui);
  wins.set(m.wins);
  btn.append(emblem, wins.el);
  btn.addEventListener('click', () => choose(m));
  buttons.set(m, btn);
  list.append(btn);
}
selector.append(list);
document.body.append(selector);

/** Circle centre: the emblem's, or the screen's. */
function origin(el: HTMLElement): { x: number; y: number } {
  if (knobs.origin === 'center') return { x: innerWidth / 2, y: innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

let circleFrom: HTMLElement | null = null;

function setCircle(p: { x: number; y: number }) {
  const { clientWidth: w, clientHeight: h } = document.documentElement;
  const r = Math.hypot(Math.max(p.x, w - p.x), Math.max(p.y, h - p.y));
  selector.style.setProperty('--ox', `${p.x}px`);
  selector.style.setProperty('--oy', `${p.y}px`);
  selector.style.setProperty('--r', `${r + 2}px`);
}

function openSelector(from: HTMLElement) {
  for (const [m, btn] of buttons) btn.classList.toggle('current', m === current);
  circleFrom = from;
  setCircle(origin(from));
  selector.hidden = false;
  void selector.offsetWidth;
  selector.classList.add('open');
  buttons.get(current)!.focus({ preventScroll: true });
}

/** Switches the board while the selector covers it, then closes the circle onto the (new) emblem. */
function choose(m: Mock) {
  if (m !== current) {
    current = m;
    show(m);
  }
  setCircle(origin(emblemEl));
  selector.classList.remove('open');
  selector.addEventListener('transitionend', function done(e) {
    if (e.target !== selector || e.propertyName !== 'clip-path') return;
    selector.removeEventListener('transitionend', done);
    if (!selector.classList.contains('open')) selector.hidden = true;
    emblemEl.focus({ preventScroll: true });
  });
}

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !selector.hidden) choose(current);
});

// ---- Design knobs -----------------------------------------------------------------------------------------------

const knobs = {
  style: params.get('style') ?? 'panel',
  ms: Number(params.get('ms') ?? 550),
  origin: params.get('origin') ?? 'emblem',
};

function applyKnobs() {
  selector.dataset.style = knobs.style;
  selector.style.setProperty('--sel-ms', `${knobs.ms}ms`);
}
applyKnobs();

const panel = document.createElement('details');
panel.className = 'knobs';
panel.innerHTML = `
  <summary>Design knobs</summary>
  <label>Buttons <select data-k="style">
    <option value="panel">Skin panel</option>
    <option value="felt">Felt</option>
    <option value="outline">Outline on black</option>
    <option value="plain">Plain on black</option>
  </select></label>
  <label>Duration <select data-k="ms">
    <option>350</option><option>550</option><option>800</option><option>1500</option>
  </select></label>
  <label>Circle from <select data-k="origin">
    <option value="emblem">Emblem</option>
    <option value="center">Screen centre</option>
  </select></label>`;
for (const sel of panel.querySelectorAll<HTMLSelectElement>('select')) {
  const k = sel.dataset.k as keyof typeof knobs;
  sel.value = String(knobs[k]);
  sel.addEventListener('change', () => {
    (knobs as Record<string, string | number>)[k] = k === 'ms' ? Number(sel.value) : sel.value;
    applyKnobs();
    const url = new URL(location.href);
    url.searchParams.set(k, sel.value);
    history.replaceState(null, '', url);
  });
}
document.body.append(panel);
