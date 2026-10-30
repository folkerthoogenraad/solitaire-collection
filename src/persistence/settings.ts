const KEY = 'solitaire.settings';

/** Preferences, kept apart from the game save so neither needs the other's schema. */
export interface Settings {
  skin?: string;
}

export function loadSettings(): Settings {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    const skin = (data as Settings | null)?.skin;
    return typeof skin === 'string' ? { skin } : {};
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
