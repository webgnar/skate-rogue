// Card art for the skate shop (openspec/changes/ui3-shop-look): each card shows one of the game's own models
// (rendered by art/cards, public/sprites/cards/*.png; the gear cards' truck, wheel and shoe are art/gear.py) on a burst in the card's colour, with a comic glyph on top
// that says what the mod does (an arrow for a pop, a clock for a delay, ×2...).
import type { ModId } from '../board/mods';
import type { GearPart } from '../run/gear';

const base = import.meta.env.BASE_URL;

export type Pic =
  | 'board' | 'pop' | 'flip' | 'grind' | 'car' | 'coin' | 'stoken' | 'deck' | 'truck' | 'wheel' | 'shoe' | 'bearing'
  | 'cruiser' | 'robotaxi' | 'bus' | 'boxtruck' | 'drone' | 'chopper' | 'wanted' | 'signal' | 'rocket';
export type Glyph = 'up' | 'down' | 'right' | 'curl' | 'clock' | 'speed' | 'ring' | 'sparks' | 'plus' | 'flipv' | string;

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

const GEAR_ART: Record<GearPart, Pic> = { deck: 'deck', trucks: 'truck', wheels: 'wheel', shoes: 'shoe', bearings: 'bearing' };

// bearings in the comic style, from zack's refs (2026-10-30): a Swiss-style one in front, black shield with a red
// ring and bright races, and an open bronze ceramic one behind it showing its black balls in a white cage
const balls = Array.from({ length: 7 }, (_, i) => {
  const a = (i / 7) * Math.PI * 2 - 0.4;
  return `<circle cx="${(22 + Math.cos(a) * 9.2).toFixed(1)}" cy="${(18 + Math.sin(a) * 9.2).toFixed(1)}" r="2.7" fill="#1c1c22" stroke="#120a16" stroke-width="1"/><circle cx="${(21.2 + Math.cos(a) * 9.2).toFixed(1)}" cy="${(17.2 + Math.sin(a) * 9.2).toFixed(1)}" r="0.8" fill="#9aa"/>`;
}).join('');
const BEARING =
  '<svg class="pic" viewBox="0 0 64 40" aria-hidden="true">' +
  '<circle cx="22" cy="18" r="15" fill="#c8954a" stroke="#120a16" stroke-width="2.5"/><circle cx="22" cy="18" r="12" fill="#f4f0f6" stroke="#8a5f2a" stroke-width="1.2"/>' +
  balls +
  '<circle cx="22" cy="18" r="6.4" fill="#d6a95e" stroke="#120a16" stroke-width="2"/><circle cx="22" cy="18" r="3.6" fill="#f4f0f6" stroke="#8a5f2a" stroke-width="1"/>' +
  '<circle cx="42" cy="22" r="16" fill="#d8dce2" stroke="#120a16" stroke-width="2.5"/><circle cx="42" cy="22" r="13" fill="#17171b" stroke="#120a16" stroke-width="1"/>' +
  '<circle cx="42" cy="22" r="9.6" fill="none" stroke="#e8322a" stroke-width="2.2"/><circle cx="42" cy="22" r="6" fill="#d8dce2" stroke="#120a16" stroke-width="2"/>' +
  '<circle cx="42" cy="22" r="3.2" fill="#3a3a44" stroke="#120a16" stroke-width="1.2"/><path d="M33 13a12 12 0 0 1 8-4" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.8"/></svg>';

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
  magnet: '<path d="M4 4h8v12a4 4 0 0 0 8 0V4h8v12a12 12 0 0 1-24 0z"/><path d="M4 4h8v5H4zM20 4h8v5h-8z" fill="#ff4a5a"/>',
  ghost: '<path d="M6 29V14a10 10 0 0 1 20 0v15l-4-3-3 3-3-3-3 3-3-3z" fill="#e8f8ff"/><circle cx="12" cy="14" r="2" fill="#120a16"/><circle cx="20" cy="14" r="2" fill="#120a16"/>',
  flame: '<path d="M16 2c2 6 9 8 9 17a9 9 0 0 1-18 0c0-5 3-7 4-11 1 3 2 4 3 4 0-4 1-7 2-10z" fill="#ff8a1f"/>',
  shield: '<path d="M16 2 4 7v8c0 8 5 13 12 15 7-2 12-7 12-15V7z" fill="#7df0ff"/>',
  note: '<path d="M12 4l16-3v20a4 4 0 1 1-3-4V8l-10 2v14a4 4 0 1 1-3-4z"/>',
  skull: '<path d="M16 2C8 2 4 8 4 14c0 4 2 6 4 7v5h16v-5c2-1 4-3 4-7 0-6-4-12-12-12z" fill="#f4f0f6"/><circle cx="11" cy="14" r="3" fill="#120a16"/><circle cx="21" cy="14" r="3" fill="#120a16"/><path d="M13 26v3M16 26v3M19 26v3" stroke-width="2"/>',
  waves: '<path d="M2 10q4-5 8 0t8 0 8 0 6-2M2 18q4-5 8 0t8 0 8 0 6-2M2 26q4-5 8 0t8 0 8 0 6-2" fill="none" stroke-width="3.5" stroke-linecap="round"/>',
};

