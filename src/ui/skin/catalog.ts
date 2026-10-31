import { parseRegistry, type SkinRegistry } from './manifest';
import { collectSkins, type SkinSource } from './resolve';

// Found at build time: dropping a file into a skin folder is enough. `?url` only embeds the URL;
// images and sounds are fetched when they're actually used. Files starting with `_` are left out (backups, drafts).
const manifests = import.meta.glob('/skins/*/skin.json', { eager: true, import: 'default' });
const registries = import.meta.glob('/skins/skins.json', { eager: true, import: 'default' });
const files = import.meta.glob<string>(['/skins/*/**/*.{png,webp,svg,wav,mp3,ogg}', '!/skins/_templates/**', '!/skins/*/**/_*'], {
  eager: true,
  query: '?url',
  import: 'default',
});

// Dev URLs are plain paths, and on Vite's auto reload the browser reuses the image it already decoded
// for that URL, so an edited image only showed after a hard refresh. A per-load query forces a refetch.
// Built URLs are content-hashed already.
const urls = import.meta.env.DEV ? bust(files, `t=${Date.now()}`) : files;

function bust(urls: Record<string, string>, query: string): Record<string, string> {
  return Object.fromEntries(Object.entries(urls).map(([path, url]) => [path, `${url}${url.includes('?') ? '&' : '?'}${query}`]));
}

export interface Catalog {
  registry: SkinRegistry;
  skins: Map<string, SkinSource>;
  /** Source path → served URL. */
  urls: Record<string, string>;
  problems: string[];
}

export function catalog(): Catalog {
  const { skins, problems } = collectSkins(manifests, files);
  let registry: SkinRegistry = { default: 'classic', skins: ['classic'] };
  try {
    registry = parseRegistry(registries['/skins/skins.json'], 'skins.json');
  } catch (e) {
    problems.push(String(e instanceof Error ? e.message : e));
  }
  for (const id of registry.skins) if (!skins.has(id)) problems.push(`skins.json lists "${id}", but skins/${id}/skin.json is missing or broken`);
  for (const id of skins.keys()) if (!registry.skins.includes(id)) problems.push(`skins/${id} is not listed in skins.json, so it's ignored`);
  return { registry, skins, urls, problems };
}
