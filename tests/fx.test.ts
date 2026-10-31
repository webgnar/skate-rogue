import { inkLens } from '../src/render/toon';
import { lensSource } from '../src/render/lens';
import * as THREE from 'three';
import { SmashFx, isBig, palette, shatter, stuffOf, type SmashHit } from '../src/render/smash';
import { biomeMood, isBiome } from '../src/render/biomes';
import { BoonFx } from '../src/render/boon-fx';
import { EscapeFx } from '../src/render/escape-fx';
import { SirenFx, SIREN } from '../src/render/siren-fx';
import { PhoneFx, PHONE, flashAt } from '../src/render/phone-fx';
import { GateFx, GATE_FX } from '../src/render/gate-fx';
import { CruiserJets, JETS, jetState } from '../src/render/cruiser-jets';
import { chrome, railHeights, railTint, railUv, RAIL_METAL } from '../src/render/rail-metal';
import type { BoonId } from '../src/boons/defs';
import { Particles } from '../src/render/particles';
import { SLIDES } from '../src/physics/tricks';
import { landDust, landKick } from '../src/render/land-fx';
import { FEEL } from '../src/physics/feel';
import { applyParams, clampPixel, FX, PIXEL_MAX } from '../src/render/fx-settings';
import { VisorGlint, VISOR, VISOR_TINT } from '../src/render/visor-glint';
import { mergeInk, splitSlabs } from '../src/render/kit-merge';
import { batchStatic } from '../src/render/batch';
import { inkify, solid } from '../src/render/toon';
import { describe, expect, it } from 'vitest';
import { TimeWarp } from '../src/game/time-warp';
import { FixedStep } from '../src/game/loop';
import { ParticlePool } from '../src/render/particle-pool';

describe('time warp', () => {
  it('freezes, then slows, then returns to full speed', () => {
    const w = new TimeWarp();
    expect(w.scale).toBe(1);
    w.hit(0.09, 0.3, 0.5);
    expect(w.scale).toBe(0);
    w.update(0.05);
    expect(w.scale).toBe(0);
    w.update(0.05); // 0.01 s into the slow-mo
    expect(w.scale).toBeGreaterThan(0.29);
    expect(w.scale).toBeLessThan(0.35);
    w.update(0.25);
    const mid = w.scale;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(1);
    w.update(0.3);
    expect(w.scale).toBe(1);
  });

  it('runs no physics steps while frozen, fewer while slow, and all of them after', () => {
    const w = new TimeWarp();
    const loop = new FixedStep();
    const steps = (secs: number) => {
      let n = 0;
      for (let t = 0; t < secs - 1e-9; t += 1 / 60) {
        loop.advance((1 / 60) * w.scale, () => n++);
        w.update(1 / 60);
      }
      return n;
    };
    w.hit(0.1, 0.3, 0.5);
    expect(steps(0.1)).toBe(0);
    const slow = steps(0.5);
    expect(slow).toBeGreaterThan(5);
    expect(slow).toBeLessThan(27);
    expect(steps(1)).toBeGreaterThanOrEqual(59);
  });
});

describe('particle pool', () => {
  it('never grows past its size and reuses the oldest slot', () => {
    const pool = new ParticlePool(4);
    const slots = Array.from({ length: 6 }, () => pool.alloc());
    expect(slots).toEqual([0, 1, 2, 3, 0, 1]);
  });

  it('frees particles when their life runs out', () => {
    const pool = new ParticlePool(8);
    const i = pool.alloc();
    pool.life[i] = 0.2;
    pool.age[i] = 0;
    pool.step(0.1);
    expect(pool.alive(i)).toBe(true);
    pool.step(0.15);
    expect(pool.alive(i)).toBe(false);
  });

  it('applies gravity and drag', () => {
    const pool = new ParticlePool(2);
    const i = pool.alloc();
    pool.life[i] = 1;
    pool.vx[i] = 2;
    pool.drag[i] = 1;
    pool.grav[i] = 10;
    pool.step(0.1);
    expect(pool.vy[i]).toBeLessThan(0);
    expect(pool.vx[i]).toBeLessThan(2);
    expect(pool.px[i]).toBeGreaterThan(0);
  });
});

import { MOODS, clockFor, moodAt, rainsOn } from '../src/render/atmosphere';

