// What lives in the title scene's city (src/title/title-scene.ts): up top, pigeons wheeling past and trash riding the
// wind (plastic bags, newspaper, a soda cup); lower down, the AI's drones patrolling the towers with their red eyes
// and scan beams, the police chopper sweeping its spotlight and a cop cruiser hanging on its jump jets with its
// lights going; and down on the street, a stray dog trotting by, a cat on the shop signs, pigeons pecking at the curb,
// trash rolling along the gutter, a flag and a street tree in the wind, a homeless man sat against the store wall, a
// hitchhiker waving you down and a twitchy guy dancing on the sidewalk. The people dance to the title music's beat
// (GROOVE), like Webster.
import * as THREE from 'three';
import { makeRng, type Rng } from '../gen/rng';
import { makeDrone } from '../render/drone-view';
import { makeParkedCruiser } from '../render/kit';
import { model } from '../render/models';
import { CAT, DOG, type CatClip, type DogClip } from '../render/bot-model';
import { makePerson } from '../render/peds';
import { botPerson, type Who } from './bot-people';
import { pigeonRig, type PigeonRig } from '../render/pigeon';
import { inkify, toon } from '../render/toon';
import { glowTexture, STORE } from './city';
import { FACADE } from './facade';

export interface Life {
  group: THREE.Group;
  update(t: number, dt: number): void;
}

// the title music's beat (zack's PRESS START runs about 105 bpm): seconds a beat, and the clock the dancers keep,
// which the scene sets from when the music started
export const BEAT = 60 / 105;
export const GROOVE = { t: 0 };
// how far into the beat, 0 on it to 1 just before the next, and the bounce: 1 on the beat, easing off
const beatPhase = () => (GROOVE.t / BEAT) % 1;
const bounce = () => Math.pow(1 - beatPhase(), 3);
const beats = () => GROOVE.t / BEAT;

// the wind down the street: a steady breeze that gusts every few seconds
export function gust(t: number): number {
  return 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(t * 0.45)), 2) + 0.12 * Math.sin(t * 2.3);
}

// the street's loop: everyone down there runs one minute-long routine, so it plays out like a scene (zack: "make
// the whole scene a longer loop") rather than everyone on their own short cycle
export const SCENE = 60;

// a value along a timeline: [time, value] keys, eased between (smoothstep), held before the first and after the last
function track(p: number, keys: [number, number][]): number {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (p <= t1) {
      const [t0, v0] = keys[i - 1];
      const u = (p - t0) / Math.max(1e-6, t1 - t0);
      return v0 + (v1 - v0) * u;
    }
  }
  return keys[keys.length - 1][1];
}
// which of a list of [start, name] steps a moment falls in
function step<T extends string>(p: number, steps: [number, T][]): T {
  let cur = steps[0][1];
  for (const [t0, name] of steps) if (p >= t0) cur = name;
  return cur;
}

// a flock of pigeons on a loop round the sky: the blender bot's pigeon (src/render/pigeon.ts) flying, or the
// code-built birds when the model didn't load
function flock(rng: Rng, center: THREE.Vector3, radius: number, n: number, speed: number): Life {
  return modelFlock(rng, center, radius, n, speed) ?? codeFlock(rng, center, radius, n, speed);
}

// the blender bot's pigeons on their fly clip, each a beat out from the next (zack 2026-11-06: "replace the pigeons
// flying in the splash screen with the new ones"). Null when the model didn't load
function modelFlock(rng: Rng, center: THREE.Vector3, radius: number, n: number, speed: number): Life | null {
  const group = new THREE.Group();
  const birds: { rig: PigeonRig; off: THREE.Vector3; phase: number }[] = [];
  for (let i = 0; i < n; i++) {
    const rig = pigeonRig();
    if (!rig) return null;
    //no ink: from this far off a fixed-width outline swallows the bird and it reads as a black blot
    rig.root.scale.setScalar(4.4); // the code-built flock's size
    rig.root.rotation.order = 'YZX'; // turned to its heading, then pitched nose down along it
    rig.play('fly', 0, 0.9 + rng() * 0.25);
    const phase = rng() * 6;
    rig.update(phase); // out of step with the others
    group.add(rig.root);
    birds.push({ rig, off: new THREE.Vector3((rng() - 0.5) * 14, (rng() - 0.5) * 5, (rng() - 0.5) * 12), phase });
  }
  return {
    group,
    update(t: number, dt: number): void {
      const a = t * speed;
      for (const b of birds) {
        const x = center.x + Math.cos(a) * radius + b.off.x;
        const z = center.z + Math.sin(a) * radius * 0.5 + b.off.z;
        const y = center.y + b.off.y + Math.sin(t * 1.3 + b.phase) * 1.5;
        b.rig.root.position.set(x, y, z);
        //the model stands upright: in the air it leans forward into its flight, and rolls a little in the turn
        b.rig.root.rotation.set(-0.2 * Math.sign(speed) + Math.sin(t * 0.9 + b.phase) * 0.1, -a - (Math.PI / 2) * Math.sign(speed), -0.7);
        b.rig.update(dt);
      }
    },
  };
}

// the code-built flock: each bird a body and two flapping wings
function codeFlock(rng: Rng, center: THREE.Vector3, radius: number, n: number, speed: number): Life {
  const group = new THREE.Group();
  const feather = toon({ color: 0x6a6478, side: THREE.DoubleSide });
  const pale = toon({ color: 0xc8c0d0 });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0.2, 0, 0, -0.3, 0, 0, -0.1, 0, 0.9], 3));
  wingGeo.computeVertexNormals();
  const birds: { g: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; off: THREE.Vector3; phase: number }[] = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6).scale(1.6, 0.8, 0.8), pale);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), feather);
    head.position.set(0.42, 0.12, 0);
    const l = new THREE.Mesh(wingGeo, feather);
    const r = new THREE.Mesh(wingGeo, feather);
    r.scale.z = -1;
    g.add(body, head, l, r);
    g.scale.setScalar(2.2);
    group.add(g);
    birds.push({ g, l, r, off: new THREE.Vector3((rng() - 0.5) * 14, (rng() - 0.5) * 5, (rng() - 0.5) * 12), phase: rng() * 6 });
  }
  inkify(group);
  return {
    group,
    update(t: number): void {
      const a = t * speed;
      for (const b of birds) {
        const x = center.x + Math.cos(a) * radius + b.off.x;
        const z = center.z + Math.sin(a) * radius * 0.5 + b.off.z;
        const y = center.y + b.off.y + Math.sin(t * 1.3 + b.phase) * 1.5;
        b.g.position.set(x, y, z);
        b.g.rotation.y = -a - Math.PI / 2 * Math.sign(speed);
        const flap = Math.sin(t * 13 + b.phase) * 0.8;
        b.l.rotation.x = flap;
        b.r.rotation.x = -flap;
      }
    },
  };
}

