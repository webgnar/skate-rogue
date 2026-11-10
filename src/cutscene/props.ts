// The pieces the act-break cutscenes (act-breaks.ts) are staged with, beyond the game's own models: the title's city
// with a roof to stand on, the cloud sky, a power-line pylon and its wires, a substation, the launch silo, the AI's
// billboards, sleepwalkers, a blimp, the chopper and its spotlight, Earth from orbit, sparks. Units are tiles, the
// skater about 2.5 tall (the title scene's).
import * as THREE from 'three';
import { inkify, toon } from '../render/toon';
import { model } from '../render/models';
import { makeRng } from '../gen/rng';
import { buildCity } from '../title/grid';
import { buildStreet, glowTexture, skyDome } from '../title/city';
import { FACADE } from '../title/facade';

const glow = () => glowTexture();

// the title's city at dusk: the towers, Webster's street and the brick corner building with the fire escape. Built
// once and kept (it's a couple of dozen draws, but a few hundred ms to build)
export interface CityStage {
  group: THREE.Group;
  update(t: number, dt: number): void;
}
let city: CityStage | null = null;
export function cityStage(): CityStage {
  if (city) return city;
  const group = new THREE.Group();
  const towers = buildCity();
  const street = buildStreet();
  group.add(skyDome(), towers.group, street.group);
  //a flat roof over the corner building, just under its parapet's cap, so the parapet is a low lip to stand behind
  const roof = new THREE.Mesh(new THREE.BoxGeometry(FACADE.x1 - FACADE.x0, 0.3, 9.6), toon({ color: 0x4a4458 }));
  roof.position.set(0, ROOF_Y - 0.15, -9);
  inkify(roof);
  group.add(roof);
  //roof clutter: a vent stack, an AC box, a water tank on legs
  const clutter = new THREE.Group();
  const grey = toon({ color: 0x7a7488 });
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 10), grey);
  vent.position.set(-6, ROOF_Y + 0.8, -10);
  const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.6), grey);
  ac.position.set(2, ROOF_Y + 0.6, -11);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 12), toon({ color: 0x8a5a3a }));
  tank.position.set(-14, ROOF_Y + 3.6, -10);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.55, 1, 12), toon({ color: 0x6a4a30 }));
  cap.position.set(-14, ROOF_Y + 5.4, -10);
  clutter.add(vent, ac, tank, cap);
  for (const [lx, lz] of [[-15, -11], [-13, -11], [-15, -9], [-13, -9]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.3, 0.15), grey);
    leg.position.set(lx, ROOF_Y + 1.15, lz);
    clutter.add(leg);
  }
  inkify(clutter);
  group.add(clutter);
  city = {
    group,
    update(t, dt) {
      towers.update(t, dt);
      street.update(t, dt);
    },
  };
  return city;
}

export const ROOF_Y = FACADE.top + 2.75; // the corner building's roof (under the parapet's cap, at 16.5)
// the fire escape over the corner building's right bays (facade.ts): its landings' and top rails' heights, its ends
export const ESCAPE = {
  x0: FACADE.bays[4] - 1.6,
  x1: FACADE.bays[5] + 1.6,
  rail: FACADE.floors.map((fy) => fy - FACADE.winH / 2 - 0.36 + 1.05), // each landing's top rail
  z: FACADE.face + 1.28, // the rails' line, out from the wall
};

// a cloud ceiling seen from under it, or a sea seen from above: cloud cards lying flat at height y, over a disc
export function cloudLayer(y: number, opts: { r?: number; n?: number; color?: number; seed?: number; under?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const rng = makeRng(opts.seed ?? 31);
  const r = opts.r ?? 400;
  const tex = cloudCanvas();
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: opts.color ?? 0xffffff, side: THREE.DoubleSide, fog: true });
  const geo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < (opts.n ?? 120); i++) {
    const c = new THREE.Mesh(geo, mat);
    const d = Math.sqrt(rng()) * r;
    const a = rng() * Math.PI * 2;
    c.position.set(Math.cos(a) * d, y + (rng() - 0.5) * 3, Math.sin(a) * d);
    c.rotation.set(-Math.PI / 2, 0, rng() * Math.PI * 2);
    const w = 30 + rng() * 50;
    c.scale.set(w, w * 0.7, 1);
    c.renderOrder = opts.under ? 2 : 0;
    c.userData.inked = true;
    g.add(c);
  }
  return g;
}

