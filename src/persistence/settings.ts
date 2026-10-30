const KEY = 'solitaire.settings';

/** `system` follows the OS "reduce motion" setting; the others override it. */
export const MOTIONS = ['system', 'full', 'reduced'] as const;
export type Motion = (typeof MOTIONS)[number];

export const isMotion = (v: unknown): v is Motion => MOTIONS.includes(v as Motion);

/** Preferences, kept apart from the game save so neither needs the other's schema. */
export interface Settings {
  skin?: string;
  motion?: Motion;
}

export function loadSettings(): Settings {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Settings | null;
    const settings: Settings = {};
    if (typeof data?.skin === 'string') settings.skin = data.skin;
    if (isMotion(data?.motion)) settings.motion = data.motion;
    return settings;
  } catch {
    return {};
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not persisting is better than breaking the game.
  }
}