// a crumpled card of trash: a plastic bag, a page of newspaper
function trashTexture(kind: 'bag' | 'paper', rng: Rng): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  if (kind === 'bag') {
    g.fillStyle = rng() < 0.5 ? 'rgba(250,250,255,0.85)' : 'rgba(255,240,170,0.85)';
    g.beginPath();
    g.moveTo(10, 8);
    g.lineTo(22, 20);
    g.lineTo(42, 20);
    g.lineTo(54, 8);
    g.lineTo(58, 56);
    g.lineTo(6, 58);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(12 + rng() * 40, 26 + rng() * 10);
      g.lineTo(12 + rng() * 40, 40 + rng() * 14);
      g.stroke();
    }
  } else {
    g.fillStyle = '#e8e2d0';
    g.fillRect(4, 8, 56, 48);
    g.fillStyle = '#4a4650';
    g.fillRect(8, 12, 48, 7);
    for (let y = 24; y < 52; y += 4) g.fillRect(8 + (y % 8), y, 20 + (y % 12), 2);
    for (let y = 24; y < 52; y += 4) g.fillRect(34, y, 18, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// trash on the wind: bags and pages tumbling slowly across the camera's way down, drifting up as they go
function trash(rng: Rng, around: THREE.Vector3[], n: number): Life {
  const group = new THREE.Group();
  const mats = [trashTexture('bag', rng), trashTexture('bag', rng), trashTexture('paper', rng)].map(
    (map) => new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: true }),
  );
  const bits: { m: THREE.Object3D; base: THREE.Vector3; v: THREE.Vector3; spin: THREE.Vector3; ph: number }[] = [];
  for (let i = 0; i < n; i++) {
    const at = around[i % around.length];
    let m: THREE.Object3D;
    const cup = i % 5 === 4 ? model('SodaCup') : null;
    if (cup) {
      cup.scale.setScalar(2);
      inkify(cup);
      m = cup;
    } else {
      m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2, 2, 2), mats[i % mats.length]);
      //crumple it a little: push the middle vertex out
      const pos = (m as THREE.Mesh).geometry.getAttribute('position');
      for (let k = 0; k < pos.count; k++) pos.setZ(k, (rng() - 0.5) * 0.7);
    }
    const base = at.clone().add(new THREE.Vector3((rng() - 0.5) * 30, (rng() - 0.5) * 20, (rng() - 0.5) * 16));
    m.position.copy(base);
    group.add(m);
    bits.push({ m, base, v: new THREE.Vector3(2 + rng() * 3, 0.4 + rng() * 0.8, (rng() - 0.5) * 1.5), spin: new THREE.Vector3(rng() * 2, rng() * 2, rng() * 2), ph: rng() * 6 });
  }
  return {
    group,
    update(t: number): void {
      for (const b of bits) {
        //on a slow loop along the wind, so the sky never runs out of it
        const along = ((t * b.v.x + b.ph * 10) % 60) - 30;
        b.m.position.set(b.base.x + along, b.base.y + Math.sin(t * 0.7 + b.ph) * 3 + b.v.y * Math.sin(t * 0.2), b.base.z + Math.sin(t * 0.5 + b.ph) * 2);
        b.m.rotation.set(t * b.spin.x, t * b.spin.y, t * b.spin.z);
      }
    },
  };
}

// the AI's drones: patrolling in front of the towers on slow figure eights, rotors spinning, a red eye glowing and a
// red scan beam sweeping down the glass
function drones(rng: Rng, spots: THREE.Vector3[]): Life {
  const group = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3040, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const eyeMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff3040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const all: { g: THREE.Group; rotors: THREE.Mesh[]; beam: THREE.Mesh; home: THREE.Vector3; ph: number }[] = [];
  for (const home of spots) {
    const d = makeDrone();
    const g = new THREE.Group();
    d.group.scale.setScalar(4.5);
    d.group.rotation.y = Math.PI / 2; // the Blender drone faces -x: turn its eye to the camera
    g.add(d.group);
    const eye = new THREE.Sprite(eyeMat);
    eye.scale.set(3, 3, 1);
    eye.position.set(0, 0, 1.4);
    g.add(eye);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(5, 26, 16, 1, true).translate(0, -13, 0), beamMat);
    g.add(beam);
    group.add(g);
    all.push({ g, rotors: d.rotors, beam, home, ph: rng() * 6 });
  }
  return {
    group,
    update(t: number, dt: number): void {
      for (const d of all) {
        const a = t * 0.45 + d.ph;
        d.g.position.set(d.home.x + Math.sin(a) * 9, d.home.y + Math.sin(a * 2) * 2, d.home.z + Math.cos(a) * 3);
        d.g.rotation.z = -Math.cos(a) * 0.15; // banking into the turns
        d.beam.rotation.x = Math.sin(t * 0.9 + d.ph) * 0.5;
        d.beam.rotation.z = Math.cos(t * 0.6 + d.ph) * 0.3;
        for (const [j, r] of d.rotors.entries()) r.rotation.y += (j % 3 === 0 ? 1 : -1) * dt * 60;
      }
    },
  };
}

// the police chopper: a wide circle over the street, its spotlight sweeping the buildings
function chopper(center: THREE.Vector3): Life {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const rotors: THREE.Mesh[] = [];
  const hull = model('Chopper');
  if (hull) {
    body.add(hull);
    for (const name of ['ChopperRotor', 'ChopperTail']) {
      const r = model(name);
      if (r) {
        body.add(r);
        rotors.push(r);
      }
    }
  } else {
    body.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8).scale(1.5, 0.75, 0.8), new THREE.MeshLambertMaterial({ color: 0x1d1f28 })));
  }
  inkify(body);
  body.scale.setScalar(3);
  const light = new THREE.Mesh(
    new THREE.ConeGeometry(9, 70, 20, 1, true).translate(0, -35, 0),
    new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
  );
  const holder = new THREE.Group();
  holder.add(body, light);
  group.add(holder);
  return {
    group,
    update(t: number, dt: number): void {
      const a = t * 0.18;
      holder.position.set(center.x + Math.cos(a) * 45, center.y + Math.sin(t * 0.5) * 2, center.z + Math.sin(a) * 25);
      body.rotation.y = -a - Math.PI / 2;
      body.rotation.z = 0.12;
      light.rotation.x = 0.35 + Math.sin(t * 0.7) * 0.25;
      light.rotation.z = Math.sin(t * 0.45) * 0.4;
      const [main, tail] = rotors;
      if (main) main.rotation.y += dt * 9;
      if (tail) tail.rotation.z += dt * 21;
    },
  };
}

// a cop cruiser hanging in the air on its jump jets, lights going, drifting along the street
function cruiser(at: THREE.Vector3): Life {
  const group = new THREE.Group();
  const car = makeParkedCruiser(-1.6, 1.6, 0, 1.3, 0);
  inkify(car);
  car.scale.setScalar(1.6);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  const core = new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const flames: THREE.Mesh[] = [];
  for (const x of [-1.2, 1.2]) {
    for (const z of [-0.9, 0.9]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 10).rotateX(Math.PI).translate(0, -0.6, 0), flameMat);
      f.position.set(x * 0.8, 0.15, z * 0.6);
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 8).rotateX(Math.PI).translate(0, -0.3, 0), core);
      f.add(c);
      flames.push(f);
      car.add(f);
    }
  }
  //the light bar: a red and a blue glow taking turns
  const red = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const blue = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x2a6bff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (const [s, z] of [[red, -0.4], [blue, 0.4]] as const) {
    s.scale.set(2.2, 2.2, 1);
    s.position.set(0, 1.45, z);
    car.add(s);
  }
  group.add(car);
  return {
    group,
    update(t: number): void {
      car.position.set(at.x + Math.sin(t * 0.25) * 12, at.y + Math.sin(t * 1.7) * 0.6, at.z);
      car.rotation.z = Math.cos(t * 0.25) * 0.08;
      car.rotation.x = Math.sin(t * 1.1) * 0.03;
      for (const [i, f] of flames.entries()) f.scale.y = 0.8 + Math.abs(Math.sin(t * 23 + i * 1.7)) * 0.35;
      const on = Math.floor(t * 4) % 2 === 0;
      red.visible = on;
      blue.visible = !on;
    },
  };
}

// A stray dog (zack: a second pass): a scruffy tan mutt with a white chest and muzzle, floppy ears, a red collar with
// a tag, jointed legs and a wagging tail. Its minute: it trots in from the left to the homeless man and sits by him
// to be petted, trots along behind Webster to the trash can and sniffs it over, sits to scratch an ear with a back
// leg, trots off right, and later comes running back the other way along the curb
export const DOG_PET = { x: -9.4, z: -0.9 }; // where it sits by the homeless man (people() reaches out to it)
// where the dog is on the street's minute, and what it's doing: in from the left to the homeless man, along behind
// Webster to the trash can, off to the right, and later running back the other way along the curb
function dogRoute(p: number) {
  const x = track(p, [[0, -24], [7, DOG_PET.x], [15, DOG_PET.x], [21, 2.6], [30, 2.6], [37, 24], [44, 24], [52, -24]]);
  const z = track(p, [[0, 0.4], [7, DOG_PET.z], [15, DOG_PET.z], [17, -1.2], [21, -1.0], [30, -1.0], [33, -0.6], [44, 1.4]]);
  const what = step(p, [[0, 'trot'], [7, 'sit'], [15, 'trot'], [21, 'sniff'], [26, 'scratch'], [30, 'trot'], [37, 'gone'], [44, 'run'], [52, 'gone']] as const);
  return { x, z, what };
}

// the stray: the blender bot's dog (src/render/bot-model.ts) when it loaded, else the code-built one
function dog(): Life {
  return modelDog() ?? codeDog();
}

