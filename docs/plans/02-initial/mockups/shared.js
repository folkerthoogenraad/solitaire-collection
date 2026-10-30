// Shared mockup helpers: builds a fixed mid-game state and renders it into
// elements marked with data-slot="stock" | "f0".."f3" | "t0".."t10".
(function () {
  const SUITS = [
    { id: 'S', glyph: '♠', color: 'black' },
    { id: 'H', glyph: '♥', color: 'red' },
    { id: 'D', glyph: '♦', color: 'red' },
    { id: 'C', glyph: '♣', color: 'black' },
  ];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'E'];

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const card = (s, r) => ({ suit: SUITS[s], rank: r, key: s * 100 + r });

  // Mid-game: ♠A-3 and ♥A on foundations, one empty column,
  // ♦9-5 run being dragged onto ♦10 (top of column 3).
  function mockState() {
    const foundations = [[card(0, 0), card(0, 1), card(0, 2)], [card(1, 0)], [], []];
    const run = [8, 7, 6, 5, 4].map((r) => card(2, r));
    const target = card(2, 9);
    const used = new Set([...foundations.flat(), ...run, target].map((c) => c.key));

    const deck = [];
    for (let s = 0; s < 4; s++)
      for (let r = 0; r < RANKS.length; r++) if (!used.has(s * 100 + r)) deck.push(card(s, r));

    const rand = rng(42);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const lengths = [6, 5, 6, 0, 4, 4, 5, 3, 6, 4, 3];
    const tableau = lengths.map((n) => deck.splice(0, n));
    tableau[2].push(target);
    tableau[5].push(...run);
    return { foundations, tableau, lifted: new Set(run.map((c) => c.key)), dropTarget: 't2' };
  }

  function cardEl(c) {
    const el = document.createElement('div');
    const r = RANKS[c.rank];
    const g = c.suit.glyph;
    el.className = `card suit-${c.suit.id} ${c.suit.color}` + (c.rank >= 10 ? ' face' : '') + (c.rank === 13 ? ' emperor' : '');
    const idx = `<span class="r">${r}</span><span class="s">${g}</span>`;
    const pip = c.rank >= 10 ? `<span class="fr">${r}</span><span class="fs">${g}</span>` : g;
    el.innerHTML = `<div class="idx">${idx}</div><div class="pip">${pip}</div><div class="idx br">${idx}</div>`;
    return el;
  }

  function render({ dx = 0, dy = 0, highlight = true } = {}) {
    const st = mockState();
    document.querySelectorAll('[data-slot]').forEach((slot) => {
      const id = slot.dataset.slot;
      slot.classList.add('pile');
      let cards = [];
      if (id[0] === 'f') cards = st.foundations[+id.slice(1)];
      else if (id[0] === 't') cards = st.tableau[+id.slice(1)];
      slot.classList.toggle('empty', cards.length === 0);

      const fan = id[0] === 't';
      cards.forEach((c, i) => {
        const el = cardEl(c);
        if (fan) {
          el.style.left = `${i * dx}px`;
          el.style.top = `${i * dy}px`;
        }
        if (highlight && st.lifted.has(c.key)) {
          el.classList.add('lifted');
          slot.classList.add('has-lifted');
        }
        slot.appendChild(el);
      });
      if (fan && cards.length) {
        slot.style.width = `calc(var(--cw) + ${(cards.length - 1) * dx}px)`;
        slot.style.height = `calc(var(--ch) + ${(cards.length - 1) * dy}px)`;
      }
      if (highlight && id === st.dropTarget) slot.classList.add('drop-ok');
    });
  }

  window.Mock = { render };
})();