describe('time of day', () => {
  it('runs from afternoon on floor 1 to night by act 5, and stays night in Endless', () => {
    expect(clockFor(1)).toBe(0);
    expect(moodAt(clockFor(1)).skyTop).toBe(MOODS.afternoon.skyTop);
    expect(moodAt(clockFor(13)).skyTop).toBe(MOODS.night.skyTop);
    expect(moodAt(clockFor(40)).stars).toBe(1);
    // gets steadily darker
    const sun = [1, 4, 7, 10, 13].map((f) => moodAt(clockFor(f)).hemi);
    for (let i = 1; i < sun.length; i++) expect(sun[i]).toBeLessThanOrEqual(sun[i - 1]);
  });

  it('rains on some floors, never the first, the same for a seed', () => {
    const floors = Array.from({ length: 200 }, (_, i) => rainsOn(1234, i + 1));
    expect(floors[0]).toBe(false);
    const share = floors.filter(Boolean).length / floors.length;
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.18); // about one floor in eight
    expect(rainsOn(1234, 7)).toBe(rainsOn(1234, 7));
  });
  it('never rains two floors running', () => {
    for (const seed of [1, 77, 1234, 99991]) for (let f = 2; f < 300; f++) expect(rainsOn(seed, f) && rainsOn(seed, f - 1)).toBe(false);
  });
});

import { puddleGrowth, puddleSpots, PUDDLE } from '../src/render/puddles';
import { rainLevel, RAIN } from '../src/render/atmosphere';
import { buildFloor } from '../src/gen/descent';

describe('puddles', () => {
  const level = buildFloor(5, 6);
  const spots = puddleSpots(level, 5, 6);

  it('lands on flat ground, clear of cars and glass, the same for a seed', () => {
    expect(spots.length).toBeGreaterThan(3);
    for (const p of spots) {
      for (const c of level.cars) expect(p.x + p.w <= c.x0 / 32 - 1 || p.x - p.w >= c.x1 / 32 + 1).toBe(true);
    }
    expect(puddleSpots(level, 5, 6)).toEqual(spots);
  });

  it('forms over the first ~20 s of the floor', () => {
    expect(spots.every((p) => puddleGrowth(p, 0) === 0)).toBe(true);
    expect(spots.every((p) => puddleGrowth(p, PUDDLE.lastStart + PUDDLE.grow) === 1)).toBe(true);
  });

  it('rolls drizzle, rain or downpour only on rainy floors', () => {
    const levels = new Set<number>();
    for (let f = 1; f < 300; f++) levels.add(rainLevel(77, f));
    expect([...levels].sort()).toEqual([0, RAIN.drizzle, RAIN.rain, RAIN.downpour].sort());
    expect(rainLevel(77, 1)).toBe(0);
  });
});

describe('effect settings from the URL', () => {
  const base = { quality: 'auto', reduceMotion: false, reduceFlashing: false, heatCue: false, pixel: 1, ghost: 'pink', flipLines: 'ink' } as const;
  const q = (s: string) => applyParams({ ...base }, new URLSearchParams(s));
  it('calm turns on both accessibility switches, calm=0 turns them off', () => {
    expect(q('calm')).toMatchObject({ reduceMotion: true, reduceFlashing: true });
    expect(applyParams({ ...base, reduceMotion: true, reduceFlashing: true }, new URLSearchParams('calm=0'))).toMatchObject({ reduceMotion: false, reduceFlashing: false });
  });
  it('sets the tier and single switches', () => {
    expect(q('fx=low').quality).toBe('low');
    expect(q('fx=nonsense').quality).toBe('auto');
    expect(q('noflash')).toMatchObject({ reduceMotion: false, reduceFlashing: true });
    expect(q('heatcue').heatCue).toBe(true);
  });
  it('sets the chunky pixel look, kept to a whole 1 to PIXEL_MAX', () => {
    expect(q('').pixel).toBe(1);
    expect(q('pixel=4').pixel).toBe(4);
    expect(q('pixel=99').pixel).toBe(PIXEL_MAX);
    expect(q('pixel=0').pixel).toBe(1);
    expect(q('pixel=junk').pixel).toBe(1);
    expect(q('pixel=2.6').pixel).toBe(3);
    expect(clampPixel(undefined)).toBe(1);
  });
});