// the blender bot's dog, rigged: the same minute as the code-built dog, each thing it does a clip
function modelDog(): Life | null {
  const rig = DOG.rig<DogClip>();
  if (!rig) return null;
  const group = new THREE.Group();
  inkify(rig.root);
  group.add(rig.root);
  let face = 0;
  return {
    group,
    update(t: number, dt: number): void {
      const { x, z, what } = dogRoute(t % SCENE);
      rig.root.visible = what !== 'gone';
      rig.root.position.set(x, 0, z);
      const want = what === 'run' ? Math.PI : what === 'sit' ? -0.6 : 0;
      face += (want - face) * Math.min(1, dt * 6);
      rig.root.rotation.y = face;
      //the clips at the pace the route moves it: trotting about 2 a second, running about 7
      if (what === 'trot') rig.play('walk', 0.25, 1.6);
      else if (what === 'run') rig.play('run', 0.2, 1.5);
      //the model shakes itself off where the code-built dog scratched (a lifted back leg folds its hip through itself)
      else if (what === 'scratch') rig.play('shake', 0.25);
      else if (what !== 'gone') rig.play(what, 0.35);
      rig.update(dt);
    },
  };
}

// the code-built dog: blobs, a jointed tail and legs, posed in code
function codeDog(): Life {
  const group = new THREE.Group();
  const fur = toon({ color: 0xa87a48 });
  const dark = toon({ color: 0x5a3a24 });
  const white = toon({ color: 0xf0e8dc });
  const black = toon({ color: 0x141218 });
  const red = toon({ color: 0xc8303a });
  const gold = toon({ color: 0xe8c050 });
  const blob = (r: number, sx: number, sy: number, sz: number, m: THREE.Material) => new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9).scale(sx, sy, sz), m);
  const d = new THREE.Group(); // stands on the ground, faces +x
  const body = new THREE.Group(); // at the hips: sitting tips it up
  body.position.set(-0.42, 0.86, 0);
  d.add(body);
  const chest = blob(0.32, 1.1, 1.0, 0.85, fur);
  chest.position.set(0.72, 0.04, 0);
  const belly = blob(0.3, 1.5, 0.85, 0.78, fur);
  belly.position.set(0.36, 0, 0);
  const rump = blob(0.29, 1.05, 0.95, 0.85, fur);
  const patch = blob(0.2, 1.4, 0.5, 0.9, dark); // the dark saddle over its back
  patch.position.set(0.3, 0.17, 0);
  const bib = blob(0.2, 0.8, 1.1, 0.8, white);
  bib.position.set(0.95, -0.05, 0);
  body.add(chest, belly, rump, patch, bib);
  //the head on its neck, with the collar round it
  const neck = new THREE.Group();
  neck.position.set(0.95, 0.2, 0);
  body.add(neck);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 14).rotateY(Math.PI / 2), red);
  collar.position.set(0.04, 0.06, 0);
  const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 8).rotateX(Math.PI / 2), gold);
  tag.position.set(0.12, -0.12, 0);
  neck.add(collar, tag);
  const head = new THREE.Group();
  head.position.set(0.16, 0.28, 0);
  neck.add(head);
  const skull = blob(0.22, 1.05, 0.95, 0.95, fur);
  const snout = blob(0.13, 1.5, 0.8, 0.9, white);
  snout.position.set(0.25, -0.07, 0);
  const nose = blob(0.05, 1, 0.8, 1, black);
  nose.position.set(0.44, -0.03, 0);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.14), dark);
  jaw.position.set(0.25, -0.17, 0);
  head.add(skull, snout, nose, jaw);
  for (const side of [1, -1]) {
    const eye = blob(0.035, 1, 1, 1, black);
    eye.position.set(0.17, 0.07, side * 0.12);
    head.add(eye);
  }
  //floppy ears, hinged at the top of the head, swinging with its steps
  const ears: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const ear = new THREE.Group();
    ear.position.set(-0.03, 0.15, side * 0.17);
    ear.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.05).translate(0, -0.14, 0), dark));
    ear.rotation.x = side * 0.25;
    head.add(ear);
    ears.push(ear);
  }
  //the tail: three pieces off the rump, up and wagging
  const tail: THREE.Group[] = [];
  let parent: THREE.Object3D = body;
  for (let k = 0; k < 3; k++) {
    const seg = new THREE.Group();
    seg.position.set(k === 0 ? -0.26 : 0, k === 0 ? 0.12 : 0.2, 0);
    seg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04 - k * 0.008, 0.055 - k * 0.008, 0.22, 6).translate(0, 0.1, 0), k === 2 ? white : fur));
    parent.add(seg);
    parent = seg;
    tail.push(seg);
  }
  //the legs: a thigh and a shin with a white paw, hinged at the hip and the knee
  const legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
  for (const [x, z] of [[0.78, 0.16], [0.78, -0.16], [0.02, 0.17], [0.02, -0.17]]) {
    const hip = new THREE.Group();
    hip.position.set(x, -0.1, z);
    hip.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.4, 7).translate(0, -0.2, 0), fur));
    const knee = new THREE.Group();
    knee.position.y = -0.38;
    knee.add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.36, 7).translate(0, -0.18, 0), fur));
    const paw = blob(0.07, 1.4, 0.6, 1, white);
    paw.position.set(0.04, -0.37, 0);
    knee.add(paw);
    hip.add(knee);
    body.add(hip);
    legs.push({ hip, knee });
  }
  inkify(d);
  d.scale.setScalar(1.05);
  group.add(d);
  let sit = 0;
  let face = 0; // the way it faces, eased: 0 right (+x), PI left
  return {
    group,
    update(t: number, dt: number): void {
      const p = t % SCENE;
      //where it is: in from the left to the homeless man, along behind Webster to the trash can, off to the right,
      //and later running back the other way along the curb
      const { x, z, what } = dogRoute(p);
      d.visible = what !== 'gone';
      d.position.set(x, 0, z);
      const want = what === 'run' ? Math.PI : what === 'sit' ? -0.6 : 0;
      face += (want - face) * Math.min(1, dt * 6);
      d.rotation.y = face;
      const moving = what === 'trot' || what === 'run';
      const pace = what === 'run' ? 16 : 10;
      const sitting = what === 'sit' || what === 'scratch';
      sit += ((sitting ? 1 : 0) - sit) * Math.min(1, dt * 5);
      //sat: the back end down on its haunches, front legs straight
      body.rotation.z = sit * 0.55;
      body.position.y = 0.86 - sit * 0.38;
      legs.forEach((l, i) => {
        const front = i < 2;
        const swing = moving ? Math.sin(t * pace + (i === 0 || i === 3 ? 0 : Math.PI)) * (what === 'run' ? 0.8 : 0.5) : 0;
        l.hip.rotation.z = swing - (front ? 0.55 : -0.9) * sit;
        l.knee.rotation.z = (moving ? Math.max(0, -swing) * (front ? -0.6 : 0.9) : 0) + (front ? 0 : -1.6 * sit);
      });
      //the scratch: one back leg up at the ear, quick
      if (what === 'scratch') {
        legs[2].hip.rotation.z = -1.3 + Math.sin(t * 28) * 0.25;
        legs[2].knee.rotation.z = -1.2;
      }
      //the head: up while it trots, nose down sniffing the can, tipped to the scratch, looking up at the man
      const sniff = what === 'sniff';
      neck.rotation.z = sniff ? -0.9 + Math.sin(t * 14) * 0.05 : what === 'scratch' ? -0.1 : what === 'sit' ? 0.25 : moving ? Math.sin(t * pace * 2) * 0.05 : 0;
      head.rotation.set(what === 'scratch' ? 0.45 : 0, 0, sniff ? 0.25 : what === 'sit' ? -0.55 : 0);
      jaw.position.y = -0.17 - (what === 'run' || what === 'sit' ? 0.04 + Math.abs(Math.sin(t * 8)) * 0.03 : 0); // panting
      for (const e of ears) e.rotation.z = moving ? Math.sin(t * pace + 1) * 0.35 : sniff ? 0.4 : 0;
      //the tail: up and wagging, fastest when it's being petted
      const wag = what === 'sit' ? 22 : 12;
      tail.forEach((seg, k) => {
        seg.rotation.z = k === 0 ? 0.6 - sit * 0.9 : -0.3;
        seg.rotation.x = Math.sin(t * wag - k * 0.6) * (0.5 + k * 0.1);
      });
    },
  };
}

