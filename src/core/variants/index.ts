import type { Variant } from '../variant';
import { bbb } from './bbb';
import { klondike } from './klondike';

/** Every playable variant, in selector order. The first is the default. */
export const VARIANTS: readonly Variant[] = [bbb, klondike];