describe('boon and board mod looks', () => {
  const calls: string[] = [];
  const fake = { spray: () => calls.push('spray'), stream: (k: string) => calls.push(k) } as unknown as Particles;
  const look = { mode: 'air' as const, floatT: 10, holdT: 0, onRailT: 0, carry: 0, hsp: 3 };
  it('shows only the boons that are held', () => {
    const fx = new BoonFx(fake);
    fx.setBoons([{ id: 'bigPop', stacks: 1 }]);
    calls.length = 0;
    fx.event({ type: 'ollie', spin: 0 }, 0, 0, 3);
    fx.update(1 / 60, look, 0, 0);
    expect(calls).toEqual(['spray']);
    fx.setBoons([{ id: 'floatyFlip', stacks: 1 }]);
    calls.length = 0;
    fx.event({ type: 'ollie', spin: 0 }, 0, 0, 3);
    fx.update(1 / 60, look, 0, 0);
    expect(calls).toEqual(['floaty']);
  });
  it('every board mod effect except sparks has a look', () => {
    const fx = new BoonFx(fake);
    for (const e of ['doublePop', 'speedKick', 'jumpRefill', 'cashBurst', 'slowMo', 'gravFlip', 'shockwave'] as const) {
      calls.length = 0;
      fx.mod(e, 0, 0);
      expect(calls.length, e).toBeGreaterThan(0);
    }
  });
  it('curses, duos and the FLOW, COOL and STREET boons show on their moments', () => {
    const fx = new BoonFx(fake);
    const at = (id: BoonId, e: Parameters<BoonFx['event']>[0], speed = 3) => {
      fx.setBoons([{ id, stacks: 1 }]);
      calls.length = 0;
      fx.event(e, 0, 0, speed);
      return calls.length;
    };
    expect(at('hoodPop', { type: 'hop' })).toBeGreaterThan(0);
    expect(at('sirenSong', { type: 'hop' })).toBeGreaterThan(0);
    expect(at('kickerBoost', { type: 'kicker' })).toBeGreaterThan(0);
    expect(at('slingshot', { type: 'exit' })).toBeGreaterThan(0);
    expect(at('slamStoke', { type: 'slam' })).toBeGreaterThan(0);
    expect(at('bubblePads', { type: 'pad' })).toBeGreaterThan(0);
    expect(at('moonShoes', { type: 'ollie', spin: 0 })).toBeGreaterThan(0);
    expect(at('skyLine', { type: 'trick', index: 0, name: 'kickflip', spin: 0, fakie: false })).toBeGreaterThan(0);
    expect(at('butter', { type: 'land' }, 1)).toBe(0); // only when the air speed carries on
    expect(at('butter', { type: 'land' }, 9)).toBeGreaterThan(0);
    expect(at('hoodPop', { type: 'slam' })).toBe(0);
    //Rocket Grind only off a fast grind
    fx.setBoons([{ id: 'rocketGrind', stacks: 1 }]);
    fx.update(1 / 60, { ...look, mode: 'grind' }, 0, 0);
    calls.length = 0;
    fx.event({ type: 'ollie', spin: 0 }, 0, 0, 8);
    expect(calls.length).toBe(2);
    //the curses that run while they're held
    fx.setBoons([{ id: 'wanted', stacks: 1 }, { id: 'speedWobbles', stacks: 1 }]);
    calls.length = 0;
    fx.update(1 / 60, { ...look, hsp: 30 }, 0, 0);
    expect(calls).toEqual(expect.arrayContaining(['wanted', 'wobbles']));
  });
});

describe('biome looks', () => {
  it('Chicago is the plain time of day; others grade it', () => {
    const m = moodAt(0.5);
    expect(biomeMood(m, 'chicago')).toBe(m);
    const sea = biomeMood(m, 'atlantis');
    expect(sea.fog).not.toBe(m.fog);
    expect(sea.fogFar).toBeLessThan(m.fogFar);
    expect(biomeMood(m, 'space').stars).toBe(1);
  });
  it('every biome named in the GDD has a look', () => {
    for (const id of ['chicago', 'clemente', 'greece', 'atlantis', 'museum', 'hightech', 'space', 'hive']) expect(isBiome(id)).toBe(true);
    expect(isBiome('mars')).toBe(false);
  });
});