let cloudTex: THREE.Texture | null = null;
function cloudCanvas(): THREE.Texture {
  if (cloudTex) return cloudTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const rng = makeRng(5);
  for (let i = 0; i < 14; i++) {
    const cx = 30 + rng() * 68;
    const cy = 34 + rng() * 60;
    const rr = 18 + rng() * 22;
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.6, 'rgba(240,244,255,0.7)');
    gr.addColorStop(1, 'rgba(230,236,255,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
  }
  cloudTex = new THREE.CanvasTexture(c);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  return cloudTex;
}

// a glow sprite (lamps, eyes, the ship's light, the moon's halo)
export function glowSprite(color: number, size: number, opacity = 1): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.set(size, size, 1);
  return s;
}

// a lattice pylon, `h` tall, standing on its own origin, with cross arms near the top; returns where its wires hang
export function pylon(h: number): { group: THREE.Group; arms: THREE.Vector3[] } {
  const g = new THREE.Group();
  const steel = toon({ color: 0x6a6e7a });
  const leg = (x0: number, z0: number) => {
    const from = new THREE.Vector3(x0, 0, z0);
    const to = new THREE.Vector3(x0 * 0.18, h, z0 * 0.18);
    g.add(bar(from, to, 0.12, steel));
  };
  const w = h * 0.16;
  for (const [x, z] of [[-w, -w], [w, -w], [-w, w], [w, w]]) leg(x, z);
  //the lattice: rings and crossings up the legs
  for (let k = 0; k < 6; k++) {
    const y0 = (h * k) / 6;
    const y1 = (h * (k + 1)) / 6;
    const s0 = w * (1 - 0.82 * (k / 6));
    const s1 = w * (1 - 0.82 * ((k + 1) / 6));
    for (const side of [-1, 1]) {
      g.add(bar(new THREE.Vector3(-s0, y0, side * s0), new THREE.Vector3(s1, y1, side * s1), 0.05, steel));
      g.add(bar(new THREE.Vector3(s0, y0, side * s0), new THREE.Vector3(-s1, y1, side * s1), 0.05, steel));
      g.add(bar(new THREE.Vector3(side * s0, y0, -s0), new THREE.Vector3(side * s1, y1, s1), 0.05, steel));
    }
  }
  const arms: THREE.Vector3[] = [];
  for (const [y, span] of [[h * 0.86, h * 0.34], [h * 0.72, h * 0.28]]) {
    g.add(bar(new THREE.Vector3(0, y, -span), new THREE.Vector3(0, y, span), 0.1, steel));
    for (const z of [-span, span]) {
      arms.push(new THREE.Vector3(0, y - 0.6, z));
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), toon({ color: 0xa8b8c8 }));
      ins.position.set(0, y - 0.3, z);
      g.add(ins);
    }
  }
  inkify(g);
  return { group: g, arms };
}

// a bar between two points
export function bar(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

// a power line slung from a to b, sagging `sag` in the middle: the curve (to ride along) and its mesh
export function wire(a: THREE.Vector3, b: THREE.Vector3, sag: number): { curve: THREE.Curve<THREE.Vector3>; mesh: THREE.Mesh } {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    const p = a.clone().lerp(b, k);
    p.y -= sag * 4 * k * (1 - k);
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.06, 5), new THREE.MeshBasicMaterial({ color: 0x16141c }));
  return { curve, mesh };
}