// a cardboard sign
function signTexture(text: string[]): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c8a06a';
  g.fillRect(0, 0, 128, 96);
  g.fillStyle = '#2a1a10';
  g.font = 'bold 22px "Arial Black", sans-serif';
  g.textAlign = 'center';
  text.forEach((line, i) => g.fillText(line, 64, 34 + i * 26));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const PED = 1.35; // the people's model to the skater's size
let HIP_Y0 = 0; // a person's hips' rest height (peds.ts), read off the first one made

type Ped = { mesh: THREE.Object3D; bones: THREE.Bone[]; sync?: () => void; hand?: THREE.Object3D };
const SPIN = (p: number, at: number) => (p > at && p < at + 0.9 ? ((p - at) / 0.9) * Math.PI * 2 : 0); // a quick turn on the spot

// a boombox on the sidewalk: a body, two speakers that thump on the beat, a handle and a tape deck's glow
function boombox(): { group: THREE.Group; update(): void } {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.32).translate(0, 0.275, 0), toon({ color: 0x2a2a34 }));
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.08, 0.34).translate(0, 0.5, 0), toon({ color: 0xc8c8d0 }));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 5, 12, Math.PI), toon({ color: 0xc8c8d0 }));
  handle.position.y = 0.55;
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.14), new THREE.MeshBasicMaterial({ color: 0x6af0ff }));
  deck.position.set(0, 0.33, 0.165);
  deck.userData.inked = true;
  const cones: THREE.Mesh[] = [];
  for (const x of [-0.33, 0.33]) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 14).rotateX(Math.PI / 2), toon({ color: 0x6a6a78 }));
    cone.position.set(x, 0.27, 0.17);
    const dust = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10).rotateX(Math.PI / 2), toon({ color: 0x1a1a20 }));
    dust.position.z = 0.02;
    cone.add(dust);
    cones.push(cone);
  }
  group.add(body, trim, handle, deck, ...cones);
  inkify(group);
  return {
    group,
    update(): void {
      const b = bounce();
      for (const c of cones) c.scale.set(1 + b * 0.18, 1 + b * 0.18, 1 + b * 0.6);
      group.scale.y = 1 + b * 0.04;
    },
  };
}