describe('smashables', () => {
  const fakeParticles = { spray: () => {}, stream: () => {} } as unknown as Particles;
  const hit = (o: Partial<SmashHit> = {}): SmashHit => ({ prop: 'Crate', index: 3, x: 0, y: 0, how: 'roll', speed: 1, ...o });
  it('reads what a prop is made of from its name', () => {
    expect(stuffOf('Bottle')).toBe('glass');
    expect(stuffOf('NewsBoxRed')).toBe('metal');
    expect(stuffOf('Crate')).toBe('wood');
    expect(stuffOf('Cone')).toBe('plastic');
    expect(stuffOf('Planter')).toBe('stone');
  });
  it('a big smash gets a word; only a slam or a car through it shakes the camera', () => {
    const words: string[] = [];
    let kicks = 0;
    const fx = new SmashFx(fakeParticles, { word: (_x, _y, w) => words.push(w), shake: () => kicks++ });
    fx.smash(hit());
    expect(words).toEqual([]);
    fx.smash(hit({ how: 'land' }));
    fx.smash(hit({ how: 'roll', speed: 2 }));
    expect(words.length).toBe(2);
    expect(kicks).toBe(0); // plain smashing: no shake, for now
    fx.smash(hit({ how: 'slam' }));
    fx.smash(hit({ how: 'car', speed: 2 }));
    expect(kicks).toBe(2);
    expect(isBig(hit({ speed: 2 }))).toBe(true);
  });
  it('hides the prop, flings its pieces, and clears them after their life', () => {
    const hidden: number[] = [];
    const fx = new SmashFx(fakeParticles, { word: () => {}, shake: () => {}, hide: (i) => hidden.push(i) });
    fx.smash(hit());
    expect(hidden).toEqual([3]);
    expect(fx.group.children.length).toBeGreaterThan(0);
    for (let k = 0; k < 90; k++) fx.update(1 / 60);
    expect(fx.group.children.length).toBe(0);
  });
  it('an unbreakable prop stays put', () => {
    const hidden: number[] = [];
    const fx = new SmashFx(fakeParticles, { word: () => {}, shake: () => {}, hide: (i) => hidden.push(i) });
    fx.smash(hit({ prop: 'Hydrant', breakable: false }));
    expect(hidden).toEqual([]);
    expect(fx.group.children.length).toBe(0);
  });
});

describe('smash pieces from a stray export', () => {
  it('pulls pieces back over the prop when the file left them offset', () => {
    const fx = new SmashFx({ spray: () => {} } as unknown as Particles, {
      word: () => {},
      shake: () => {},
      pieces: () => [0, 1].map((k) => ({ geometry: new THREE.BoxGeometry(0.1, 0.1, 0.1), offset: new THREE.Vector3(27.5 + k * 0.2, 0.3, 0) })),
    });
    fx.smash({ prop: 'Crate', index: 0, x: 5, y: 0, z: -3, how: 'roll', speed: 1 });
    for (const m of fx.group.children) {
      expect(Math.abs(m.position.x - 5)).toBeLessThan(0.5);
      expect(m.position.z).toBeCloseTo(-3, 1);
    }
  });
});

describe('visor glint', () => {
  const rig = () => {
    const root = new THREE.Group();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 }));
    m.name = 'VisorGlint';
    root.add(m);
    return { root, mat: m.material as THREE.MeshBasicMaterial };
  };
  it('is faint by day, brighter and tinted at night', () => {
    const { root, mat } = rig();
    const v = new VisorGlint(root);
    v.setNight(0);
    v.update(0.016);
    expect(mat.opacity).toBeCloseTo(VISOR.day);
    expect(mat.color.getHex()).toBe(0xffffff);
    v.setNight(1, VISOR_TINT.hightech);
    v.update(0.016);
    expect(mat.opacity).toBeCloseTo(VISOR.night);
    expect(mat.color.getHex()).not.toBe(0xffffff);
  });
  it('gleams on a ping and settles back; no gleam with reduced flashing', () => {
    const { root, mat } = rig();
    const v = new VisorGlint(root);
    v.setNight(0);
    v.ping();
    v.update(0);
    expect(mat.opacity).toBeGreaterThan(VISOR.day + 0.2);
    v.update(1);
    expect(mat.opacity).toBeCloseTo(VISOR.day);
    FX.reduceFlashing = true;
    v.ping();
    v.update(0);
    expect(mat.opacity).toBeCloseTo(VISOR.day);
    FX.reduceFlashing = false;
  });
  it('does nothing on a rig without the strip', () => {
    const v = new VisorGlint(new THREE.Group());
    v.setNight(1);
    v.ping();
    expect(() => v.update(0.1)).not.toThrow();
  });
});

