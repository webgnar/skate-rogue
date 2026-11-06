// Boon card art (openspec/changes/ui4-boon-look): like the shop's cards (src/ui/shop-art.ts), each boon shows its
// picture on a burst of its type's colour: zack's hand-drawn one, or its type's model render until it has one.
import type { BoonId, BoonType } from '../boons/defs';
import { glyph, handArt, pic, type Glyph, type Pic } from './shop-art';

const BY_TYPE: Record<BoonType, Pic> = { POP: 'pop', GRIND: 'grind', FLOW: 'wheel', COOL: 'cruiser', LUCK: 'stoken' };

// every boon has zack's hand-drawn picture now (src/ui/shop-art.ts handArt); a new boon shows its type's model
// render until its picture is drawn and added to DRAWN
export const DRAWN = new Set<BoonId>([
  'tripleThreat', 'bigPop', 'railMagnet', 'grease', 'railLaunch', 'ghostRail', 'roofRider', 'newWheels', 'butter',
  'firecracker', 'lowProfile', 'bubblePads', 'doubleStoken', 'hustler', 'fiberglassCore', 'shoeSponsor',
  'ceramicBearings', 'classifiedUrethane', 'moonShoes', 'wanted', 'speedWobbles', 'rocketGrind', 'skyLine', 'perpetualMotion',
]);

export function boonArt(id: BoonId, type: BoonType): string {
  if (DRAWN.has(id)) return `<span class="art">${handArt(id)}</span>`;
  return `<span class="art">${pic(BY_TYPE[type])}</span>`;
}

// just the picture, for small badges (the HUD's boon row, the pause card)
export function boonIcon(id: BoonId, type: BoonType): string {
  if (DRAWN.has(id)) return handArt(id);
  return pic(BY_TYPE[type]);
}

// the underground spot's three choices
export function spotArt(key: string): string {
  const [p, g]: [Pic, Glyph] = key === 'low' ? ['cruiser', 'down'] : key === 'swap' ? ['board', 'curl'] : ['stoken', 'skull'];
  return `<span class="art">${pic(p)}${glyph(g)}</span>`;
}
