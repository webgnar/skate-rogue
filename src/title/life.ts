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
import { makePerson } from '../render/peds';
import { inkify, toon } from '../render/toon';
import { glowTexture, STORE } from './city';
import { STOREFRONTS } from '../render/storefronts';

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

// a flock of pigeons on a loop round the sky: each bird a body and two flapping wings
function flock(rng: Rng, center: THREE.Vector3, radius: number, n: number, speed: number): Life {
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

// a stray dog trotting along the sidewalk behind Webster, out one side and back in the other
function dog(z: number): Life {
  const group = new THREE.Group();
  const fur = toon({ color: 0x8a6440 });
  const dark = toon({ color: 0x3a2a20 });
  const d = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.45), fur);
  body.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.38), fur);
  head.position.set(0.78, 1.15, 0);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.24), dark);
  snout.position.set(1.08, 1.06, 0);
  const ear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.08), dark);
  ear.position.set(0.7, 1.42, 0.14);
  const ear2 = ear.clone();
  ear2.position.z = -0.14;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1).translate(-0.25, 0, 0), fur);
  tail.position.set(-0.62, 1.0, 0);
  const legs: THREE.Mesh[] = [];
  for (const [x, zz] of [[0.48, 0.15], [0.48, -0.15], [-0.48, 0.15], [-0.48, -0.15]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.14).translate(0, -0.31, 0), dark);
    leg.position.set(x, 0.66, zz);
    legs.push(leg);
    d.add(leg);
  }
  d.add(body, head, snout, ear, ear2, tail);
  inkify(d);
  d.scale.setScalar(1.1);
  group.add(d);
  return {
    group,
    update(t: number): void {
      const x = ((t * 2.2) % 70) - 35;
      d.position.set(x, 0, z);
      legs.forEach((l, i) => (l.rotation.z = Math.sin(t * 9 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5)); // diagonal pairs together, a trot
      tail.rotation.y = Math.sin(t * 12) * 0.6;
      tail.rotation.z = 0.6;
      head.rotation.z = Math.sin(t * 9) * 0.05;
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

// The people on the street: a homeless man sat against the store wall with his sign, and across the road a
// hitchhiker on the curb, thumb out, waving you down
function people(rng: Rng): Life {
  const group = new THREE.Group();
  const sit = makePerson(rng, 'chicago');
  const hitch = makePerson(makeRng(11), 'chicago');
  if (sit) HIP_Y0 = sit.bones[1].position.y;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), toon({ map: signTexture(['ANYTHING', 'HELPS']) }));
  if (sit) {
    sit.mesh.scale.setScalar(PED);
    sit.mesh.position.set(-10.5, 0, -2.0); // against the pizza place's front (city.ts STORE)
    group.add(sit.mesh);
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
  if (hitch) {
    hitch.mesh.scale.setScalar(PED);
    hitch.mesh.position.set(-3.6, 0, 2.5);
    hitch.mesh.rotation.y = 0.3; // on the curb down the street, turned to the camera
    group.add(hitch.mesh);
  }
  //a twitchy guy across the frame on the sidewalk, dancing to something only he hears (zack: a crazy crack head)
  const wild = makePerson(makeRng(23), 'chicago');
  if (wild) {
    wild.mesh.scale.setScalar(PED);
    group.add(wild.mesh);
  }
  return {
    group,
    update(t: number): void {
      const b = bounce();
      const n = beats();
      if (sit) {
        const [, hips, legL, legR, armL, armR, head] = sit.bones;
        //sat down on the sidewalk, back to the wall, legs out, nodding along to the beat and tapping a hand
        hips.position.y = 0.32;
        legL.position.y = legR.position.y = 0.32;
        legL.rotation.set(-1.45, 0, 0.12);
        legR.rotation.set(-1.4, 0, -0.08);
        hips.rotation.x = -0.12;
        armL.rotation.set(-0.7, 0, -0.1);
        armR.rotation.set(-0.8 - b * 0.25, 0, 0.1);
        head.rotation.x = 0.25 + b * 0.25;
        head.rotation.z = Math.sin(n * Math.PI * 0.5) * 0.12;
      }
      if (hitch) {
        const [, hips, legL, legR, armL, armR, head] = hitch.bones;
        //waving you down, then grooving while he waits: a bounce on every beat, hips swaying, the arms pumping
        const waving = t % 8 < 3.2;
        hips.position.y = 0.0 + HIP_Y0 - b * 0.06;
        hips.rotation.y = waving ? 0 : Math.sin(n * Math.PI) * 0.25;
        hips.rotation.z = waving ? 0 : Math.sin(n * Math.PI) * 0.08;
        legL.rotation.x = waving ? 0 : Math.max(0, Math.sin(n * Math.PI)) * -0.35;
        legR.rotation.x = waving ? 0 : Math.max(0, -Math.sin(n * Math.PI)) * -0.35;
        armR.rotation.set(waving ? 0 : -0.6 - b * 0.5, 0, waving ? 2.6 + Math.sin(t * 9) * 0.35 : 0.5);
        armL.rotation.set(waving ? 0 : -0.6 - (1 - b) * 0.5, 0, waving ? -0.1 : -0.5);
        head.rotation.x = waving ? 0 : b * 0.2;
        head.rotation.y = waving ? 0 : Math.sin(n * Math.PI * 0.5) * 0.3;
      }
      if (wild) {
        const [, hips, legL, legR, armL, armR, head] = wild.bones;
        //shuffling back and forth along the sidewalk, arms flailing, head jerking, on the beat and off it
        const along = Math.sin(t * 0.23) * 4;
        wild.mesh.position.set(9.5 + along * 0.6, 0, 0.6);
        wild.mesh.rotation.y = Math.sin(t * 0.7) * 0.8 + (Math.cos(t * 0.23) > 0 ? 0.6 : -0.6);
        const jerk = Math.sin(t * 17) * Math.max(0, Math.sin(t * 1.3));
        hips.position.y = HIP_Y0 - b * 0.1;
        hips.rotation.z = Math.sin(n * Math.PI) * 0.2 + jerk * 0.1;
        hips.rotation.x = 0.15 + b * 0.15;
        legL.rotation.x = Math.sin(n * Math.PI) * 0.5;
        legR.rotation.x = -Math.sin(n * Math.PI) * 0.5;
        armL.rotation.set(Math.sin(t * 5.3) * 1.2, 0, -1.2 - Math.sin(n * Math.PI * 2) * 0.9);
        armR.rotation.set(Math.cos(t * 4.1) * 1.2, 0, 1.2 + Math.cos(n * Math.PI * 2) * 0.9);
        head.rotation.set(b * 0.4 + jerk * 0.3, Math.sin(t * 3.1) * 0.5, jerk * 0.4);
      }
    },
  };
}

// a cat walking along the tops of the shop signs, stopping to sit and look round: a tuxedo cat (zack: "detail to the
// cat"), black with a white bib, muzzle and socks, green eyes that catch the light and blink, ears that flick,
// whiskers, and a tail of jointed pieces that sways as it walks and curls round its feet when it sits
function cat(): Life {
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
  //along the tops of the shops' sign bands (city.ts STORE): the pizza place's, then the tattoo shop's a step higher
  const Y = (x: number) => (x < STORE.rowX + STOREFRONTS.pizza.w * STORE.scale ? STORE.bandTop[0] : STORE.bandTop[1]);
  const Z = STORE.face - 0.05;
  //where it sits: near the end of the tattoo shop's band, short of the liquor store's taller sign
  const SIT = STORE.rowX + (STOREFRONTS.pizza.w + STOREFRONTS.tattoo.w) * STORE.scale - 1.1;
  let sit = 0; // eases 0 (walking) to 1 (sat)
  return {
    group,
    update(t: number, dt: number): void {
      //walk one way, sit a while, walk back: a 26 s loop
      const p = t % 26;
      let x: number;
      let dir: number;
      let walking = true;
      if (p < 8) [x, dir] = [-9 + (p / 8) * (SIT - -9), 1];
      else if (p < 13) [x, dir, walking] = [SIT, 1, false];
      else if (p < 21) [x, dir] = [SIT - ((p - 13) / 8) * (SIT - -9), -1];
      else [x, dir, walking] = [-9, -1, false];
      sit += ((walking ? 0 : 1) - sit) * Math.min(1, dt * 5);
      const step = t * 10;
      c.position.set(x, Y(x) + (walking ? Math.abs(Math.sin(step)) * 0.015 : 0), Z);
      c.rotation.y = dir > 0 ? 0 : Math.PI;
      //the walk: diagonal pairs together; sat: the body tipped up on its haunches, front legs straight
      legs.forEach((l, i) => {
        const swing = Math.sin(step + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 * (1 - sit);
        //sat: the front legs straight down to the band, the back ones tucked forward under the haunch
        l.rotation.z = swing + (i < 2 ? -0.75 : -0.25) * sit;
        l.scale.y = 1 + (i < 2 ? 0.45 : -0.3) * sit;
      });
      body.rotation.z = sit * 0.75;
      body.position.y = 0.36 - sit * 0.14;
      //the head: level while walking, bobbing with the steps; sat, it turns to the street and looks about
      const look = (dir > 0 ? -1 : 1) * sit * (1.1 + Math.sin(t * 0.7) * 0.5);
      head.rotation.set(0, look, -sit * 0.7 + (1 - sit) * Math.sin(step * 2) * 0.04);
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
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 64;
  const g = c.getContext('2d')!;
  //a city flag of our own: three stripes and a star
  ['#e04848', '#f4ece0', '#3a58b8'].forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(0, (i * 64) / 3, 96, 64 / 3 + 1);
  });
  g.fillStyle = '#ffd25a';
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 6 : 14;
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(28 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
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
  return {
    group,
    update(t: number): void {
      const w = gust(t);
      //the cloth: a wave running out from the pole, bigger in the gusts, and the free end lifting
      const pos = clothGeo.getAttribute('position');
      for (let k = 0; k < pos.count; k++) {
        const x = rest[k * 3];
        const y = rest[k * 3 + 1];
        const u = x / 2.4;
        pos.setZ(k, Math.sin(x * 2.6 - t * (5 + w * 5)) * u * (0.12 + w * 0.3));
        pos.setY(k, y + u * (w - 0.6) * 0.5);
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
    dog(0.8),
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
