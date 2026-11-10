// Hand-made sets (zack, 2026-11-10: "i COULD just use the assets we already have to make the levels... and if i need
// more different types of stuff we can add them as we go"; openspec/changes/le2-hand-made-sets). A set is a short line
// zack draws in the set editor (?sets, src/sets/) out of the game's own pieces: decks, rails, ledges, stairs with a
// handrail, kickers, coins and Stoken. The cloud layer lays the ones turned on into act 3's cloud line and act 5's
// station line as a beat of their own (src/gen/clouds.ts), between its code sets. A set has to be cleared by the plain
// sky bot before it goes into floors (src/gen/hand-set-check.ts; tests/hand-sets.test.ts holds every set that's on to it).
//
// Sets live in hand-sets.json, saved from the editor. Units are tiles, measured from where you roll in: x along, y UP
// (a deck at y 3 is three tiles over the start). The set's last deck is where the line carries on from.
import saved from './hand-sets.json';
import { TILE } from '../physics/constants';
import { CurvedRail, polyRail, type Level, type Surface } from '../physics/level';

export type HandPartKind = 'deck' | 'rail' | 'ledge' | 'stairs' | 'kicker' | 'coins' | 'stoken';

export const PART_KINDS: HandPartKind[] = ['deck', 'rail', 'ledge', 'stairs', 'kicker', 'coins', 'stoken'];

// one piece of a set. deck: flat from (x0, y0) to x1. rail, ledge, coins: from (x0, y0) to (x1, y1), a rail bent by
// `curve` (tiles: + sags, - arches). stairs: down from (x0, y0) to (x1, y1) with a handrail over them. kicker: a ramp up
// from (x0, y0) to its lip at (x1, y1). stoken: one, at (x0, y0)
export interface HandPart {
  kind: HandPartKind;
  x0: number;
  y0: number;
  x1?: number;
  y1?: number;
  curve?: number;
}

export type HandAct = 3 | 5;

export interface HandSet {
  name: string;
  acts: HandAct[]; // which acts' lines it may come up on
  on: boolean; // in floors (only once the bot clears it)
  weight: number; // how often it's picked, against the code sets' weights (a stair set is 5, a hubba 2.5)
  most: number; // the most of it on a floor
  parts: HandPart[];
}

export interface HandSets {
  sets: HandSet[];
}

export const SAVED_SETS: HandSets = saved as HandSets;
let sets: HandSets = SAVED_SETS;

// the sets the game builds with: the saved ones, or (?setdrafts) the editor's unsaved ones
export function handSets(): HandSet[] {
  return sets.sets;
}

export function useHandSets(s: HandSets): void {
  sets = s;
}

// a set laid on every other beat of the line, whatever its tags or `on` (the editor's "play it" and the bot gate)
let forced: HandSet | null = null;
export function forcedSet(): HandSet | null {
  return forced;
}
export function forceSet(s: HandSet | null): void {
  forced = s;
}

// a handrail's height over the noses of the steps under it, px (the station line's: STATION.railH)
export const HANDRAIL_H = 0.9 * TILE;

const end = (p: HandPart): [number, number] => [p.x1 ?? p.x0, p.y1 ?? p.y0];

// how long a set is (tiles, from its start), and the height (tiles, up) the line carries on at past it: its last
// deck's (the one ending furthest along), or its last piece's end
export function setShape(s: HandSet): { length: number; endY: number; top: number; bottom: number } {
  let length = 0;
  let top = 0;
  let bottom = 0;
  for (const p of s.parts) {
    const [x1, y1] = end(p);
    length = Math.max(length, p.x0, x1);
    const lo = p.kind === 'rail' || p.kind === 'ledge' ? Math.min(p.y0, y1) - Math.max(0, p.curve ?? 0) : Math.min(p.y0, y1);
    top = Math.max(top, p.y0, y1);
    bottom = Math.min(bottom, lo);
  }
  const walk = s.parts.filter((p) => p.kind === 'deck' || p.kind === 'stairs' || p.kind === 'kicker');
  const last = (walk.length ? walk : s.parts).reduce<HandPart | null>((a, p) => (!a || Math.max(p.x0, end(p)[0]) >= Math.max(a.x0, end(a)[0]) ? p : a), null);
  const endY = last ? (last.kind === 'deck' ? last.y0 : end(last)[1]) : 0;
  return { length, endY, top, bottom };
}

// where a laid set is on a floor (px), for the bot gate and the editors
export interface LaidSet {
  name: string;
  x0: number;
  x1: number;
  y: number; // where you roll in
}