export function glyph(g: Glyph | undefined): string {
  if (!g) return '';
  const svg = SVG_GLYPHS[g];
  if (svg) return `<svg class="glyph g-${g}" viewBox="0 0 32 32" aria-hidden="true">${svg}</svg>`;
  return `<span class="glyph word">${g}</span>`;
}

export function pic(p: Pic): string {
  return p === 'bearing' ? BEARING : `<img class="pic" src="${base}sprites/cards/${p}.png" alt="" draggable="false" />`;
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

// a grip colour card's picture (zack's photo, 2026-10-30): a roll of grip tape in the colour, its brown paper
// backing peeled out behind it with GRIP printed on it, the grit speckled over the roll
export function gripArt(color: string): string {
  const id = `g${color.replace('#', '')}`;
  //a steady scatter of grit, light and dark
  const rnd = (n: number) => {
    const v = Math.sin(n * 127.1) * 43758.5453;
    return v - Math.floor(v);
  };
  const grit = Array.from({ length: 90 }, (_, i) => {
    const x = 50 + rnd(i) * 40;
    const y = 22 + rnd(i + 500) * 64;
    return `<circle cx="${x}" cy="${y}" r="0.7" fill="${i % 3 ? '#000' : '#fff'}" opacity="${i % 3 ? 0.22 : 0.3}"/>`;
  }).join('');
  const words = [
    [16, 30],
    [30, 54],
    [12, 74],
  ].map(([x, y]) => `<text x="${x}" y="${y}" transform="rotate(-18 ${x} ${y})" class="grip-word">GRIP</text>`).join('');
  return `<span class="art"><svg class="grip" viewBox="0 0 100 96" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0.35"/>
      <stop offset="0.35" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></linearGradient></defs>
    <path d="M6 14 Q30 4 58 10 L58 82 Q30 78 6 88 Z" fill="#c9935a" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
    ${words}
    <path d="M48 14 L48 84 A22 7 0 0 0 92 84 L92 14 Z" fill="${color}" stroke="#000" stroke-width="2.5"/>
    <path d="M48 14 L48 84 A22 7 0 0 0 92 84 L92 14 Z" fill="url(#${id})"/>
    ${grit}
    <ellipse cx="70" cy="14" rx="22" ry="7" fill="${color}" stroke="#000" stroke-width="2.5"/>
    <ellipse cx="70" cy="14" rx="22" ry="7" fill="#fff" opacity="0.18"/>
    <ellipse cx="70" cy="14" rx="11" ry="3.6" fill="#eee" stroke="#000" stroke-width="1.5"/>
  </svg></span>`;
}
