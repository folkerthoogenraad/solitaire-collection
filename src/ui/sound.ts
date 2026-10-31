import type { SoundName } from './skin/resolve';

export interface Sounds {
  /** Play a random variant of `name`, `delay` seconds from now. Silent until the player has touched the page. */
  play(name: SoundName, opts?: { delay?: number; volume?: number }): void;
}

const silent: Sounds = { play() {} };

/**
 * Skin sounds through Web Audio, so they start on time and can overlap. Files are fetched right away, but browsers
 * only allow audio after a tap, click or key press, so the context is made (and the files decoded) on the first one.
 */
export function createSounds(urls: Partial<Record<SoundName, string[]>>, enabled: boolean): Sounds {
  if (!enabled || typeof AudioContext === 'undefined') return silent;

  const files = new Map<SoundName, Promise<ArrayBuffer | null>[]>();
  for (const [name, list] of Object.entries(urls) as [SoundName, string[]][]) {
    files.set(
      name,
      list.map((url) =>
        fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .catch(() => (console.warn(`[skins] could not load ${url}`), null)),
      ),
    );
  }

  let ctx: AudioContext | null = null;
  const buffers = new Map<SoundName, AudioBuffer[]>();

  function unlock() {
    if (!ctx) {
      ctx = new AudioContext();
      for (const [name, list] of files) {
        for (const file of list) {
          void file
            .then((data) => data && ctx!.decodeAudioData(data))
            .then((buffer) => buffer && buffers.set(name, [...(buffers.get(name) ?? []), buffer]))
            .catch(() => console.warn(`[skins] could not decode a ${name} sound`));
        }
      }
    }
    // On touch, only the release counts as a gesture, so the press may leave it suspended.
    if (ctx.state === 'suspended') void ctx.resume();
  }
  for (const type of ['pointerdown', 'pointerup', 'keydown']) document.addEventListener(type, unlock, { capture: true });

  return {
    play(name, { delay = 0, volume = 1 } = {}) {
      const list = buffers.get(name);
      if (!ctx || ctx.state !== 'running' || !list?.length) return;
      const source = ctx.createBufferSource();
      source.buffer = list[Math.floor(Math.random() * list.length)]!;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain).connect(ctx.destination);
      source.start(ctx.currentTime + delay);
    },
  };
}