// The people on the street (zack's second pass, 2026-11-03), all on the street's minute (SCENE):
// - a homeless man sat against the pizza place with his sign, nodding along; he pets the dog when it sits by him
// - the hitchhiker on the curb: thumb out at the traffic, big waves, a look at his phone, a shrug, a wave to you,
//   and dancing along with Webster in between
// - the crazy guy: starts dancing on the right, dances his way along to the left behind Webster, cuts loose by the
//   homeless man (points at the drones, spins), then moonwalks all the way back
// - and a dancer on the right by the boombox: a two-step, the running man, a body roll, arms up on the drop
function people(rng: Rng): Life {
  const group = new THREE.Group();
  const add = (p: Ped | null, x: number, z: number, ry = 0) => {
    if (!p) return null;
    p.mesh.scale.setScalar(PED);
    p.mesh.position.set(x, 0, z);
    p.mesh.rotation.y = ry;
    group.add(p.mesh);
    return p;
  };
  // each is the blender bot's model (bot-people.ts), or the code-built person when it didn't load
  const person = (who: Who, r: Rng): Ped | null => botPerson(who) ?? makePerson(r, 'chicago');
  const sit = person('homeless', rng);
  if (sit) HIP_Y0 = sit.bones[1].position.y;
  add(sit, -10.5, -2.0); // against the pizza place's front (city.ts STORE)
  if (sit) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), toon({ map: signTexture(['ANYTHING', 'HELPS']) }));
    sign.position.set(-10.1, 0.6, -0.8);
    sign.rotation.x = -0.25;
    group.add(sign);
    const box = model('CardboardBox');
    if (box) {
      box.position.set(-13.1, 0, -3);
      box.scale.setScalar(1.3);
      inkify(box);
      group.add(box);
    }
  }
  const hitch = add(person('hitch', makeRng(11)), -3.6, 2.5, 0.3);
  //his phone, in his left hand: shown when he checks it
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.02), new THREE.MeshBasicMaterial({ color: 0x9ad8ff }));
  if (hitch) {
    if (hitch.hand) {
      //in the model's left hand: the hand bone runs wrist to fingers along its y, in the model's own units
      hitch.mesh.updateMatrixWorld(true);
      const k = 1 / hitch.hand.getWorldScale(new THREE.Vector3()).y;
      phone.scale.setScalar(k * PED);
      phone.position.set(0, 0.06 * k * PED, 0.03 * k * PED);
      hitch.hand.add(phone);
    } else {
      phone.position.set(-0.02, -0.66, 0.08);
      hitch.bones[4].add(phone);
    }
  }
  const wild = add(person('wild', makeRng(23)), 9.5, 0.6);
  const dancer = add(person('dancer', makeRng(31)), 13.2, 0.4, -0.35);
  const box = boombox();
  box.group.position.set(11.9, 0, 1.3);
  box.group.rotation.y = 0.5;
  group.add(box.group);
  return {
    group,
    update(t: number): void {
      const b = bounce();
      const n = beats();
      const sway = Math.sin(n * Math.PI);
      const p = t % SCENE;
      if (sit) {
        const [, hips, legL, legR, armL, armR, head] = sit.bones;
        //sat down on the sidewalk, back to the wall, legs out, nodding along; when the dog sits by him he reaches
        //over and pets it, looking down at it
        hips.position.y = 0.32;
        legL.position.y = legR.position.y = 0.32;
        legL.rotation.set(-1.3, 0, -0.14); // knees apart, leaning back on the wall: a deeper fold creased the model's seat
        legR.rotation.set(-1.25, 0, 0.12);
        hips.rotation.x = -0.25;
        armL.rotation.set(-0.7, 0, -0.1);
        const petting = p > 7.6 && p < 14.6;
        armR.rotation.set(petting ? -0.9 : -0.8 - b * 0.25, 0, petting ? 0.75 + Math.sin(t * 5) * 0.18 : 0.1);
        head.rotation.x = petting ? 0.35 : 0.25 + b * 0.25;
        head.rotation.y = petting ? 0.5 : 0;
        head.rotation.z = petting ? 0 : Math.sin(n * Math.PI * 0.5) * 0.12;
      }
      if (hitch) {
        const [, hips, legL, legR, armL, armR, head] = hitch.bones;
        //his minute: thumb out, big waves, the phone, a shrug, dancing, thumb out again, a wave to you, dancing
        const what = step(p, [[0, 'thumb'], [6, 'wave'], [10, 'phone'], [16, 'shrug'], [19, 'dance'], [30, 'thumb'], [36, 'hey'], [40, 'dance'], [50, 'phone'], [55, 'thumb']] as const);
        const dancing = what === 'dance';
        phone.visible = what === 'phone';
        hips.position.y = HIP_Y0 - b * (dancing ? 0.07 : 0.02);
        hips.rotation.set(0, dancing ? sway * 0.3 : 0, dancing ? sway * 0.08 : 0);
        legL.rotation.set(dancing ? Math.max(0, sway) * -0.4 : 0, 0, 0);
        legR.rotation.set(dancing ? Math.max(0, -sway) * -0.4 : 0, 0, 0);
        head.rotation.set(0, 0, 0);
        if (what === 'thumb') {
          //the right arm out at the road, thumb up, his head following the cars down the street
          armR.rotation.set(-0.2, 0, 1.45 + Math.sin(t * 2) * 0.05);
          armL.rotation.set(0, 0, -0.12);
          head.rotation.y = -0.6 + Math.sin(t * 0.9) * 0.5;
        } else if (what === 'wave') {
          //both arms going over his head: hey! stop!
          armR.rotation.set(0, 0, 2.3 + Math.sin(t * 10) * 0.3); // no higher: past ~2.6 an arm folds into the model's head
          armL.rotation.set(0, 0, -2.3 - Math.sin(t * 10 + 1) * 0.3);
          hips.position.y = HIP_Y0 + Math.abs(Math.sin(t * 5)) * 0.06; // up on his toes
        } else if (what === 'phone') {
          //checking his phone, head down, the other hand on his hip
          armL.rotation.set(-1.25, 0, -0.05); // held out in front, not across the chest
          armR.rotation.set(0, 0, 0.5);
          head.rotation.x = 0.45;
        } else if (what === 'shrug') {
          //nobody stops: arms out, palms up, head tipped
          const k = Math.min(1, (p - 16) * 3);
          armR.rotation.set(-0.5 * k, 0, 0.9 * k);
          armL.rotation.set(-0.5 * k, 0, -0.9 * k);
          head.rotation.z = 0.3 * k;
          hips.position.y = HIP_Y0 + 0.03 * k;
        } else if (what === 'hey') {
          //a wave at you, the player, one hand high
          armR.rotation.set(0, 0, 2.4 + Math.sin(t * 8) * 0.2);
          armL.rotation.set(0, 0, -0.1);
          head.rotation.x = -0.1;
        } else {
          armR.rotation.set(-0.6 - b * 0.5, 0, 0.5);
          armL.rotation.set(-0.6 - (1 - b) * 0.5, 0, -0.5);
          head.rotation.set(b * 0.2, Math.sin(n * Math.PI * 0.5) * 0.3, 0);
        }
      }
      if (wild) {
        const [, hips, legL, legR, armL, armR, head] = wild.bones;
        //his minute: dancing on the right, dancing his way left behind Webster, cutting loose by the homeless man,
        //then moonwalking all the way back
        const x = track(p, [[0, 9.5], [8, 9.5], [20, -7.2], [36, -7.2], [50, 9.5]]);
        const z = track(p, [[0, 0.6], [8, 0.6], [12, -1.3], [17, -1.3], [20, -0.3], [36, -0.3], [40, -1.3], [46, -1.3], [50, 0.6]]);
        const what = step(p, [[0, 'dance'], [8, 'travel'], [20, 'loose'], [28, 'point'], [31, 'loose'], [36, 'moon'], [50, 'dance']] as const);
        wild.mesh.position.set(x, 0, z);
        const jerk = Math.sin(t * 17) * Math.max(0, Math.sin(t * 1.3));
        hips.position.y = HIP_Y0 - b * 0.1;
        hips.rotation.set(0.15 + b * 0.15, 0, sway * 0.2 + jerk * 0.1);
        legL.rotation.set(Math.sin(n * Math.PI) * 0.5, 0, 0);
        legR.rotation.set(-Math.sin(n * Math.PI) * 0.5, 0, 0);
        armL.rotation.set(Math.sin(t * 5.3) * 1.2, 0, -1.2 - Math.sin(n * Math.PI * 2) * 0.9);
        armR.rotation.set(Math.cos(t * 4.1) * 1.2, 0, 1.2 + Math.cos(n * Math.PI * 2) * 0.9);
        head.rotation.set(b * 0.4 + jerk * 0.3, Math.sin(t * 3.1) * 0.5, jerk * 0.4);
        if (what === 'dance') wild.mesh.rotation.y = Math.sin(t * 0.7) * 0.8 + SPIN(p, 4) + SPIN(p, 54);
        else if (what === 'travel') {
          //heading left, a stomp on every beat, arms swinging wide
          wild.mesh.rotation.y = -Math.PI / 2 + 0.4 + Math.sin(n * Math.PI) * 0.3;
          legL.rotation.x = Math.sin(t * 7) * 0.55;
          legR.rotation.x = -Math.sin(t * 7) * 0.55;
        } else if (what === 'loose') wild.mesh.rotation.y = 0.2 + Math.sin(t * 1.1) * 1.0 + SPIN(p, 23) + SPIN(p, 33);
        else if (what === 'point') {
          //stock still, pointing up at the drones, shouting about it
          wild.mesh.rotation.y = 0.4;
          hips.rotation.set(-0.1, 0, 0);
          legL.rotation.x = legR.rotation.x = 0;
          armR.rotation.set(0, 0, 2.4 + jerk * 0.15);
          armL.rotation.set(-0.3, 0, -0.5);
          head.rotation.set(-0.5, 0.2, 0);
        } else {
          //the moonwalk: facing left, gliding right, the feet sliding back by turns
          wild.mesh.rotation.y = -Math.PI / 2 + 0.3;
          const slide = Math.sin(t * 6);
          legL.rotation.x = Math.max(0, slide) * -0.45;
          legR.rotation.x = Math.max(0, -slide) * -0.45;
          hips.rotation.set(0.05, 0, 0);
          armL.rotation.set(-0.3 + slide * 0.2, 0, -0.25);
          armR.rotation.set(-0.3 - slide * 0.2, 0, 0.25);
          head.rotation.set(b * 0.15, 0.3, 0);
        }
      }
      if (dancer) {
        const [, hips, legL, legR, armL, armR, head] = dancer.bones;
        //by the boombox: a two-step, the running man, a body roll, arms up on the drop; on the beat, eight-count
        //moves round the minute
        const move = step(p, [[0, 'two'], [12, 'run'], [20, 'roll'], [28, 'up'], [32, 'two'], [44, 'run'], [52, 'roll']] as const);
        const half = Math.sin(n * Math.PI);
        dancer.mesh.rotation.y = -0.35 + (move === 'two' ? half * 0.35 : 0) + SPIN(p, 31) + SPIN(p, 59);
        hips.position.y = HIP_Y0 - b * 0.08;
        hips.rotation.set(0, 0, 0);
        head.rotation.set(b * 0.25, 0, 0);
        if (move === 'two') {
          //side to side, the arms swinging across
          dancer.mesh.position.x = 13.2 + half * 0.3;
          legL.rotation.set(Math.max(0, half) * -0.3, 0, -0.1);
          legR.rotation.set(Math.max(0, -half) * -0.3, 0, 0.1);
          armL.rotation.set(-0.4 + half * 0.5, 0, -0.4);
          armR.rotation.set(-0.4 - half * 0.5, 0, 0.4);
          hips.rotation.z = half * 0.12;
        } else if (move === 'run') {
          //the running man: a knee up and the other foot sliding back, arms pumping
          const k = Math.sin(n * Math.PI);
          legL.rotation.set(k > 0 ? -1.0 * k : 0.3 * -k, 0, 0);
          legR.rotation.set(k < 0 ? 1.0 * k : -0.3 * k, 0, 0);
          armL.rotation.set(-0.9 * Math.max(0, k), 0, -0.3);
          armR.rotation.set(-0.9 * Math.max(0, -k), 0, 0.3);
          hips.position.y = HIP_Y0 - 0.06 + Math.abs(k) * 0.05;
        } else if (move === 'roll') {
          //a body roll: the hips and the head rolling through, the arms out in a wave
          const r = Math.sin(t * 4.2);
          hips.rotation.set(r * 0.25, 0, Math.cos(t * 4.2) * 0.12);
          head.rotation.set(-r * 0.3, 0, 0);
          legL.rotation.set(0, 0, -0.12);
          legR.rotation.set(0, 0, 0.12);
          armL.rotation.set(0, 0, -1.4 - Math.sin(t * 4.2) * 0.4);
          armR.rotation.set(0, 0, 1.4 + Math.sin(t * 4.2 + 1.2) * 0.4);
        } else {
          //arms up on the drop, jumping on the beat
          armL.rotation.set(0, 0, -2.4 - b * 0.2);
          armR.rotation.set(0, 0, 2.4 + b * 0.2);
          hips.position.y = HIP_Y0 + b * 0.18;
          legL.rotation.set(-b * 0.3, 0, 0);
          legR.rotation.set(-b * 0.3, 0, 0);
          head.rotation.set(-0.3, 0, 0);
        }
      }
      for (const who of [sit, hitch, wild, dancer]) who?.sync?.();
      box.update();
    },
  };
}