describe('kit merge', () => {
  const kit = () => {
    const root = new THREE.Group();
    const side = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const top = new THREE.MeshLambertMaterial({ color: 0x555555 });
    for (let i = 0; i < 4; i++) {
      const front = new THREE.MeshLambertMaterial({ color: 0xffffff });
      front.userData.facade = { w: 2, h: 3, t: 0 }; // each building's own window map: never batched
      const b = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), [side, side, top, side, front, side]);
      b.position.set(i * 3, 1.5, 0);
      root.add(b);
    }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), new THREE.MeshLambertMaterial());
    sign.userData.forkSign = 'high';
    root.add(sign);
    return root;
  };
  const draws = (root: THREE.Object3D) => {
    let n = 0;
    root.traverseVisible((o) => {
      if (o instanceof THREE.Mesh) n += Array.isArray(o.material) ? o.geometry.groups.length : 1;
    });
    return n;
  };
  it('splits buildings so tops and sides batch, and merges the static outlines into one', () => {
    const root = kit();
    const slabs = splitSlabs(root);
    expect(slabs).toHaveLength(4);
    batchStatic(root);
    inkify(root, { outline: (m) => !m.userData.noInk && solid(m) });
    const ink = mergeInk(root, slabs)!;
    expect(ink.userData.ink).toBe(true);
    // 4 fronts + 1 side batch + 1 top batch + the sign + its own outline + the merged ink
    expect(draws(root)).toBe(9);
    // the sign moves, so it keeps its own outline
    const sign = root.children.find((o) => o.userData.forkSign)!;
    expect(sign.children.some((c) => c.userData.ink)).toBe(true);
    // the merged outline spans every building, in kit space
    ink.geometry.computeBoundingBox();
    expect(ink.geometry.boundingBox!.max.x).toBeCloseTo(10);
    expect(ink.geometry.getAttribute('inkNormal')).toBeTruthy();
  });
  it('cardboard breaks like paper', () => {
    expect(stuffOf('CardboardBox')).toBe('paper');
    expect(stuffOf('SandwichBoard')).toBe('wood');
  });
});

describe('gear wear', () => {
  it('puffs from the worn part, more when busted', () => {
    const calls: { y: number; n: number }[] = [];
    const fake = { spray: (_x: number, y: number, o: { n: number }) => calls.push({ y, n: o.n }) };
    for (const part of ['deck', 'shoes', 'trucks', 'wheels'] as const) {
      Particles.prototype.gearWear.call(fake as unknown as Particles, part, false, 0, 1);
      Particles.prototype.gearWear.call(fake as unknown as Particles, part, true, 0, 1);
    }
    expect(calls).toHaveLength(8);
    for (let i = 0; i < 8; i += 2) expect(calls[i + 1].n).toBeGreaterThan(calls[i].n);
    expect(calls[2].y).toBeGreaterThan(calls[0].y); // shoes scuff higher than the deck
  });
});

describe('landing by impact', () => {
  it('a kiss puffs, heavy bursts and kicks, capped', () => {
    expect(landDust(1)).toBeCloseTo(0.35);
    expect(landDust(FEEL.soft)).toBeLessThan(landDust(FEEL.heavy));
    expect(landDust(30)).toBe(1.5);
    expect(landKick(FEEL.soft)).toBe(0);
    expect(landKick(FEEL.heavy)).toBeGreaterThan(0);
    expect(landKick(FEEL.huge)).toBeGreaterThan(landKick(FEEL.heavy));
    expect(landKick(40)).toBe(0.2);
  });
});

describe('roadblock sirens', () => {
  it('swap red and blue smoothly, and hold steady with reduced flashing', () => {
    const [r0, b0] = SirenFx.mix(0, false);
    expect(r0 + b0).toBeCloseTo(1);
    const [r1] = SirenFx.mix(0.25 / SIREN.sweep, false);
    expect(r1).toBeCloseTo(1);
    expect(SirenFx.mix(0.123, true)).toEqual([SIREN.steady, SIREN.steady]);
  });
  it('light the street under each parked cruiser in two draws', () => {
    const kit = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const car = new THREE.Group();
      car.userData.sirens = [{ x: i * 4 - 1, y: 0, z: -0.3, color: 'red' }, { x: i * 4 + 1, y: 0, z: 0.3, color: 'blue' }];
      kit.add(car);
    }
    const fx = new SirenFx();
    fx.build(kit);
    expect(fx.group.children).toHaveLength(2);
    expect((fx.group.children[0] as THREE.InstancedMesh).count).toBe(3);
    fx.build(new THREE.Group());
    expect(fx.group.children).toHaveLength(0);
  });
});

