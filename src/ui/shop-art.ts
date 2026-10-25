// Card art for the skate shop (openspec/changes/ui3-shop-look): each card shows one of the game's own models
// (rendered by art/cards, public/sprites/cards/*.png) on a burst in the card's colour, with a comic glyph on top
// that says what the mod does (an arrow for a pop, a clock for a delay, ×2...).
import type { ModId } from '../board/mods';
import type { GearPart } from '../run/gear';

const base = import.meta.env.BASE_URL;

type Pic = 'board' | 'pop' | 'flip' | 'grind' | 'car' | 'coin' | 'stoken' | 'deck' | 'truck' | 'wheel' | 'shoe';
type Glyph = 'up' | 'down' | 'right' | 'curl' | 'clock' | 'speed' | 'ring' | 'sparks' | 'plus' | 'flipv' | string;

const MOD_ART: Record<ModId, [Pic, Glyph?]> = {
  onOllie: ['pop', 'up'],
  onLand: ['board', 'down'],
  onGrind: ['grind'],
  onGrindEnd: ['grind', 'right'],
  onTrick: ['flip', 'curl'],
  onHop: ['car', 'up'],
  sparks: ['grind', 'sparks'],
  doublePop: ['pop', '2X'],
  speedKick: ['board', 'speed'],
  jumpRefill: ['pop', '+½'],
  cashBurst: ['coin', 'sparks'],
  slowMo: ['board', 'clock'],
  gravFlip: ['flip', 'flipv'],
  shockwave: ['board', 'ring'],
  twice: ['stoken', '×2'],
  delay: ['wheel', 'clock'],
  comboOnly: ['flip', '5+'],
  coinFlip: ['coin', '?'],
};

const GEAR_ART: Record<GearPart, Pic> = { deck: 'deck', trucks: 'truck', wheels: 'wheel', shoes: 'shoe' };

// a sneaker in the comic style: no model of Lou's shoes on their own, so it's drawn
const SHOE =
  '<svg class="pic" viewBox="0 0 64 40" aria-hidden="true"><path d="M4 22c0-6 3-12 6-14l8 1c3 5 9 8 16 9l14 3c7 1 12 4 12 9v3H4z" fill="#ff3fa4" stroke="#120a16" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<path d="M18 9c2 6 8 9 15 10l-4 7H8" fill="#f4f0f6" stroke="#120a16" stroke-width="2" stroke-linejoin="round"/><path d="M20 13l5-2M23 17l5-2M27 20l5-2" stroke="#120a16" stroke-width="2" stroke-linecap="round"/>' +
  '<path d="M3 31h59v4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill="#f4f0f6" stroke="#120a16" stroke-width="2.5"/><path d="M36 25c6 0 12 1 16 4" stroke="#120a16" stroke-width="2" fill="none"/></svg>';

const SVG_GLYPHS: Record<string, string> = {
  up: '<path d="M16 3 4 17h7v12h10V17h7z"/>',
  down: '<path d="M4 6h24M8 12h16M12 18h8" stroke-linecap="round"/><path d="M16 29 8 20h16z"/>',
  right: '<path d="M3 11h14V4l12 12-12 12v-7H3z"/>',
  curl: '<path d="M6 22a11 11 0 1 1 15 4" fill="none" stroke-width="5"/><path d="M15 21l10 7-1-12z"/>',
  clock: '<circle cx="16" cy="16" r="13" fill="#fff"/><path d="M16 8v9l6 4" fill="none" stroke-width="3" stroke-linecap="round"/>',
  speed: '<path d="M2 8h18M6 16h22M2 24h16" fill="none" stroke-width="4" stroke-linecap="round"/>',
  ring: '<circle cx="16" cy="16" r="12" fill="none" stroke-width="4"/><circle cx="16" cy="16" r="5" fill="none" stroke-width="3"/>',
  sparks: '<path d="M16 2l3 9 9-3-6 8 8 5-10 1 1 9-5-8-6 7 1-9-9-2 9-4-4-8 8 4z"/>',
  plus: '<path d="M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9z"/>',
  flipv: '<path d="M11 3 3 13h5v6h6v-6h5zM21 29l8-10h-5v-6h-6v6h-5z"/>',
};

function glyph(g: Glyph | undefined): string {
  if (!g) return '';
  const svg = SVG_GLYPHS[g];
  if (svg) return `<svg class="glyph g-${g}" viewBox="0 0 32 32" aria-hidden="true">${svg}</svg>`;
  return `<span class="glyph word">${g}</span>`;
}

function pic(p: Pic): string {
  return p === 'shoe' ? SHOE : `<img class="pic" src="${base}sprites/cards/${p}.png" alt="" draggable="false" />`;
}

export function modArt(id: ModId): string {
  const [p, g] = MOD_ART[id];
  return `<span class="art">${pic(p)}${glyph(g)}</span>`;
}

export function slotArt(): string {
  return `<span class="art">${pic('board')}${glyph('plus')}</span>`;
}

export function gearArt(part: GearPart): string {
  return `<span class="art">${pic(GEAR_ART[part])}</span>`;
}

// the small picture on a gear tile in YOUR GEAR
export function gearIcon(part: GearPart): string {
  return pic(GEAR_ART[part]);
}