//its minute (zack 2026-11-03: off to the right after its first sit, then back in from the right on the fire
//escape): along the pizza place's sign band (city.ts STORE) to sit a while, down to the sidewalk and away right
//as the dog comes along, then in from the right on the fire escape's lower landing (facade.ts), up the stair, along
//the top landing to sit by a window, and in through it
type CatDoing = 'walk' | 'sit' | 'hop' | 'run' | 'gone' | 'in';
function catRoute(p: number): { what: CatDoing; x: number; y: number; z: number; dir: number } {
  const band = STORE.bandTop[0];
  const bandZ = STORE.face - 0.05;
  const F = FACADE;
  const lo = F.floors[0] - F.winH / 2 - 0.36 + 0.08; // the landings' tops
  const hi = F.floors[1] - F.winH / 2 - 0.36 + 0.08;
  const fcx = (F.bays[4] + F.bays[5]) / 2;
  const landZ = F.face + 0.85;
  const stairZ = F.face + 1.05;
  const winX = F.bays[4];
  const what = step(p, [[0, 'walk'], [6, 'sit'], [14, 'walk'], [15.5, 'hop'], [16.3, 'run'], [22, 'gone'], [32, 'walk'], [39.5, 'sit'], [47, 'in'], [48.5, 'gone']] as const);
  let x = 0;
  let y = band;
  let z = bandZ;
  let dir = 0; // the way it faces: 0 right, PI left, -PI/2 out at the street, PI/2 in at the wall
  if (p < 15.5) {
    x = track(p, [[0, -12.4], [6, -6.2], [14, -6.2], [15.5, -4.6]]);
    dir = p >= 6 && p < 14 ? -0.4 : 0;
  } else if (p < 16.3) {
    //the hop down: an arc out from the band to the sidewalk
    const u = (p - 15.5) / 0.8;
    x = -4.6 + u * 1.2;
    y = band * (1 - u * u) + Math.sin(u * Math.PI) * 0.4;
    z = bandZ + (-0.9 - bandZ) * u;
  } else if (p < 22) {
    x = -3.4 + (p - 16.3) * 4.4; // bolting, with the dog coming
    y = 0;
    z = -0.9;
  } else if (p < 35) {
    x = track(p, [[32, 17.4], [35, fcx - 1.1]]);
    y = lo;
    z = landZ;
    dir = Math.PI;
  } else if (p < 37) {
    //up the stair, which climbs to the right
    const u = (p - 35) / 2;
    x = fcx - 1.1 + u * 3;
    y = lo + (hi - lo) * u;
    z = stairZ;
    dir = 0;
  } else if (p < 47) {
    x = track(p, [[37, fcx + 1.9], [39.5, winX + 0.3]]);
    y = hi;
    z = landZ;
    dir = p < 39.5 ? Math.PI : -Math.PI / 2;
  } else {
    //in through the window: up onto the sill and back into the room, out of sight behind the glass
    const u = Math.min(1, (p - 47) / 1.5);
    x = winX + 0.3;
    y = hi + Math.min(1, u * 2) * 0.36;
    z = landZ + (F.face - 0.8 - landZ) * u;
    dir = Math.PI / 2;
  }
  return { what, x, y, z, dir };
}

// a cat walking along the tops of the shop signs, stopping to sit and look round: a tuxedo cat (zack: "detail to the
// cat"), black with a white bib, muzzle and socks, green eyes that catch the light and blink, ears that flick,
// whiskers, and a tail of jointed pieces that sways as it walks and curls round its feet when it sits
// the cat: the blender bot's tuxedo (src/render/bot-model.ts) when it loaded, else the code-built one
function cat(): Life {
  return modelCat() ?? codeCat();
}

// the blender bot's cat, rigged: the same minute as the code-built cat, each thing it does a clip
function modelCat(): Life | null {
  const rig = CAT.rig<CatClip>();
  if (!rig) return null;
  const group = new THREE.Group();
  inkify(rig.root);
  group.add(rig.root);
  let face = 0;
  return {
    group,
    update(t: number, dt: number): void {
      const { what, x, y, z, dir } = catRoute(t % SCENE);
      rig.root.visible = what !== 'gone';
      rig.root.position.set(x, y, z);
      //turns ease round (the short way)
      let dd = dir - face;
      while (dd > Math.PI) dd -= Math.PI * 2;
      while (dd < -Math.PI) dd += Math.PI * 2;
      face += dd * Math.min(1, dt * 8);
      rig.root.rotation.y = face;
      if (what === 'run') rig.play('run', 0.15, 1.7); // bolting from the dog
      else if (what === 'hop') rig.play('jump', 0.1, 1.25);
      else if (what === 'sit') rig.play('sit', 0.4);
      else if (what !== 'gone') rig.play('walk', 0.25, 1.1);
      rig.update(dt);
    },
  };
}

// the code-built cat: blobs, cones and a jointed tail, posed in code
function codeCat(): Life {
  const group = new THREE.Group();
  const fur = toon({ color: 0x23202a });
  const white = toon({ color: 0xf2f0f6 });
  const pink = toon({ color: 0xe89aa8 });
  const blob = (r: number, sx: number, sy: number, sz: number, m: THREE.Material) => new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9).scale(sx, sy, sz), m);
  const c = new THREE.Group(); // stands on the band, faces +x
  const body = new THREE.Group(); // pivots at the hips, so sitting tips it up
  body.position.set(-0.24, 0.36, 0);
  c.add(body);
  const torso = blob(0.2, 1.75, 0.82, 0.72, fur);
  torso.position.set(0.24, 0.02, 0);
  const haunch = blob(0.16, 1.2, 1.05, 1.0, fur);
  haunch.position.set(0.02, 0, 0);
  const bib = blob(0.12, 1.0, 1.2, 0.8, white);
  bib.position.set(0.5, -0.04, 0);
  const belly = blob(0.12, 2.0, 0.5, 0.7, white);
  belly.position.set(0.28, -0.1, 0);
  body.add(torso, haunch, bib, belly);
  //the head, on the front of the body
  const head = new THREE.Group();
  head.position.set(0.6, 0.14, 0);
  body.add(head);
  const skull = blob(0.14, 1.0, 0.9, 1.1, fur);
  const cheeks = blob(0.1, 0.9, 0.7, 1.55, fur);
  cheeks.position.set(0.03, -0.04, 0);
  const muzzle = blob(0.07, 0.9, 0.7, 1.2, white);
  muzzle.position.set(0.11, -0.05, 0);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.04), pink);
  nose.position.set(0.165, -0.015, 0);
  head.add(skull, cheeks, muzzle, nose);
  const ears: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const ear = new THREE.Group();
    ear.position.set(-0.01, 0.1, side * 0.075);
    ear.rotation.set(side * -0.3, 0, -0.15);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.13, 4).translate(0, 0.065, 0), fur);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4).translate(0.012, 0.045, 0), pink);
    ear.add(outer, inner);
    head.add(ear);
    ears.push(ear);
  }
  //green eyes that glow in the dusk, slit pupils; they blink now and then
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xb8ff6a });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  const eyes: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const eye = new THREE.Group();
    eye.position.set(0.115, 0.035, side * 0.06);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6).scale(0.6, 1, 1), eyeMat);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.01), pupilMat);
    slit.position.x = 0.016;
    eye.add(ball, slit);
    head.add(eye);
    eyes.push(eye);
  }
  //whiskers: fine pale lines fanning out of the muzzle
  const wpts: number[] = [];
  for (const side of [1, -1]) for (let k = 0; k < 3; k++) wpts.push(0.13, -0.05, side * 0.05, 0.16, -0.03 + (k - 1) * 0.035, side * 0.2);
  const whisk = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(wpts, 3)), new THREE.LineBasicMaterial({ color: 0xf4f0e8 }));
  whisk.userData.inked = true;
  head.add(whisk);
  //legs: the front ones thin with white socks, the back ones a thigh and a shin
  const legs: THREE.Group[] = [];
  for (const [x, zz, front] of [[0.48, 0.07, true], [0.48, -0.07, true], [0.0, 0.08, false], [0.0, -0.08, false]] as const) {
    const leg = new THREE.Group();
    leg.position.set(x, -0.02, zz);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(front ? 0.035 : 0.06, 0.03, 0.26, 7).translate(0, -0.13, 0), fur);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.034, 0.1, 7).translate(0, -0.29, 0), white);
    const paw = blob(0.04, 1.4, 0.6, 1.0, white);
    paw.position.set(0.02, -0.34, 0);
    leg.add(upper, sock, paw);
    body.add(leg);
    legs.push(leg);
  }
  //the tail: jointed pieces off the haunch, each turned a little on its parent's turn, so the tail bends in a curve
  const tail: THREE.Group[] = [];
  let parent: THREE.Object3D = body;
  for (let k = 0; k < 7; k++) {
    const seg = new THREE.Group();
    if (k === 0) seg.position.set(-0.16, 0.06, 0);
    else seg.position.set(0, 0.11, 0);
    seg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03 - k * 0.002, 0.034 - k * 0.002, 0.12, 6).translate(0, 0.055, 0), k === 6 ? white : fur));
    parent.add(seg);
    parent = seg;
    tail.push(seg);
  }
  inkify(c);
  c.scale.setScalar(1.35);
  group.add(c);
  let sit = 0; // eases 0 (walking) to 1 (sat)
  let face = 0;
  return {
    group,
    update(t: number, dt: number): void {
      const p = t % SCENE;
      const { what, x, y, z, dir } = catRoute(p);
      c.visible = what !== 'gone';
      const walking = what === 'walk' || what === 'run' || what === 'in';
      sit += ((what === 'sit' ? 1 : 0) - sit) * Math.min(1, dt * 5);
      //turns ease round (the short way)
      let dd = dir - face;
      while (dd > Math.PI) dd -= Math.PI * 2;
      while (dd < -Math.PI) dd += Math.PI * 2;
      face += dd * Math.min(1, dt * 8);
      const stride = t * (what === 'run' ? 18 : 10);
      c.position.set(x, y + (walking ? Math.abs(Math.sin(stride)) * 0.015 : 0), z);
      c.rotation.y = face;
      const look = sit * (Math.sin(t * 0.7) * 0.7 - (dir === -0.4 ? 0.9 : 0));
      //the walk: diagonal pairs together; sat: the body tipped up on its haunches, front legs straight
      legs.forEach((l, i) => {
        const swing = Math.sin(stride + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 * (1 - sit);
        //sat: the front legs straight down to the band, the back ones tucked forward under the haunch
        l.rotation.z = swing + (i < 2 ? -0.75 : -0.25) * sit;
        l.scale.y = 1 + (i < 2 ? 0.45 : -0.3) * sit;
      });
      body.rotation.z = sit * 0.75;
      body.position.y = 0.36 - sit * 0.14;
      //the head: level while walking, bobbing with the steps; sat, it looks about at the street
      head.rotation.set(0, look, -sit * 0.7 + (1 - sit) * Math.sin(stride * 2) * 0.04);
      //an ear flick every few seconds, and a blink
      const flick = (t * 0.37) % 1 < 0.04 ? 0.5 : 0;
      ears[0].rotation.x = -0.3 - flick;
      ears[1].rotation.x = 0.3;
      const blink = (t * 0.29 + 0.4) % 1 < 0.03 ? 0.1 : 1;
      for (const e of eyes) e.scale.y = blink;
      //the tail: up and swaying in a slow S as it walks; sat, wrapped forward round its feet with the tip twitching
      tail.forEach((seg, k) => {
        const wave = Math.sin(t * 2.4 - k * 0.7);
        const walkZ = k === 0 ? 0.5 : -0.18 + wave * 0.15;
        const walkX = wave * 0.2;
        const sitZ = k === 0 ? 1.0 : 0.08;
        const sitX = k === 0 ? 0 : 0.45 + (k === 6 ? Math.sin(t * 9) * 0.4 : 0);
        seg.rotation.z = walkZ + (sitZ - walkZ) * sit;
        seg.rotation.x = walkX + (sitX - walkX) * sit;
      });
    },
  };
}

