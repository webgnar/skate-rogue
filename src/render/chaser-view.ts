// Act 3's chaser (src/sim/chaser.ts): a pack of guards (chaserLook; a tidal wave and a chariot and horses are
// built too). The Blender models (art/chasers.py), or primitives if they fail to load,
// inked like the rest; it eases toward the sim's position so a slam reads as it surging forward, and it bobs as it
// runs. Hidden on any other floor.
import * as THREE from 'three';
import { at } from '../game/interp';
import type { Chaser } from '../sim/chaser';
import type { Level } from '../physics/level';
import { toX, toY } from './kit';
import { model } from './models';
import { inkify } from './toon';

export type ChaserLook = 'wave' | 'chariot' | 'guards';

// one world, one chaser (zack, Oct 24 2026: no separate biomes): the guards, the city's own security after you.
// The wave and the chariot stay built for a later use (Endless, or a special floor).
export function chaserLook(): ChaserLook {
  return 'guards';
}

export const CHASER_CALLS: Record<ChaserLook, { start: string; caught: string }> = {
  wave: { start: 'THE WAVE IS COMING!', caught: 'WIPED OUT!' },
  chariot: { start: 'CHARIOT ON YOUR TAIL!', caught: 'TRAMPLED!' },
  guards: { start: 'GUARDS! RUN!', caught: 'COLLARED!' },
};

const lambert = (color: number, emissive = 0) => new THREE.MeshLambertMaterial({ color, emissive });

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// a wall of water curling over toward the skater, foam on its lip, spanning the street's depth
function makeWave(): THREE.Group {
  const g = new THREE.Group();
  const water = new THREE.MeshLambertMaterial({ color: 0x2a7fd0, emissive: 0x0a2a50, transparent: true, opacity: 0.88 });
  const deep = lambert(0x1a4f9a, 0x061830);
  const foam = lambert(0xeaf8ff, 0x406070);
  g.add(box(3.0, 3.6, 6, deep, -1.6, 1.8, -1));
  g.add(box(1.6, 3.2, 6, water, 0.2, 1.6, -1));
  //the curl: a lip leaning out over the street
  const lip = box(1.4, 0.7, 6, water, 0.9, 3.3, -1);
  lip.rotation.z = -0.35;
  g.add(lip);
  for (let i = 0; i < 7; i++) g.add(box(0.5, 0.35, 0.8, foam, 0.6 + (i % 2) * 0.4, 3.55 + (i % 3) * 0.12, -3.5 + i));
  g.add(box(0.5, 0.25, 6, foam, 1.0, 0.12, -1)); // the wash along the street
  return g;
}

// a gold chariot and two horses at full gallop, the driver whipping them on
function makeChariot(): THREE.Group {
  const g = new THREE.Group();
  const gold = lambert(0xd8a83a, 0x302008);
  const horse = lambert(0x6a4428);
  const dark = lambert(0x2a1a10);
  const red = lambert(0xc0302a);
  //the car: a bowl on two wheels
  g.add(box(1.2, 0.8, 1.0, gold, -1.4, 0.9));
  for (const z of [-0.6, 0.6]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12), dark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(-1.4, 0.5, z);
    wheel.name = 'wheel';
    g.add(wheel);
  }
  //the driver: red cloak, a helmet crest
  g.add(box(0.4, 0.9, 0.4, red, -1.5, 1.7));
  g.add(box(0.3, 0.3, 0.3, gold, -1.5, 2.3));
  g.add(box(0.1, 0.25, 0.32, red, -1.5, 2.55));
  //the horses, side by side, ahead of the car
  for (const z of [-0.35, 0.35]) {
    const h = new THREE.Group();
    h.add(box(1.3, 0.55, 0.4, horse, 0, 1.25));
    const neck = box(0.35, 0.7, 0.3, horse, 0.65, 1.6);
    neck.rotation.z = -0.5;
    h.add(neck, box(0.5, 0.25, 0.25, horse, 0.95, 1.95));
    for (const lx of [-0.45, 0.45]) {
      const leg = box(0.14, 0.95, 0.14, horse, lx, 0.5);
      leg.name = 'leg';
      h.add(leg);
    }
    h.position.set(0.3, 0, z);
    h.name = 'horse';
    g.add(h);
  }
  return g;
}