describe('filmers\' phones', () => {
  it('flash briefly after a photo, and never with reduced flashing', () => {
    expect(flashAt(0, false)).toBe(1);
    expect(flashAt(PHONE.flashSecs / 2, false)).toBeCloseTo(0.5);
    expect(flashAt(PHONE.flashSecs, false)).toBe(0);
    expect(flashAt(-0.05, false)).toBe(0); // the photo is still a beat away
    expect(flashAt(Infinity, false)).toBe(0);
    expect(flashAt(0, true)).toBe(0);
  });
  it('glow every phone held up and flash only the fresh ones, in two draws', () => {
    const fx = new PhoneFx();
    const [glow, flash] = fx.group.children as THREE.InstancedMesh[];
    fx.update([
      { x: 0, y: 1, z: 0, since: Infinity },
      { x: 2, y: 1, z: 0, since: 0.02 },
      { x: 4, y: 1, z: 0, since: 3 },
    ]);
    expect(fx.group.children).toHaveLength(2);
    expect(glow.count).toBe(3);
    expect(flash.count).toBe(1);
    const was = FX.reduceFlashing;
    FX.reduceFlashing = true;
    fx.update([{ x: 2, y: 1, z: 0, since: 0.02 }]);
    FX.reduceFlashing = was;
    expect(flash.count).toBe(0);
    fx.update([]);
    expect(glow.count).toBe(0);
  });
  it('glow brighter at night', () => {
    const fx = new PhoneFx();
    const mat = (fx.group.children[0] as THREE.InstancedMesh).material as THREE.ShaderMaterial;
    fx.update([]);
    const day = mat.uniforms.uAmt.value;
    fx.setNight(1);
    fx.update([]);
    expect(mat.uniforms.uAmt.value).toBeGreaterThan(day * 2);
  });
});

describe('bounty gate', () => {
  const kit = () => {
    const k = new THREE.Group();
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.2), new THREE.MeshBasicMaterial({ color: 0x40ffd0 }));
    arch.userData.gate = true;
    k.add(arch);
    return k;
  };
  it('turns the portal over smoothly once the bounty is claimable, and back when Heat drops', () => {
    const fx = new GateFx();
    fx.build(kit());
    const mat = (fx.group.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
    fx.update(0.1, 0);
    expect(mat.uniforms.uBounty.value).toBe(0);
    fx.setBounty(true);
    fx.update(0.1, 0);
    expect(mat.uniforms.uBounty.value).toBeCloseTo(0.1 * GATE_FX.bountyEase);
    for (let i = 0; i < 20; i++) fx.update(0.1, 0);
    expect(mat.uniforms.uBounty.value).toBe(1);
    fx.setBounty(false);
    fx.update(0.1, 0);
    expect(mat.uniforms.uBounty.value).toBeLessThan(1);
  });
  it('starts each floor unclaimed', () => {
    const fx = new GateFx();
    fx.setBounty(true);
    for (let i = 0; i < 20; i++) fx.update(0.1, 0);
    fx.build(kit());
    expect(fx.bounty).toBe(0);
  });
});

describe('rail steel', () => {
  it('reflects a bright sky above a dark street, in a few hard bands', () => {
    const up = chrome(0, 0.6, 0.8); // faces up and toward the camera: sees the sky
    const down = chrome(0, -0.6, 0.8); // faces down: sees the street
    expect(up[2]).toBeGreaterThan(down[2] + 0.3);
    const levels = new Set<number>();
    for (let y = -1; y <= 1; y += 0.05) for (let x = -1; x <= 1; x += 0.05) {
      const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
      levels.add(chrome(x, y, z)[0]);
    }
    expect(levels.size).toBeLessThanOrEqual(7); // stepped like the toon shading, not a smooth gradient
  });
  it('has a polished flat along the top where boards grind', () => {
    const W = 64, H = 16;
    const h = railHeights(W, H);
    const mid = Math.floor(H / 2);
    for (let x = 0; x < W; x++) expect(h[mid * W + x]).toBe(h[mid * W]);
  });
  it('repeats the normal map along the rail instead of stretching it', () => {
    const geo = railUv(new THREE.BoxGeometry(4, 0.1, 0.1), 4);
    const uv = geo.getAttribute('uv');
    let max = 0;
    for (let i = 8; i < uv.count; i++) max = Math.max(max, uv.getX(i));
    expect(max).toBeCloseTo(4 / RAIL_METAL.repeat);
    for (let i = 0; i < 8; i++) expect(uv.getX(i)).toBeLessThanOrEqual(1); // the end caps are left alone
  });
  it('dims toward the night tint with the neon', () => {
    expect(railTint(0).getHex()).toBe(0xffffff);
    expect(railTint(1).getHex()).toBe(RAIL_METAL.night);
  });
});