// pigeons pecking on the sidewalk by the curb: heads bobbing, a hop now and then; every so often they all take off
// over the roofs and glide back down
function pigeons(rng: Rng, at: THREE.Vector3, n: number): Life {
  return modelPigeons(rng, at, n) ?? codePigeons(rng, at, n);
}

// the blender bot's pigeon (src/render/pigeon.ts), rigged: it walks about pecking, and flies off and back on the same
// 15 s loop as the code-built ones. Null when the model didn't load
function modelPigeons(rng: Rng, at: THREE.Vector3, n: number): Life | null {
  const group = new THREE.Group();
  const birds: { rig: PigeonRig; home: THREE.Vector3; ph: number; out: THREE.Vector3; x: number }[] = [];
  for (let i = 0; i < n; i++) {
    const rig = pigeonRig();
    if (!rig) return null;
    inkify(rig.root);
    rig.root.scale.setScalar(0.95);
    group.add(rig.root);
    const home = at.clone().add(new THREE.Vector3((rng() - 0.5) * 3, 0, (rng() - 0.5) * 1.0));
    birds.push({ rig, home, ph: rng() * 6, out: new THREE.Vector3(8 + rng() * 10, 22 + rng() * 10, -14 - rng() * 10), x: 0 });
  }
  return {
    group,
    update(t: number, dt: number): void {
      const p = t % 15;
      for (const b of birds) {
        let u = 0; // 0 on the ground, 1 gone over the roof
        if (p > 10 && p < 12.5) u = (p - 10) / 2.5;
        else if (p >= 12.5) u = 1 - (p - 12.5) / 2.5;
        const up = p > 10 && p < 12.5;
        const e = u * u;
        const g = b.rig.root;
        if (u > 0) {
          b.rig.play('fly', 0.1);
          g.position.set(b.home.x + b.x + b.out.x * e, b.out.y * e + Math.sin(u * Math.PI) * 3, b.home.z + b.out.z * e);
          g.rotation.set(0, up ? -0.6 : Math.PI - 0.6, up ? 0.5 : -0.2);
        } else {
          //a few seconds walking one way, then stopping to peck, each to its own clock
          const step = Math.sin(t * 0.5 + b.ph);
          const walking = Math.abs(step) > 0.45;
          b.rig.play(walking ? 'walk' : 'peck');
          const dir = step > 0 ? 1 : -1;
          if (walking) b.x = Math.max(-1.2, Math.min(1.2, b.x + dir * dt * 0.35));
          g.position.set(b.home.x + b.x, 0, b.home.z);
          g.rotation.set(0, dir > 0 ? 0 : Math.PI, 0);
        }
        b.rig.update(dt);
      }
    },
  };
}

// the code-built pigeons: a ball of a body, a head and two flat wings
function codePigeons(rng: Rng, at: THREE.Vector3, n: number): Life {
  const group = new THREE.Group();
  const feather = toon({ color: 0x5a5a78, side: THREE.DoubleSide });
  const pale = toon({ color: 0x9a96aa });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0.12, 0, 0, -0.2, 0, 0, -0.06, 0, 0.5], 3));
  wingGeo.computeVertexNormals();
  const birds: { g: THREE.Group; head: THREE.Mesh; l: THREE.Mesh; r: THREE.Mesh; home: THREE.Vector3; ph: number; out: THREE.Vector3 }[] = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6).scale(1.5, 0.9, 0.9), pale);
    body.position.y = 0.16;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), feather);
    head.position.set(0.22, 0.3, 0);
    const l = new THREE.Mesh(wingGeo, feather);
    const r = new THREE.Mesh(wingGeo, feather);
    l.position.y = r.position.y = 0.22;
    r.scale.z = -1;
    g.add(body, head, l, r);
    //a tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.12), feather);
    tail.position.set(-0.26, 0.18, 0);
    tail.rotation.z = 0.35;
    g.add(tail);
    g.scale.setScalar(0.95);
    group.add(g);
    const home = at.clone().add(new THREE.Vector3((rng() - 0.5) * 3, 0, (rng() - 0.5) * 1.0));
    birds.push({ g, head, l, r, home, ph: rng() * 6, out: new THREE.Vector3(8 + rng() * 10, 22 + rng() * 10, -14 - rng() * 10) });
  }
  inkify(group);
  return {
    group,
    update(t: number): void {
      //a 15 s loop: 10 s on the ground, up and away over the roofs, then gliding back in to land
      const p = t % 15;
      for (const b of birds) {
        const wander = Math.sin(t * 0.4 + b.ph) * 0.5;
        let u = 0; // 0 on the ground, 1 gone over the roof
        if (p > 10 && p < 12.5) u = (p - 10) / 2.5;
        else if (p >= 12.5) u = 1 - (p - 12.5) / 2.5;
        const up = p > 10 && p < 12.5;
        const e = u * u;
        b.g.position.set(b.home.x + wander + b.out.x * e, b.out.y * e + (u > 0 ? Math.sin(u * Math.PI) * 3 : 0), b.home.z + b.out.z * e);
        if (u > 0) {
          b.g.rotation.set(0, up ? -0.6 : Math.PI - 0.6, up ? 0.5 : -0.2);
          const flap = Math.sin(t * 22 + b.ph) * 1.1;
          b.l.rotation.x = flap;
          b.r.rotation.x = -flap;
          b.head.position.y = 0.3;
        } else {
          b.g.rotation.set(0, Math.sin(t * 0.3 + b.ph) * 2, 0);
          b.l.rotation.x = b.r.rotation.x = 0;
          //peck, peck: the head bobbing down to the ground, and a hop now and then
          const peck = Math.max(0, Math.sin(t * 7 + b.ph * 3));
          b.head.position.y = 0.3 - peck * peck * 0.2;
          b.g.position.y = Math.max(0, Math.sin(t * 2.1 + b.ph * 5)) > 0.97 ? 0.12 : 0;
        }
      }
    },
  };
}

