// Boon card art (openspec/changes/ui4-boon-look): like the shop's cards (src/ui/shop-art.ts), each boon shows one of
// the game's own models on a burst of its type's colour, with a glyph for what it does. A boon not listed here
// falls back to its type's picture.
import type { BoonId, BoonType } from '../boons/defs';
import { glyph, pic, type Glyph, type Pic } from './shop-art';

const BY_TYPE: Record<BoonType, Pic> = { POP: 'pop', GRIND: 'grind', FLOW: 'wheel', COOL: 'cruiser', LUCK: 'stoken', STREET: 'car' };

const BOON_ART: Partial<Record<BoonId, [Pic, Glyph?]>> = {
  tripleThreat: ['pop', '+1'],
  bigPop: ['pop', 'up'],
  floatyFlip: ['flip', 'waves'],
  lateFlip: ['flip', 'clock'],
  pressureFlip: ['pop', 'waves'],
  spareChange: ['coin', '¼'],
  strongLegs: ['shoe', 'sparks'],
  railMagnet: ['grind', 'magnet'],
  grease: ['butter', 'speed'],
  railLaunch: ['grind', 'up'],
  exitWax: ['grind', 'right'],
  feebleFrenzy: ['wax', 'flame'],
  ghostRail: ['grind', 'ghost'],
  newWheels: ['wheel', 'speed'],
  bombHill: ['board', 'down'],
  butter: ['board', 'waves'],
  kickerBoost: ['boxtruck', 'up'],
  slingshot: ['grind', 'right'],
  lowProfile: ['cruiser', 'down'],
  bubblePads: ['shoe', 'shield'],
  tuckAndRoll: ['flip', 'curl'],
  slamStoke: ['board', 'flame'],
  sirenSong: ['cruiser', 'note'],
  decoy: ['drone', '?'],
  stokenMagnet: ['stoken', 'magnet'],
  doubleStoken: ['stoken', '×2'],
  hustler: ['coin', '+1'],
  luckyReroll: ['coin', 'curl'],
  roofRider: ['bus', 'right'],
  slipstream: ['car', 'speed'],
  hoodPop: ['car', 'up'],
  spoofedPlate: ['robotaxi', '?'],
  jaywalker: ['signal', 'sparks'],
  moonShoes: ['shoe', 'up'],
  wanted: ['wanted', 'skull'],
  speedWobbles: ['wheel', 'skull'],
  rocketGrind: ['rocket', 'up'],
  skyLine: ['grind', 'ghost'],
  perpetualMotion: ['wheel', '∞'],
  ghostMode: ['chopper', 'ghost'],
};

export function boonArt(id: BoonId, type: BoonType): string {
  const [p, g] = BOON_ART[id] ?? [BY_TYPE[type]];
  return `<span class="art">${pic(p)}${glyph(g)}</span>`;
}

// just the picture, for small badges (the HUD's boon row, the pause card)
export function boonIcon(id: BoonId, type: BoonType): string {
  return pic((BOON_ART[id] ?? [BY_TYPE[type]])[0]);
}

// the underground spot's three choices
export function spotArt(key: string): string {
  const [p, g]: [Pic, Glyph] = key === 'low' ? ['cruiser', 'down'] : key === 'swap' ? ['board', 'curl'] : ['stoken', 'skull'];
  return `<span class="art">${pic(p)}${glyph(g)}</span>`;
}