// lay set s on a floor with its start at (x, y) (px, the deck you roll in on), dressed for act's line: the clouds in
// act 3, the station in act 5. Pushes its pieces onto the floor; the line's gap-bridging keeps out of it. `scale` grows
// it all, gaps, lengths and heights alike, for a high act's lighter gravity (layerScale in src/gen/clouds.ts: act 5's
// ollie carries you 3.3x as far and as high, so the set asks exactly what it does in act 3); a handrail stays a
// handrail's height over its steps
export function laySet(level: Level, s: HandSet, x: number, y: number, act: number, scale = 1): LaidSet {
  const X = (t: number) => x + t * TILE * scale;
  const Y = (t: number) => y - t * TILE * scale;
  const space = act >= 5;
  for (const p of s.parts) {
    let [x0, y0, x1, y1] = [p.x0, p.y0, ...end(p)];
    if (x1 < x0) [x0, y0, x1, y1] = [x1, y1, x0, y0];
    if (p.kind === 'deck') {
      if (x1 - x0 > 0) level.surfaces.push({ kind: 'ledge', x0: X(x0), x1: X(x1), y: Y(p.y0), row: -1, sky: 'cloud' });
    } else if (p.kind === 'stairs') {
      //always down, left to right (you can't push up stairs), a handrail over the noses running half a tile past
      //each end
      if (y1 > y0) [y0, y1] = [y1, y0];
      if (x1 - x0 <= 0) continue;
      const st: Surface = { kind: 'stairs', x0: X(x0), x1: X(x1), y: Y(y0), y1: Y(y1), row: -1, sky: 'stairs' };
      level.surfaces.push(st);
      const r = polyRail([[X(x0) - TILE / 2, Y(y0) - HANDRAIL_H], [X(x1) + TILE / 2, Y(y1) - HANDRAIL_H]]);
      r.sky = 'handrail';
      level.rails.push(r);
    } else if (p.kind === 'rail' || p.kind === 'ledge') {
      if (x1 - x0 <= 0) continue;
      const r: CurvedRail = p.curve ? new CurvedRail(X(x0), Y(y0), X(x1), Y(y1), (p.curve * TILE) / 2) : polyRail([[X(x0), Y(y0)], [X(x1), Y(y1)]]);
      if (p.kind === 'ledge') {
        r.material = 'concrete';
        r.sky = space ? 'ledge' : 'hubba';
      } else r.sky = space ? 'deckrail' : 'srail';
      level.rails.push(r);
    } else if (p.kind === 'kicker') {
      //a ramp up to its lip: the cloud line's quarterpipe, with no launch of its own (you fly off it at your speed)
      if (y1 < y0) [y0, y1] = [y1, y0];
      if (x1 - x0 <= 0) continue;
      level.surfaces.push({ kind: 'bank', x0: X(x0), x1: X(x1), y: Y(y0), y1: Y(y1), row: -1, sky: 'qp' });
    } else if (p.kind === 'coins') {
      const n = Math.max(1, Math.round(x1 - x0));
      for (let k = 0; k <= n; k++) {
        const t = n ? k / n : 0;
        level.pickups.push({ kind: 'cash', x: X(x0 + (x1 - x0) * t), y: Y(y0 + (y1 - y0) * t) });
      }
    } else if (p.kind === 'stoken') level.pickups.push({ kind: 'stoken', x: X(p.x0), y: Y(p.y0) });
  }
  const laid = { name: s.name, x0: x, x1: X(setShape(s).length), y };
  //(drawn as it was drawn: the line's gap-bridging never decks over a gap inside a set)
  (level.airways ??= []).push([laid.x0, laid.x1]);
  (level.handSets ??= []).push(laid);
  return laid;
}

const isNum = (v: unknown) => typeof v === 'number' && isFinite(v);

export function isHandSet(v: unknown): v is HandSet {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  if (typeof s.name !== 'string' || !s.name || typeof s.on !== 'boolean' || !isNum(s.weight) || !isNum(s.most)) return false;
  if (!Array.isArray(s.acts) || !s.acts.every((a) => a === 3 || a === 5)) return false;
  if (!Array.isArray(s.parts)) return false;
  return s.parts.every((p: Record<string, unknown>) =>
    p && PART_KINDS.includes(p.kind as HandPartKind) && isNum(p.x0) && isNum(p.y0) &&
    (p.x1 === undefined || isNum(p.x1)) && (p.y1 === undefined || isNum(p.y1)) && (p.curve === undefined || isNum(p.curve)));
}

export function isHandSets(v: unknown): v is HandSets {
  return !!v && typeof v === 'object' && Array.isArray((v as HandSets).sets) && (v as HandSets).sets.every(isHandSet);
}

// the file as it's saved: one set a line's worth of parts, readable in a diff
export function formatHandSets(h: HandSets): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  const part = (p: HandPart) => {
    const o: Record<string, unknown> = { kind: p.kind, x0: round(p.x0), y0: round(p.y0) };
    if (p.x1 !== undefined) o.x1 = round(p.x1);
    if (p.y1 !== undefined) o.y1 = round(p.y1);
    if (p.curve) o.curve = round(p.curve);
    return `      ${JSON.stringify(o)}`;
  };
  const set = (s: HandSet) =>
    `    {\n      "name": ${JSON.stringify(s.name)},\n      "acts": ${JSON.stringify(s.acts)},\n      "on": ${s.on},\n      "weight": ${round(s.weight)},\n      "most": ${round(s.most)},\n      "parts": [\n${s.parts.map(part).join(',\n').replace(/^ {6}/gm, '        ')}\n      ]\n    }`;
  return `{\n  "sets": [\n${h.sets.map(set).join(',\n')}\n  ]\n}\n`;
}
