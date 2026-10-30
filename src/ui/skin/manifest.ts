/** A rectangle relative to the card: 0..1 of its width (x, w) and height (y, h). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PipOptions {
  flip?: boolean;
  scale?: number;
}

/** Pip centre inside the centre box, optionally with per-pip overrides. */
export type PipPoint = [number, number] | [number, number, PipOptions];

/** `skin.json` as written: every field optional, inherited from the parent skin when missing. */
export interface SkinManifest {
  name?: string;
  extends?: string;
  colors?: Record<string, string>;
  center?: { box?: Box; narrowBox?: Box };
  pips?: {
    size?: number;
    flip?: 'auto' | 'none';
    narrow?: 'single' | 'layout';
    layouts?: Record<string, PipPoint[]>;
  };
  table?: { felt?: 'cover' | 'tile' };
  ui?: { button?: { slice?: number }; panel?: { slice?: number } };
}

/** `skins/skins.json`: which skins are playable, in which order, and the default. */
export interface SkinRegistry {
  default: string;
  skins: string[];
}

/** A skin's manifest merged down its chain, with every field filled in. */
export interface SkinSettings {
  colors: Record<string, string>;
  center: { box: Box; narrowBox: Box };
  pips: { size: number; flip: 'auto' | 'none'; narrow: 'single' | 'layout'; layouts: Record<string, PipPoint[]> };
  table: { felt: 'cover' | 'tile' };
  ui: { button: { slice: number }; panel: { slice: number } };
}

export const DEFAULT_SETTINGS: SkinSettings = {
  colors: {},
  center: {
    box: { x: 0.22, y: 0.12, w: 0.56, h: 0.76 },
    narrowBox: { x: 0.08, y: 0.28, w: 0.84, h: 0.64 },
  },
  pips: { size: 0.2, flip: 'auto', narrow: 'single', layouts: {} },
  table: { felt: 'cover' },
  ui: { button: { slice: 12 }, panel: { slice: 24 } },
};

/** Merge manifests from the root of the chain to the skin itself. Layouts merge per rank. */
export function mergeSettings(rootFirst: readonly SkinManifest[]): SkinSettings {
  const s = structuredClone(DEFAULT_SETTINGS);
  for (const m of rootFirst) {
    Object.assign(s.colors, m.colors);
    Object.assign(s.center, m.center);
    const { layouts, ...pips } = m.pips ?? {};
    Object.assign(s.pips, pips);
    Object.assign(s.pips.layouts, layouts);
    Object.assign(s.table, m.table);
    Object.assign(s.ui.button, m.ui?.button);
    Object.assign(s.ui.panel, m.ui?.panel);
  }
  return s;
}

export class SkinError extends Error {}

type Check<T> = (v: unknown, path: string) => T;

const fail = (path: string, expected: string): never => {
  throw new SkinError(`${path}: expected ${expected}`);
};

const str: Check<string> = (v, p) => (typeof v === 'string' ? v : fail(p, 'a string'));
const num: Check<number> = (v, p) => (typeof v === 'number' && Number.isFinite(v) ? v : fail(p, 'a number'));
const bool: Check<boolean> = (v, p) => (typeof v === 'boolean' ? v : fail(p, 'true or false'));

function oneOf<T extends string>(...values: T[]): Check<T> {
  return (v, p) => (values.includes(v as T) ? (v as T) : fail(p, values.map((x) => `"${x}"`).join(' or ')));
}

function list<T>(item: Check<T>): Check<T[]> {
  return (v, p) => (Array.isArray(v) ? v.map((x, i) => item(x, `${p}[${i}]`)) : fail(p, 'a list'));
}

function record<T>(item: Check<T>): Check<Record<string, T>> {
  return (v, p) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return fail(p, 'an object');
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, item(x, `${p}.${k}`)]));
  };
}

/** Object with only the given (all optional) keys, so typos are reported instead of ignored. */
function shape<T>(fields: { [K in keyof T]-?: Check<T[K]> }): Check<T> {
  return (v, p) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return fail(p, 'an object');
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const check = (fields as Record<string, Check<unknown>>)[k];
      if (!check) throw new SkinError(`${p}.${k}: unknown setting`);
      out[k] = check(x, `${p}.${k}`);
    }
    return out as T;
  };
}

function required<T>(check: Check<T>): Check<T> {
  return (v, p) => (v === undefined ? fail(p, 'a value') : check(v, p));
}

const box: Check<Box> = (v, p) => {
  const b = shape<Box>({ x: num, y: num, w: num, h: num })(v, p);
  for (const k of ['x', 'y', 'w', 'h'] as const) required(num)(b[k], `${p}.${k}`);
  return b;
};

const pipPoint: Check<PipPoint> = (v, p) => {
  if (!Array.isArray(v) || v.length < 2 || v.length > 3) return fail(p, '[x, y] or [x, y, { flip, scale }]');
  const x = num(v[0], `${p}[0]`);
  const y = num(v[1], `${p}[1]`);
  return v.length === 2 ? [x, y] : [x, y, shape<PipOptions>({ flip: bool, scale: num })(v[2], `${p}[2]`)];
};

const manifest = shape<SkinManifest>({
  name: str,
  extends: str,
  colors: record(str),
  center: shape({ box, narrowBox: box }),
  pips: shape({
    size: num,
    flip: oneOf('auto', 'none'),
    narrow: oneOf('single', 'layout'),
    layouts: record(list(pipPoint)),
  }),
  table: shape({ felt: oneOf('cover', 'tile') }),
  ui: shape({ button: shape({ slice: num }), panel: shape({ slice: num }) }),
});

export function parseManifest(raw: unknown, file: string): SkinManifest {
  return manifest(raw, file);
}

export function parseRegistry(raw: unknown, file: string): SkinRegistry {
  const r = shape<SkinRegistry>({ default: str, skins: list(str) })(raw, file);
  return { default: required(str)(r.default, `${file}.default`), skins: required(list(str))(r.skins, `${file}.skins`) };
}