// three museum guards in navy with peaked caps, one holding a torch beam
function makeGuards(): THREE.Group {
  const g = new THREE.Group();
  const navy = lambert(0x1f2a48);
  const skin = lambert(0xd8a888);
  const cap = lambert(0x10162a);
  const badge = lambert(0xf0c040, 0x403010);
  [[0, 0.4], [-0.9, -0.5], [-1.7, 0.7]].forEach(([x, z], i) => {
    const guard = new THREE.Group();
    guard.add(box(0.5, 0.9, 0.35, navy, 0, 1.15));
    guard.add(box(0.12, 0.12, 0.05, badge, 0.12, 1.4, 0.18));
    guard.add(box(0.32, 0.32, 0.32, skin, 0, 1.8));
    guard.add(box(0.42, 0.12, 0.42, cap, 0.04, 2.0));
    for (const lx of [-0.12, 0.12]) {
      const leg = box(0.16, 0.7, 0.18, navy, lx, 0.35);
      leg.name = 'leg';
      guard.add(leg);
    }
    for (const sz of [-0.3, 0.3]) {
      const arm = new THREE.Group();
      arm.add(box(0.12, 0.6, 0.12, navy, 0, -0.3));
      arm.add(box(0.11, 0.11, 0.11, skin, 0, -0.65));
      if (i === 0 && sz > 0) arm.add(box(0.06, 0.28, 0.06, cap, 0, -0.78)); // the pistol
      arm.position.set(0, 1.5, sz);
      arm.name = i === 0 && sz > 0 ? 'gunArm' : 'arm';
      guard.add(arm);
    }
    if (i === 0) guard.add(torchBeam());
    guard.position.set(x, 0, z);
    guard.name = 'guard';
    g.add(guard);
  });
  return g;
}

// the guard in front's torch beam, shining ahead
function torchBeam(): THREE.Mesh {
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 2.2, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.25, depthWrite: false }),
  );
  beam.rotation.z = Math.PI / 2 + 0.25;
  beam.position.set(1.3, 1.1, 0);
  return beam;
}

// a model with its legs hung at the hips, named for the run cycle
function legged(body: string, leg: string, hips: [number, number, number][]): THREE.Group | null {
  const b = model(body);
  if (!b) return null;
  const g = new THREE.Group();
  g.add(b);
  for (const [x, y, z] of hips) {
    const l = model(leg);
    if (!l) return null;
    l.position.set(x, y, z);
    l.name = 'leg';
    g.add(l);
  }
  return g;
}

// the chaser from art/chasers.py: null if those models didn't load
function fromModels(look: ChaserLook): THREE.Group | null {
  const g = new THREE.Group();
  if (look === 'wave') {
    const w = model('Wave');
    if (!w) return null;
    g.add(w);
    return g;
  }
  if (look === 'chariot') {
    const car = model('Chariot');
    if (!car) return null;
    car.position.x = -1.4;
    g.add(car);
    for (const z of [-0.62, 0.62]) {
      const wheel = model('ChariotWheel');
      if (!wheel) return null;
      wheel.position.set(-1.4, 0.5, z);
      wheel.name = 'spin';
      g.add(wheel);
    }
    for (const z of [-0.35, 0.35]) {
      const h = legged('Horse', 'HorseLeg', [[0.5, 1.05, -0.1], [0.4, 1.05, 0.1], [-0.4, 1.08, -0.1], [-0.5, 1.08, 0.1]]);
      if (!h) return null;
      h.position.set(0.45, 0, z);
      h.name = 'horse';
      g.add(h);
    }
    return g;
  }
  for (const [i, [x, z]] of [[0, 0.4], [-0.9, -0.5], [-1.7, 0.7]].entries()) {
    const guard = legged('Guard', 'GuardLeg', [[0.1, 0.76, -0.1], [-0.1, 0.76, 0.1]]);
    if (!guard) return null;
    //arms hung at the shoulders; the front guard's camera-side one holds the pistol
    for (const z of [-SHOULDER.z, SHOULDER.z]) {
      const arm = model('GuardArm');
      if (!arm) return null;
      const gun = i === 0 && z > 0;
      if (gun) {
        const pistol = model('GuardPistol');
        if (!pistol) return null;
        arm.add(pistol);
      }
      const shoulder = new THREE.Group();
      shoulder.add(arm);
      shoulder.position.set(0, SHOULDER.y, z);
      shoulder.name = gun ? 'gunArm' : 'arm';
      guard.add(shoulder);
    }
    if (i === 0) guard.add(torchBeam());
    guard.position.set(x, 0, z);
    guard.name = 'guard';
    g.add(guard);
  }
  return g;
}