// trash on the ground: a can rolling along the gutter and pages and a bag skittering down the sidewalk in the gusts,
// on a loop so the street never runs out of it
function streetTrash(rng: Rng): Life {
  const group = new THREE.Group();
  const bits: { m: THREE.Object3D; x: number; z: number; flat: boolean; speed: number; ph: number }[] = [];
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.48, 10).rotateX(Math.PI / 2), toon({ color: 0xc83a3a }));
  inkify(can);
  group.add(can);
  bits.push({ m: can, x: 0, z: 3.6, flat: false, speed: 1.6, ph: 0 });
  const mats = [trashTexture('paper', rng), trashTexture('bag', rng), trashTexture('paper', rng), trashTexture('bag', rng)].map(
    (map) => new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  mats.forEach((m, i) => {
    const page = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), m);
    group.add(page);
    bits.push({ m: page, x: 0, z: [1.6, 2.4, 0.4, 5.5][i], flat: true, speed: 1.2 + rng() * 1.2, ph: rng() * 40 });
  });
  let push = 0;
  return {
    group,
    update(t: number, dt: number): void {
      const g = gust(t);
      push += dt * g * g;
      for (const b of bits) {
        const span = 34;
        const x = (((push * b.speed * 2.6 + b.ph) % span) + span) % span - 16;
        if (!b.flat) {
          //the can rolls: its turn is how far it's gone over its radius
          b.m.position.set(x, -0.15, b.z + Math.sin(x * 0.3) * 0.15);
          b.m.rotation.z = -x / 0.16;
        } else {
          //a page: lifted and flipped by the gusts, lying flat when the wind drops
          const lift = Math.max(0, g - 0.55) * (0.8 + Math.sin(t * 3 + b.ph) * 0.4);
          b.m.position.set(x, 0.05 + lift * 1.4, b.z + Math.sin(t * 0.9 + b.ph) * 0.3);
          b.m.rotation.set(-Math.PI / 2 + lift * Math.sin(t * 6 + b.ph) * 2.5, x * 0.4, lift * 1.5);
        }
      }
    },
  };
}

// a flag on a pole off the store front, and a street tree in a sidewalk pit, both moving in the wind
function wind(rng: Rng): Life {
  const group = new THREE.Group();
  //the flag: a pole out from the wall over the shops and a cloth rippling off it
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), toon({ color: 0xd0c8b8 }));
  pole.rotation.z = -0.9;
  pole.position.set(-1.6, 7.6, -3.4);
  pole.rotation.x = 0.5;
  //black with the Gnar Games mark in white (zack 2026-11-03: public/title/gnar-games-flag.png), drawn in once it loads
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0c0c10';
  g.fillRect(0, 0, 384, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const logo = new Image();
  logo.onload = () => {
    //the mark is white on black: lighten it in, square in the middle of the cloth
    g.globalCompositeOperation = 'lighten';
    g.drawImage(logo, 192 - 104, 128 - 104, 208, 208);
    tex.needsUpdate = true;
  };
  logo.src = `${import.meta.env.BASE_URL}title/gnar-games-flag.png`;
  const clothGeo = new THREE.PlaneGeometry(2.4, 1.6, 12, 4).translate(1.2, -0.8, 0);
  const rest = Float32Array.from(clothGeo.getAttribute('position').array);
  const cloth = new THREE.Mesh(clothGeo, toon({ map: tex, side: THREE.DoubleSide }));
  //hung from the pole's tip
  const tip = new THREE.Vector3(0, 1.6, 0).applyEuler(pole.rotation).add(pole.position);
  cloth.position.copy(tip);
  cloth.rotation.y = -0.35;
  group.add(pole, cloth);

  //the tree: a trunk and low-poly blobs of leaves, each swaying on its own a little
  const tree = new THREE.Group();
  tree.position.set(16, 0, 1.6);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 4.2, 6).translate(0, 2.1, 0), toon({ color: 0x4a3428 }));
  const pit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 1.4), toon({ color: 0x2a2018 }));
  tree.add(trunk, pit);
  const crown = new THREE.Group();
  crown.position.y = 3.6;
  const leafMats = [0x3a7a4a, 0x2f6a40, 0x4a8a50].map((color) => toon({ color }));
  const blobs: { m: THREE.Mesh; ph: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + rng() * 0.5, 0), leafMats[i % 3]);
    m.position.set((rng() - 0.5) * 2, rng() * 1.6, (rng() - 0.5) * 1.6);
    crown.add(m);
    blobs.push({ m, ph: rng() * 6 });
  }
  tree.add(crown);
  inkify(tree);
  inkify(pole);
  group.add(tree);
  let wave = 0; // the cloth's wave, how far it has run
  return {
    group,
    update(t: number, dt: number): void {
      const w = gust(t);
      //the cloth: a slow, lazy wave running out from the pole, a little bigger in the gusts, the free end lifting a
      //touch (zack 2026-11-06: "mellow out the flag waving"). Its phase is kept, not t times a speed that changes
      //with the wind, which jerked the wave about whenever a gust came
      wave += dt * (2 + w * 1.2);
      const pos = clothGeo.getAttribute('position');
      for (let k = 0; k < pos.count; k++) {
        const x = rest[k * 3];
        const y = rest[k * 3 + 1];
        const u = x / 2.4;
        pos.setZ(k, Math.sin(x * 2.0 - wave) * u * (0.07 + w * 0.1));
        pos.setY(k, y + u * (w - 0.6) * 0.18);
      }
      pos.needsUpdate = true;
      clothGeo.computeVertexNormals();
      //the tree leans off the wind and shivers
      crown.rotation.z = -w * 0.08 + Math.sin(t * 2.2) * 0.03 * w;
      crown.rotation.x = Math.sin(t * 1.6) * 0.03 * w;
      for (const b of blobs) b.m.rotation.set(Math.sin(t * 3 + b.ph) * 0.08 * w, 0, Math.sin(t * 2.6 + b.ph) * 0.1 * w);
    },
  };
}

// everything that moves in the title scene's city, placed along the camera's way down
export function buildLife(seed = 5): Life {
  const rng = makeRng(seed);
  const parts: Life[] = [
    flock(rng, new THREE.Vector3(20, 236, -40), 34, 8, 0.22), // in view at the top, where the camera waits
    flock(rng, new THREE.Vector3(-15, 120, 10), 26, 5, -0.3),
    trash(rng, [new THREE.Vector3(0, 170, 30), new THREE.Vector3(0, 110, 22), new THREE.Vector3(0, 60, 16)], 14),
    drones(rng, [new THREE.Vector3(-12, 86, 14), new THREE.Vector3(14, 70, 18), new THREE.Vector3(-6, 54, 12)]),
    chopper(new THREE.Vector3(0, 98, -40)),
    cruiser(new THREE.Vector3(3, 13, 2)),
    flock(rng, new THREE.Vector3(0, 30, -50), 22, 6, 0.28), // over the roofs, seen from the street
    dog(),
    cat(),
    pigeons(rng, new THREE.Vector3(3.6, 0, 2.2), 5),
    streetTrash(rng),
    wind(rng),
    people(rng),
  ];
  const group = new THREE.Group();
  for (const p of parts) group.add(p.group);
  return {
    group,
    update(t: number, dt: number): void {
      for (const p of parts) p.update(t, dt);
    },
  };
}