describe('cruiser jump jets', () => {
  it('fold out fast when it leaves the bank, fire hardest going up, and fold away after it lands', () => {
    let s = jetState(0, 0.5, 3, JETS.deploy / 2);
    expect(s.out).toBeCloseTo(0.5);
    s = jetState(s.out, 1, 3, JETS.deploy);
    expect(s.out).toBe(1);
    expect(s.thrust).toBe(JETS.lift);
    expect(jetState(1, 1, -3, 0.016).thrust).toBe(1);
    const down = jetState(1, 0, -3, 0.1);
    expect(down.thrust).toBe(0);
    expect(down.out).toBeGreaterThan(0); // still folding away
    expect(jetState(down.out, 0, 0, JETS.stow).out).toBe(0);
    expect(jetState(0, 0, 0, 1)).toEqual({ out: 0, thrust: 0 }); // stays stowed on the street
  });
  it('are hidden on the street and shown in the air, and spot the touchdown', () => {
    const jets = new CruiserJets();
    jets.update(0, 0.016);
    expect(jets.group.children.every((c) => !c.visible)).toBe(true);
    jets.update(0.5, 0.2);
    expect(jets.group.children.every((c) => c.visible)).toBe(true);
    expect(jets.thrust).toBeGreaterThan(0);
    jets.update(0, 0.016);
    expect(jets.landed).toBe(true);
    jets.update(0, 0.016);
    expect(jets.landed).toBe(false);
    jets.reset();
    expect(jets.out).toBe(0);
  });
});

