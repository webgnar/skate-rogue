// Act 3 starts hunted (zack 2026-11-10: "act 3 should start with heat because end of cutscene 2 ends with the drones
// after him. the drones should be after him when 3 starts"): act 3's first floor carries drone patterns over its
// clouds and girder steps (src/sim/drones.ts huntSpots), and the game starts it at an escape's Heat.
import { describe, expect, it } from 'vitest';
import { floorLevel } from '../src/run/floor-level';
import { FULL_LIBRARY } from '../src/run/meta';
import { FloorSim } from '../src/sim/floor';
import { Pilot } from '../src/bot/pilot';
import { DRONE } from '../src/sim/drones';
import { TILE } from '../src/physics/constants';

const road = { kind: 'boon', boonType: 'POP', danger: 2 } as const;
const at = (seed: number, floor: number) => floorLevel({ seed, floor, road, library: FULL_LIBRARY, gnar: 0 });

describe("act 3's first floor: the drones followed you up", () => {
  it('only floor 7 is hunted', () => {
    for (const floor of [1, 4, 6, 8, 9, 10]) expect(at(5, floor).hunt).toBeUndefined();
  }, 60000);

  it('drones hover over clouds and girder steps along floor 7, none right at the start', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const l = at(seed * 31, 7);
      const hunt = l.hunt!;
      expect(hunt.length).toBeGreaterThanOrEqual(3);
      for (const d of hunt) {
        expect(d.x).toBeGreaterThan(l.startX + 10 * TILE);
        //over a piece of the layer, the whole box over it
        const under = l.surfaces.find((s) => (s.sky === 'cloud' || s.sky === 'step') && s.y === d.base && s.x0 <= d.x && s.x1 >= d.x + DRONE.w);
        expect(under).toBeDefined();
      }
      const sim = new FloorSim(l);
      expect(sim.swarm?.drones.length).toBe(hunt.length);
    }
  }, 60000);

  it('a good player still clears it', () => {
    let downed = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const sim = new FloorSim(at(seed * 31, 7), undefined, 30);
      const pilot = new Pilot('sky');
      for (let k = 0; k < 60 * 200 && sim.state === 'skate'; k++) sim.step(pilot.input(sim));
      expect(sim.state).toBe('exit');
      downed += sim.swarm!.downed;
    }
    expect(downed).toBeGreaterThan(0);
  }, 180000);
});
