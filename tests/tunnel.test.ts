import { describe, expect, it } from 'vitest';
import { buildFloor } from '../src/gen/descent';
import { PHYS, TILE } from '../src/physics/constants';
import { CruiserPath, TUNNEL, groundAt, mouths, mouthX } from '../src/traffic/tunnel';
import { STREET_Z, Traffic, spawnPlan } from '../src/traffic/traffic';
import { FloorSim } from '../src/sim/floor';
import { FLAT, levelOf } from './helpers';

const floors = [1, 4, 6, 9, 12, 15].map((f) => buildFloor(2026, f, undefined, { hills: true }));
const high = (l: (typeof floors)[number], x0: number, x1: number) => {
  for (let x = x0; x <= x1; x += TILE / 4) if ((groundAt(l, x) ?? 0) > TUNNEL.flat) return true;
  return false;
};

describe('tunnels under the hills', () => {
  it('every stretch of hill has a mouth at the foot of its descent, and every climb one at its foot, on the flat', () => {
    for (const l of floors) {
      const spans = l.hillSpans!;
      const ms = mouths(l);
      expect(ms.filter((m) => m.way === 'out')).toHaveLength(spans.length);
      expect(ms.filter((m) => m.way === 'in')).toHaveLength(spans.length - 1);
      for (const m of ms) expect(high(l, m.x0, m.x1)).toBe(false);
    }
    //a street-only floor has none
    expect(mouths(levelOf(FLAT))).toEqual([]);
  });

  it('the cruiser never sits in the hillside: it waits in the tunnel and comes out behind you', () => {
    for (const l of floors) {
      const path = new CruiserPath(l);
      const seen: string[] = [];
      for (let x = l.startX; x < l.width - 2 * TILE; x += PHYS.baseSpeed) {
        path.step(x / TILE - 5);
        if (seen[seen.length - 1] !== path.mode) seen.push(path.mode);
        if (path.mode === 'street') expect(high(l, (path.x - 1.1) * TILE, (path.x + 1.1) * TILE)).toBe(false);
        if (path.mode === 'street') expect(path.z).toBe(STREET_Z.cruiser);
      }
      //down the opening hill out of sight, out of its tunnel, then in and out again under every later stretch
      const spans = l.hillSpans!.length;
      expect(seen.slice(0, 3)).toEqual(['gone', 'out', 'street']);
      expect(seen.filter((m) => m === 'in')).toHaveLength(spans - 1);
      expect(seen.filter((m) => m === 'out')).toHaveLength(spans);
      expect(path.mode).toBe('street');
    }
  });

  it('traffic turns into the tunnels instead of driving into the hill', () => {
    for (const l of floors) {
      const t = new Traffic(l, spawnPlan(l, l.layout.seed), l.crossings, l.busStops, l.doors);
      for (let x = l.startX; x < l.width; x += PHYS.baseSpeed) {
        t.step(x);
        for (const v of t.vehicles) if (v.tunnel === undefined) expect(high(l, v.x0, v.x1)).toBe(false);
      }
    }
    const all = floors.flatMap((l) => {
      const t = new Traffic(l, spawnPlan(l, l.layout.seed), l.crossings, l.busStops, l.doors);
      const ids = new Set<number>();
      for (let x = l.startX; x < l.width; x += PHYS.baseSpeed) {
        t.step(x);
        for (const v of t.vehicles) if (v.tunnel !== undefined) ids.add(v.id);
      }
      return [...ids];
    });
    expect(all.length).toBeGreaterThan(0);
  });

  it('the mouth is where the opening is', () => {
    const m = mouths(floors[0])[0];
    expect(mouthX(m)).toBeGreaterThan(m.x0);
    expect(mouthX(m)).toBeLessThan(m.x1);
  });
});

describe('traffic and the smashables', () => {
  it("a car in the skate lane knocks a cone flying, with nothing for the skater; it leaves the golden prop be", () => {
    const l = levelOf(FLAT);
    const at = l.startX + 30 * TILE;
    l.props = [
      { name: 'Cone', x: at, y: l.streetY, z: 0, yaw: 0, breaks: true, loot: 'cash' },
      { name: 'Crate', x: at + 3 * TILE, y: l.streetY, z: 0, yaw: 0, breaks: true, loot: 'stoken' },
    ];
    const sim = new FloorSim(l);
    sim.traffic.vehicles.push({ id: 99, kind: 'robotaxi', speed: 0, cruise: 0, lane: 0, leaving: false, x0: at - TILE, x1: at + 4 * TILE, bottom: l.streetY, roof: l.streetY - 40 });
    sim.step({ pressed: false, held: false });
    expect(sim.broken).toEqual([true, false]);
    const smash = sim.events.filter((e) => e.type === 'smash');
    expect(smash).toHaveLength(1);
    expect(smash[0]).toMatchObject({ how: 'car', index: 0 });
    expect('loot' in smash[0] && smash[0].loot).toBeFalsy();
  });
});