// the guards' shoulders (art/chasers.py), and the front guard's aim: the arm out level from the shoulder, dipped a
// little toward the skater, the pistol's muzzle 0.92 down the arm. Muzzle = shoulder + 0.92 * (cos dip, -sin dip):
// 0.9 ahead and 1.32 up, which is SHOTS.gun and SHOTS.gunY (src/sim/shots.ts) less the running bob.
const SHOULDER = { y: 1.5, z: 0.31 };
const AIM = { dip: 0.2, raise: 10, recoil: 0.55, settle: 8 };

export class ChaserView {
  readonly group = new THREE.Group();
  private body: THREE.Group | null = null;
  look: ChaserLook | null = null;
  x = 0; // where it's drawn, world units (eases after the sim)
  surging = false; // closing in faster than it settles
  private t = 0;
  private aim = 0; // 0 arm swinging, 1 aimed
  private kick = 0; // recoil, rad, easing out

  // a shot: the pistol kicks up
  fired(): void {
    this.kick = AIM.recoil;
  }

  // aiming: the front guard holds the pistol on you (the sim's shooter.aimT > 0)
  update(level: Level, chaser: Chaser | null, dt: number, aiming = false): void {
    this.group.visible = chaser !== null;
    if (!chaser) return;
    const look = chaserLook();
    if (look !== this.look) {
      if (this.body) this.group.remove(this.body);
      this.body = fromModels(look) ?? (look === 'wave' ? makeWave() : look === 'chariot' ? makeChariot() : makeGuards());
      inkify(this.body);
      this.group.add(this.body);
      this.look = look;
      this.x = toX(chaser.x);
    }
    this.t += dt;
    //surge after a slam, settle back as you get away
    const target = toX(at(chaser, 'x'));
    this.surging = target - this.x > 0.5;
    this.x += (target - this.x) * Math.min(1, dt * (target > this.x ? 6 : 2));
    this.group.position.set(this.x, toY(level, level.streetY), 0.2);
    const run = Math.sin(this.t * 14);
    //raised to aim, held through the shot's recoil, then back to pumping
    const up = aiming || this.kick > 0.05;
    this.aim += ((up ? 1 : 0) - this.aim) * Math.min(1, dt * AIM.raise);
    this.kick *= Math.max(0, 1 - dt * AIM.settle);
    this.body!.traverse((o) => {
      if (o.name === 'leg') o.rotation.z = run * 0.6 * (o.position.x > 0 ? 1 : -1);
      if (o.name === 'arm' || o.name === 'gunArm') {
        const swing = -run * 0.5 * (o.position.z > 0 ? 1 : -1); // opposite the leg on that side
        o.rotation.z = o.name === 'gunArm' ? swing + (Math.PI / 2 - AIM.dip - swing) * this.aim + this.kick : swing;
      }
      if (o.name === 'wheel') o.rotation.y += dt * 12;
      if (o.name === 'spin') o.rotation.z -= dt * 12; // the model's wheels turn about their axle, along z
      if (o.name === 'horse' || o.name === 'guard') o.position.y = Math.abs(run) * 0.12;
    });
    if (look === 'wave') this.body!.position.y = Math.sin(this.t * 3) * 0.08;
  }
}