// a rooftop substation: a fenced yard of transformers, lit when the sparks reach it (flash 0 to 1)
export function substation(): { group: THREE.Group; flash(k: number): void } {
  const g = new THREE.Group();
  const grey = toon({ color: 0x6a7080 });
  const dark = toon({ color: 0x3a3e4a });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 6), dark);
  pad.position.y = 0.15;
  g.add(pad);
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 1.6), grey);
    t.position.set(-2.8 + i * 2.8, 1.4, -0.8);
    g.add(t);
    for (const dx of [-0.5, 0, 0.5]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6), toon({ color: 0xa8b8c8 }));
      ins.position.set(-2.8 + i * 2.8 + dx, 2.95, -0.8);
      g.add(ins);
    }
  }
  //the fence: posts and two wires
  const fence = toon({ color: 0x8a8e98 });
  for (let x = -4.4; x <= 4.41; x += 1.1) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), fence);
    p.position.set(x, 0.95, 2.9);
    g.add(p);
  }
  g.add(bar(new THREE.Vector3(-4.4, 1.6, 2.9), new THREE.Vector3(4.4, 1.6, 2.9), 0.03, fence));
  g.add(bar(new THREE.Vector3(-4.4, 1.0, 2.9), new THREE.Vector3(4.4, 1.0, 2.9), 0.03, fence));
  inkify(g);
  const halo = glowSprite(0x9ff0ff, 18, 0);
  halo.position.set(0, 2.5, 0);
  g.add(halo);
  const bolt = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-3, 3, -0.8], [-1.6, 4.4, 0], [0, 3.4, 0.2], [1.4, 4.8, -0.4], [2.8, 3, -0.8]].map(([x, y, z]) => new THREE.Vector3(x, y, z))), 24, 0.08, 4),
    new THREE.MeshBasicMaterial({ color: 0xeaffff, transparent: true, opacity: 0 }),
  );
  g.add(bolt);
  return {
    group: g,
    flash(k) {
      halo.material.opacity = k;
      (bolt.material as THREE.MeshBasicMaterial).opacity = k > 0.3 ? 1 : 0;
    },
  };
}

// the launch silo under the hero street: two doors that slide apart over a dark shaft (open 0 to 1)
export function silo(): { group: THREE.Group; open(k: number): void } {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 12, 24, 1, true), toon({ color: 0x222028, side: THREE.BackSide }));
  shaft.position.y = -6;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff8a3a }));
  floor.position.y = -11.5;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.25, 6, 32).rotateX(Math.PI / 2), toon({ color: 0xd8c040 }));
  rim.position.y = 0.05;
  g.add(shaft, floor, rim);
  const doorMat = toon({ color: 0x3a3a44 });
  const doors = [-1, 1].map((side) => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 7), doorMat);
    d.position.set(side * 1.7, 0.1, 0);
    //hazard stripes along the meeting edge
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.27, 7), toon({ color: 0xe8c030 }));
    stripe.position.x = -side * 1.5;
    d.add(stripe);
    g.add(d);
    return { d, side };
  });
  inkify(g);
  return {
    group: g,
    open(k) {
      for (const { d, side } of doors) d.position.x = side * (1.7 + k * 3.6);
    },
  };
}

