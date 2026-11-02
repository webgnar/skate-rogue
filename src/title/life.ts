// What lives in the title scene's city (src/title/title-scene.ts): up top, pigeons wheeling past and trash riding the
// wind (plastic bags, newspaper, a soda cup); lower down, the AI's drones patrolling the towers with their red eyes
// and scan beams, the police chopper sweeping its spotlight and a cop cruiser hanging on its jump jets with its
// lights going; and down on the street, a stray dog trotting by, a homeless man sat against the store wall and a
// hitchhiker on the far curb waving you down.
import * as THREE from 'three';
import { makeRng, type Rng } from '../gen/rng';
import { makeDrone } from '../render/drone-view';
import { makeParkedCruiser } from '../render/kit';
import { model } from '../render/models';
import { makePerson } from '../render/peds';
import { inkify, toon } from '../render/toon';
import { glowTexture } from './city';

export interface Life {
  group: THREE.Group;
  update(t: number, dt: number): void;
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

// The people on the street: a homeless man sat against the store wall with his sign, and across the road a
// hitchhiker on the curb, thumb out, waving you down
function people(rng: Rng): Life {
  const group = new THREE.Group();
  const sit = makePerson(rng, 'chicago');
  const hitch = makePerson(makeRng(11), 'chicago');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), toon({ map: signTexture(['ANYTHING', 'HELPS']) }));
  if (sit) {
    sit.mesh.scale.setScalar(PED);
    sit.mesh.position.set(-6.5, 0, -3.3);
    group.add(sit.mesh);
    sign.position.set(-6.1, 0.6, -2.1);
    sign.rotation.x = -0.25;
    group.add(sign);
    const box = model('CardboardBox');
    if (box) {
      box.position.set(-8.4, 0, -3);
      box.scale.setScalar(1.3);
      inkify(box);
      group.add(box);
    }
  }
  if (hitch) {
    hitch.mesh.scale.setScalar(PED);
    hitch.mesh.position.set(7, 0, 2.4);
    hitch.mesh.rotation.y = -0.3; // on the curb up the street, turned to the camera
    group.add(hitch.mesh);
  }
  return {
    group,
    update(t: number): void {
      if (sit) {
        const [, hips, legL, legR, armL, armR, head] = sit.bones;
        //sat down on the sidewalk, back to the wall, legs out, head nodding
        hips.position.y = 0.32;
        legL.position.y = legR.position.y = 0.32;
        legL.rotation.set(-1.45, 0, 0.12);
        legR.rotation.set(-1.4, 0, -0.08);
        hips.rotation.x = -0.12;
        armL.rotation.set(-0.7, 0, -0.1);
        armR.rotation.set(-0.8, 0, 0.1);
        head.rotation.x = 0.35 + Math.sin(t * 0.6) * 0.12;
      }
      if (hitch) {
        const [, , , , armL, armR, head] = hitch.bones;
        //one arm up waving, the other thumb out at the road, on and off
        const waving = t % 5 < 3;
        armR.rotation.set(0, 0, waving ? 2.6 + Math.sin(t * 9) * 0.35 : 1.35);
        armL.rotation.set(0, 0, -0.1);
        head.rotation.y = waving ? 0 : -0.5;
      }
    },
  };
}

// everything that moves in the title scene's city, placed along the camera's way down
export function buildLife(seed = 5): Life {
  const rng = makeRng(seed);
  const parts: Life[] = [
    flock(rng, new THREE.Vector3(10, 205, -10), 40, 7, 0.22),
    flock(rng, new THREE.Vector3(-15, 120, 10), 26, 5, -0.3),
    trash(rng, [new THREE.Vector3(0, 170, 30), new THREE.Vector3(0, 110, 22), new THREE.Vector3(0, 60, 16)], 14),
    drones(rng, [new THREE.Vector3(-12, 86, 14), new THREE.Vector3(14, 70, 18), new THREE.Vector3(-6, 54, 12)]),
    chopper(new THREE.Vector3(0, 98, -40)),
    cruiser(new THREE.Vector3(3, 13, 2)),
    dog(0.8),
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
