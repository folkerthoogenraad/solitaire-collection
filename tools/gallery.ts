import '../src/styles/theme.css';
import '../src/styles/app.css';
import { buildCards } from '../src/core/deck';
import { bbb } from '../src/core/variants/bbb';
import { catalog } from '../src/ui/skin/catalog';
import { loadSkin } from '../src/ui/skin/load';

const deck = bbb.deck;
const [wide, narrow] = document.querySelectorAll<HTMLElement>('.board');
const skin = await loadSkin(bbb, wide!, new URLSearchParams(location.search).get('skin') ?? undefined);

// Picking a skin reloads with ?skin=<id>, so the URL can be copied; the link opens the game with the same parameter.
const picker = document.querySelector<HTMLSelectElement>('#skin')!;
const { registry, skins } = catalog();
for (const id of registry.skins) {
  const name = skins.get(id)?.manifest.name;
  picker.add(new Option(name && name.toLowerCase() !== id.toLowerCase() ?`${name} (${id})` : id, id, false, id === skin.id));
}
picker.addEventListener('change', () => {
  const url = new URL(location.href);
  url.searchParams.set('skin', picker.value);
  location.href = url.href;
});
const play = new URL('../', location.href);
if (skin.id) play.searchParams.set('skin', skin.id);
document.querySelector<HTMLAnchorElement>('#play')!.href = play.href;
// The loader marks one board with the skin's table/UI flags; the other needs them too.
for (const [k, v] of Object.entries(wide!.dataset)) if (k !== 'mode') narrow!.dataset[k] = v;

const cards = buildCards(deck);
for (const board of [wide!, narrow!]) {
  deck.suits.forEach((_, s) => {
    const row = document.createElement('div');
    row.className = 'row';
    for (const card of cards.filter((c) => c.suit === s)) {
      const el = document.createElement('div');
      el.className = board === narrow ? 'card compact' : 'card';
      el.append(skin.faces.render(card, deck));
      row.append(el);
    }
    board.append(row);
  });
}