// one of the AI's billboards on a pole: its screen shows `face` (a texture: the skater, live) under a red scan, with
// a line of text; `state` 0 shows the old slogan, 1 the new
export function billboard(w: number, h: number, slogan: string, text: string, face: THREE.Texture | null): { group: THREE.Group; set(k: number, t: number): void } {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, h + 0.6, 0.5), toon({ color: 0x24222c }));
  frame.position.z = -0.3;
  g.add(frame);
  for (const x of [-w * 0.3, w * 0.3]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, h * 1.2, 0.4), toon({ color: 0x3a3844 }));
    leg.position.set(x, -h * 1.1, -0.4);
    g.add(leg);
  }
  inkify(g);
  const old = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sloganTexture(slogan, '#7fd7ff', '#0c1a2a'), fog: false }));
  const red = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sloganTexture('', '#ff3a3a', '#1a0508'), fog: false }));
  const pic = face ? new THREE.Mesh(new THREE.PlaneGeometry(h * 0.78, h * 0.78), new THREE.MeshBasicMaterial({ map: face, color: 0xff9a8a, fog: false })) : null;
  if (pic) pic.position.set(0, h * 0.08, 0.01);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(w, h * 0.22), new THREE.MeshBasicMaterial({ map: sloganTexture(text, '#ff3a3a', 'rgba(0,0,0,0)'), transparent: true, fog: false }));
  line.position.set(0, -h * 0.38, 0.02);
  g.add(old, red);
  if (pic) g.add(pic);
  g.add(line);
  return {
    group: g,
    set(k, t) {
      //the flip: a glitch from the old slogan to the face, a few frames of each
      const glitch = k > 0 && k < 1;
      const showNew = k >= 1 || (glitch && Math.floor(t * 24) % 3 !== 0 && k > 0.4);
      old.visible = !showNew;
      red.visible = showNew;
      if (pic) pic.visible = showNew;
      line.visible = showNew;
      old.position.x = glitch ? (Math.sin(t * 90) * 0.3) : 0;
    },
  };
}

function sloganTexture(text: string, color: string, bg: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = bg;
  x.fillRect(0, 0, 512, 128);
  //scan lines
  if (bg !== 'rgba(0,0,0,0)') {
    x.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < 128; y += 4) x.fillRect(0, y, 512, 1);
  }
  x.fillStyle = color;
  x.font = "bold 62px 'Consolas', 'Courier New', monospace";
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  let size = 62;
  while (x.measureText(text).width > 480 && size > 20) {
    size -= 4;
    x.font = `bold ${size}px 'Consolas', 'Courier New', monospace`;
  }
  x.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a sleepwalker: head down over a glowing phone, or (look 1) head tipped back, staring up, their face lit `light`
export function sleepwalker(seed: number, cop = false): { group: THREE.Group; look(k: number, light: number): void } {
  const rng = makeRng(seed);
  const g = new THREE.Group();
  const tops = [0x3a7be8, 0xd94a4a, 0x48b86a, 0xe8c33a, 0xf0f0f0, 0x2a2a34, 0x8a5ad8];
  const skin = [0xf0c8a8, 0xd8a888, 0xc8946a, 0x9a6a48, 0x6a4430][Math.floor(rng() * 5)];
  const top = toon({ color: cop ? 0x1d2a4a : tops[Math.floor(rng() * tops.length)] });
  const pants = toon({ color: cop ? 0x161c30 : [0x2a2a34, 0x3a4a6a, 0x5a4a3a][Math.floor(rng() * 3)] });
  for (const x of [-0.17, 0.17]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.1, 0.3), pants);
    leg.position.set(x, 0.55, 0);
    g.add(leg);
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.4), top);
  body.position.y = 1.55;
  g.add(body);
  const neck = new THREE.Group();
  neck.position.y = 2.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), toon({ color: skin }));
  head.position.y = 0.25;
  neck.add(head);
  if (cop) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.16, 12), toon({ color: 0x161c30 }));
    hat.position.y = 0.48;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.24), toon({ color: 0x0c0e18 }));
    brim.position.set(0, 0.4, 0.25);
    neck.add(hat, brim);
  }
  g.add(neck);
  //the arm up to the phone in front of the face
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.18), top);
  arm.position.set(0.3, 1.55, 0.28);
  arm.rotation.x = -1.1;
  g.add(arm);
  const other = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), top);
  other.position.set(-0.45, 1.5, 0);
  g.add(other);
  const phoneMat = new THREE.MeshBasicMaterial({ color: 0x7fb2ff });
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.04), phoneMat);
  phone.position.set(0.22, 1.85, 0.62);
  phone.rotation.x = -0.6;
  g.add(phone);
  inkify(g);
  const faceGlow = glowSprite(0x7fb2ff, 1.4, 0.55);
  faceGlow.position.set(0, 2.25, 0.35);
  g.add(faceGlow);
  return {
    group: g,
    look(k, light) {
      neck.rotation.x = 0.45 * (1 - k) - 0.7 * k; // head down over the phone, then tipped back
      faceGlow.material.color.setHex(k > 0.5 ? light : 0x7fb2ff);
      faceGlow.position.set(0, 2.25 + k * 0.15, 0.35 - k * 0.1);
      faceGlow.scale.setScalar(1.4 + k * 0.6);
      phone.visible = k < 0.5;
      phoneMat.color.setHex(0x7fb2ff);
    },
  };
}

