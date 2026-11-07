import type { CosmeticDef } from '../types';

// Cosmetics: paint scheme + trail colour on the Ship model, seen by everyone. Zero stats, ever.
export const COSMETICS: Record<string, CosmeticDef> = {
  'desert-camo': { id: 'desert-camo', paint: '#b89a64', trail: '#ffd28a' },
  'storm-grey': { id: 'storm-grey', paint: '#6b7480', trail: '#bcd4ff' },
  'crimson-ace': { id: 'crimson-ace', paint: '#9e2b25', trail: '#ff7a5a' },
  'gilded-ace': { id: 'gilded-ace', paint: '#c9a24a', trail: '#fff1b8' },
};

export const COSMETIC_NAMES: Record<string, string> = {
  'desert-camo': 'Desert Camo',
  'storm-grey': 'Storm Grey',
  'crimson-ace': 'Crimson Ace',
  'gilded-ace': 'Gilded Ace',
};

/** Credits price (shop). */
export const COSMETIC_PRICE: Record<string, number> = {
  'desert-camo': 800,
  'storm-grey': 800,
  'crimson-ace': 1500,
  'gilded-ace': 3000,
};