describe('smash debris from the prop itself', () => {
  // a two-coloured box standing on the ground: red below, white on top
  const prop = () => {
    const g = new THREE.BoxGeometry(0.6, 1, 0.6, 2, 2, 2).toNonIndexed().translate(0, 0.5, 0);
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) col.set(pos.getY(i) > 0.5 ? [1, 1, 1] : [0.8, 0.05, 0.05], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  it('cuts the model into chunks that keep its colours and add back up to it', () => {
    const g = prop();
    const pieces = shatter(g);
    expect(pieces.length).toBeGreaterThan(4);
    const tris = pieces.reduce((n, p) => n + p.geometry.getAttribute('position').count, 0);
    expect(tris).toBe(g.getAttribute('position').count);
    expect(pieces.every((p) => p.geometry.getAttribute('color'))).toBe(true);
    expect(pieces.some((p) => p.offset.y > 0.5) && pieces.some((p) => p.offset.y < 0.5)).toBe(true); // high and low
  });
  it('throws chips in the prop\'s own colours', () => {
    const cols = palette(prop());
    expect(cols).toHaveLength(2);
    expect(cols.some(([r, g]) => r > 0.8 && g < 0.4)).toBe(true); // the red
  });
  it('breaks a prop with no pieces of its own into its model, and hides it', () => {
    const hidden: number[] = [];
    const fx = new SmashFx(new Particles(), { word: () => {}, shake: () => {}, hide: (i) => hidden.push(i), pieces: () => [], geometry: () => prop() });
    fx.smash({ prop: 'NewsBoxRed', index: 3, x: 0, y: 0, how: 'roll', speed: 1 });
    expect(hidden).toEqual([3]);
    expect(fx.group.children.length).toBeGreaterThan(4);
    expect(fx.group.children.every((m) => ((m as THREE.Mesh).material as THREE.MeshToonMaterial).vertexColors)).toBe(true);
  });
});

describe('ink through the fisheye', () => {
  const [k, tx, ty] = [0.75, 2.11, 0.976]; // a landscape phone at the game's lens
  it('is untouched with the lens off', () => {
    expect(inkLens(0, tx, ty, 0.5, 0.5, 0.6, 0.8)).toEqual([0.6, 0.8]);
  });
  it('pre-bends each push by exactly the inverse of the lens, so it lands the same width on screen', () => {
    for (const [sx, sy] of [[0, 0], [0.3, 0.1], [0.8, -0.4], [-0.95, 0.9], [0.1, 0.95]]) {
      for (const ang of [0, 0.7, 1.6, 2.5]) {
        const [dx, dy] = [Math.cos(ang), Math.sin(ang)]; // a unit push on screen, in the picture's square units
        const [qx, qy] = lensSource(k, tx, ty, sx, sy);
        const e = 1e-4;
        const [px, py] = lensSource(k, tx, ty, sx + (e * dx) / tx, sy + (e * dy) / ty);
        const want = [(px - qx) / e, (py - qy) / e]; // the flat picture's move for that screen move
        const got = inkLens(k, tx, ty, qx / tx, qy / ty, dx, dy);
        expect(got[0]).toBeCloseTo(want[0], 2);
        expect(got[1]).toBeCloseTo(want[1], 2);
      }
    }
  });
  it('thins the ink in the swollen middle and thickens it at the squeezed edges', () => {
    const mid = Math.hypot(...inkLens(k, tx, ty, 0, 0, 1, 0));
    expect(mid).toBeLessThan(0.8);
    const edge = inkLens(k, tx, ty, 0.95, 0, 1, 0)[0];
    expect(edge).toBeGreaterThan(1);
  });
});

describe('escape set pieces', () => {
  const log: { key: string; rate: number }[] = [];
  const fake = { stream: (key: string, _x: number, _y: number, rate: number) => log.push({ key, rate }), spray: () => log.push({ key: 'spray', rate: 0 }) } as unknown as Particles;
  const fx = new EscapeFx(fake);
  it('the rotor wash blows harder when the light has you, and not under the L tracks', () => {
    log.length = 0;
    fx.chopper(0, 0, false, false, 1 / 60);
    const calm = log.filter((c) => c.key === 'washL')[0].rate;
    log.length = 0;
    fx.chopper(0, 0, true, false, 1 / 60);
    expect(log.filter((c) => c.key === 'washL')[0].rate).toBe(calm * 2);
    log.length = 0;
    fx.chopper(0, 0, true, true, 1 / 60);
    expect(log).toHaveLength(0);
  });
  it('each chaser throws its own spray, more when it surges', () => {
    const keys = (look: 'wave' | 'chariot' | 'guards', surging = false) => {
      log.length = 0;
      fx.chaser(look, 0, 0, surging, 1 / 60);
      return log.map((c) => c.key);
    };
    expect(keys('wave')).toEqual(['foam', 'mist']);
    expect(keys('chariot')).toEqual(['hooves', 'wheel']);
    expect(keys('guards')).toEqual(['boots']);
    fx.chaser('guards', 0, 0, false, 1 / 60);
    const slow = log[log.length - 1].rate;
    log.length = 0;
    fx.chaser('guards', 0, 0, true, 1 / 60);
    expect(log[0].rate).toBeGreaterThan(slow);
  });
});

describe('flip lines setting', () => {
  const base = { quality: 'auto', reduceMotion: false, reduceFlashing: false, heatCue: false, pixel: 1, ghost: 'pink', flipLines: 'ink' } as const;
  it('picks a look from the URL and ignores unknown ones', () => {
    expect(applyParams({ ...base }, new URLSearchParams('fliplines=swoosh')).flipLines).toBe('swoosh');
    expect(applyParams({ ...base }, new URLSearchParams('fliplines=pixels')).flipLines).toBe('pixels');
    expect(applyParams({ ...base }, new URLSearchParams('fliplines=nope')).flipLines).toBe('ink');
  });
});

describe('slides shred paint', () => {
  it('a boardslide is a slide, a 50-50 is not', () => {
    expect(SLIDES.has('grind2')).toBe(true);
    expect(SLIDES.has('fsBoardslide')).toBe(true);
    expect(SLIDES.has('grind1')).toBe(false);
    expect(SLIDES.has('smith')).toBe(false);
  });
  it('peels flakes of the deck\'s paint off behind, under the skater', () => {
    const p = new Particles();
    const red = [0.78, 0.19, 0.17];
    p.slideStart(0, 1, 1, [red]);
    const pool = (p as unknown as { pool: { life: Float32Array; r: Float32Array; vx: Float32Array } }).pool;
    const live = [...pool.life.keys()].filter((i) => pool.life[i] > 0);
    expect(live.length).toBeGreaterThan(10);
    const flakes = live.filter((i) => Math.abs(pool.r[i] - red[0]) < 1e-6);
    expect(flakes.length).toBeGreaterThan(live.length / 2);
    expect(flakes.every((i) => pool.vx[i] < 0)).toBe(true);
    const layer = p.points.geometry.getAttribute('aLayer');
    expect(live.every((i) => layer.getX(i) === 1)).toBe(true);
  });
});