// the police chopper (the Blender one, art/chopper.py; a box stand-in without it), facing +x, with its spotlight: a
// cone of light hanging under it that can be aimed at a point
export function chopper(): { group: THREE.Group; aim(at: THREE.Vector3 | null, dt: number): void } {
  const g = new THREE.Group();
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
    const dark = new THREE.MeshLambertMaterial({ color: 0x1d1f28 });
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), dark);
    pod.scale.set(1.5, 0.75, 0.8);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.18), dark);
    tail.position.set(-1.8, 0.15, 0);
    body.add(pod, tail);
  }
  inkify(body);
  const blur = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.03, 24), new THREE.MeshBasicMaterial({ color: 0x9aa0b0, transparent: true, opacity: 0.15, depthWrite: false }));
  blur.position.y = hull ? 0.84 : 0.65;
  body.add(blur);
  g.add(body);
  //the beam: a long cone, its apex at the chopper's nose, pointing down its own -y until aimed
  const len = 40;
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(3.2, len, 24, 1, true).translate(0, -len / 2, 0), beamMat);
  const pivot = new THREE.Group();
  pivot.position.set(0.8, -0.4, 0);
  pivot.add(beam);
  g.add(pivot);
  const lamp = glowSprite(0xfff4c0, 2.5);
  lamp.position.copy(pivot.position);
  g.add(lamp);
  let spin = 0;
  const down = new THREE.Vector3(0, -1, 0);
  return {
    group: g,
    aim(at, dt) {
      spin += dt;
      rotors.forEach((r, i) => (r.rotation.y = spin * (i ? 30 : 22)));
      pivot.visible = lamp.visible = !!at;
      if (!at) return;
      g.updateMatrixWorld(true);
      const from = pivot.getWorldPosition(new THREE.Vector3());
      const dir = at.clone().sub(from);
      const dist = dir.length();
      dir.normalize();
      //into the chopper's space
      const inv = new THREE.Quaternion().copy(g.getWorldQuaternion(new THREE.Quaternion())).invert();
      pivot.quaternion.setFromUnitVectors(down, dir.applyQuaternion(inv));
      beam.scale.set(1, dist / len, 1);
    },
  };
}

// a blimp, its back the deck: a silver envelope `w` long, navy fins, a cabin under it. Its top is at y 0, nose +x
export function blimp(w = 14): THREE.Group {
  const g = new THREE.Group();
  const r = 2.4;
  const silver = toon({ color: 0xc8ccd6 });
  const navy = toon({ color: 0x1e2a5a });
  const env = new THREE.Mesh(new THREE.CapsuleGeometry(r, w, 8, 24).rotateZ(Math.PI / 2), silver);
  env.position.y = -r;
  g.add(env);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.02, r + 0.02, w * 0.5, 24, 1, true).rotateZ(Math.PI / 2), navy);
  band.position.y = -r;
  band.scale.set(1, 1, 1);
  g.add(band);
  for (const rx of [0, Math.PI / 2]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(3, r * 3.2, 0.18).rotateX(rx), navy);
    fin.position.set(-w / 2 - r * 0.4, -r, 0);
    g.add(fin);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1, 1.3), toon({ color: 0xa8acb8 }));
  cabin.position.set(0.8, -2 * r - 0.4, 0);
  g.add(cabin);
  inkify(g);
  return g;
}

// Earth from orbit, under the camera: a huge blue sphere with land and cloud, and the thin blue air round its rim
export function earth(radius: number): THREE.Group {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#2a64c0';
  x.fillRect(0, 0, 512, 256);
  const rng = makeRng(11);
  for (let i = 0; i < 26; i++) {
    x.fillStyle = rng() > 0.4 ? '#4f8a3a' : '#9a8a54';
    x.beginPath();
    x.ellipse(rng() * 512, 40 + rng() * 176, 20 + rng() * 60, 10 + rng() * 34, rng() * 3, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 60; i++) {
    x.beginPath();
    x.ellipse(rng() * 512, rng() * 256, 10 + rng() * 40, 3 + rng() * 6, rng() * 0.4, 0, Math.PI * 2);
    x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), new THREE.MeshLambertMaterial({ map: tex, emissive: 0x0a1830, fog: false }));
  g.add(ball);
  const air = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.025, 64, 32),
    new THREE.MeshBasicMaterial({ color: 0x7ac8ff, transparent: true, opacity: 0.35, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  g.add(air);
  return g;
}

// sparks: a little pool of glowing sprites thrown from a point, falling and fading
export class Sparks {
  readonly group = new THREE.Group();
  private readonly bits: { s: THREE.Sprite; v: THREE.Vector3; life: number }[] = [];
  private readonly rng = makeRng(77);
  constructor(n = 60, private readonly size = 0.35) {
    for (let i = 0; i < n; i++) {
      const s = glowSprite(i % 3 ? 0xffe066 : 0xffffff, size);
      s.visible = false;
      this.group.add(s);
      this.bits.push({ s, v: new THREE.Vector3(), life: 0 });
    }
  }
  emit(at: THREE.Vector3, count: number, speed = 6): void {
    let left = count;
    for (const b of this.bits) {
      if (left <= 0) break;
      if (b.life > 0) continue;
      left--;
      b.life = 0.3 + this.rng() * 0.4;
      b.s.position.copy(at);
      const a = this.rng() * Math.PI * 2;
      b.v.set(Math.cos(a) * speed * this.rng(), speed * (0.3 + this.rng()), Math.sin(a) * speed * this.rng());
      b.s.visible = true;
    }
  }
  update(dt: number): void {
    for (const b of this.bits) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.v.y -= 18 * dt;
      b.s.position.addScaledVector(b.v, dt);
      b.s.visible = b.life > 0;
      b.s.scale.setScalar(this.size * Math.min(1, b.life * 3));
    }
  }
}

// a street quarterpipe: a quarter-circle transition of radius r rising toward +x from its foot at x 0, a deck behind
// the coping, w wide (from z 0 to w)
export function quarterpipe(r: number, w: number): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(r + 1.4, 0);
  shape.lineTo(r + 1.4, r);
  shape.lineTo(r, r);
  //the transition: from the coping down round the quarter circle (centre at (0, r)) to the foot
  shape.absarc(0, r, r, 0, -Math.PI / 2, true);
  const ramp = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 20 }), toon({ color: 0x8a8fa8 }));
  g.add(ramp);
  const coping = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, w, 10).rotateX(Math.PI / 2), toon({ color: 0xd8dce6 }));
  coping.position.set(r, r, w / 2);
  g.add(coping);
  //the frame's legs under the deck at the back, and a strip of paint across the transition's foot
  const leg = toon({ color: 0x4a4e66 });
  for (const z of [0.15, w - 0.15]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, r, 0.16), leg);
    post.position.set(r + 1.3, r / 2, z);
    g.add(post);
  }
  inkify(g);
  return g;
}
