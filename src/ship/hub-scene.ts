// The ship as the home between runs (GDD: The fantasy, "The ship is the home between runs"; the climb's step e).
// Inside the Pleiadian saucer's glass dome: a DIY spot the crew built from city scrap (a pallet quarter pipe, a rail
// that was a street sign, cones, milk crates, the Flock camera they pulled off a pole), the Stoken core in the middle
// burning brighter the more Stoken you've banked (it's the ship's fuel), and Earth hanging outside the glass.
// The crew are aboard: every skater you've unlocked dances to the beat, the one you ride out front twirling their
// board; the skaters still to be woken stand as dark silhouettes, heads down.
//
// Drawn with the game's renderer in its own THREE.Scene, like the title (src/title/title-scene.ts): behind the run
// summary and the unlocks screen, and as the last shots of the Chapter 1 ending (src/ship/ending-scene.ts).
// Cosmetic only: nothing here changes a run. Units are the game's tiles (a skater is about 2.5 tall).
import * as THREE from 'three';
import type { Pose } from '../render/poses';
import { SCALE, SKATERS, type SkaterId, type SkaterRig } from '../render/skater-rig';
import { SKATER_HALO, SKATER_INK, PAPER } from '../game/game';
import { glowMaterial, INK, inkify, outlineMaterial, setInkLens, setInkResolution, silhouetteInk, toon } from '../render/toon';
import { glowTexture } from '../title/city';
import { danceAt, dancePoses } from '../title/dance';
import { makeRng } from '../gen/rng';
import { batchStatic } from '../render/batch';

export const HUB = {
  floorR: 17, // the deck inside the dome
  domeR: 17.5,
  beat: 60 / 105, // the crew dance to the title music's tempo
  spin: 8, // the rider's board twirl, radians a second (as Webster's on the title)
  // the Stoken core's flame: its size at no Stoken, and at `full` banked and over
  flameMin: 0.45,
  flameMax: 1.05,
  full: 300,
};

// where everyone stands, x and z, and which way they face (radians about y; 0 faces the camera, +z): out to either
// side, so the run summary's column down the middle of the screen leaves them in view. The ending stands the rider
// in the middle instead (CENTRE)
const SPOTS: { x: number; z: number; face: number }[] = [
  { x: -6.2, z: 2.2, face: 0.35 }, // the one you ride, out front
  { x: 6.4, z: 1.6, face: -0.4 },
  { x: -4.6, z: -3.2, face: 0.3 },
  { x: 8.4, z: -2.4, face: -0.55 },
  { x: 3.4, z: -3.6, face: -0.2 },
];
const CENTRE = { x: 0, z: 2.6, face: 0 };

// the camera's two framings: wide on the whole spot (the run summary), and in on the crew (the unlocks screen)
type Shot = { at: THREE.Vector3; look: THREE.Vector3; fov: number };
const SHOTS: Record<'wide' | 'crew', { wide: Shot; tall: Shot }> = {
  wide: {
    wide: { at: new THREE.Vector3(0, 4.4, 13.5), look: new THREE.Vector3(0, 3.4, -2), fov: 56 },
    tall: { at: new THREE.Vector3(0, 6.2, 14.5), look: new THREE.Vector3(0, 2.4, -2), fov: 76 },
  },
  crew: {
    wide: { at: new THREE.Vector3(0, 2.8, 9.5), look: new THREE.Vector3(0, 2.3, -1), fov: 64 },
    tall: { at: new THREE.Vector3(0, 2.8, 12), look: new THREE.Vector3(0, 2.3, -1), fov: 66 },
  },
};

type Member = { id: SkaterId; rig: SkaterRig; keys: Pose[]; awake: boolean; rider: boolean; offset: number; spot: { x: number; z: number; face: number } };
// an upright phone's frame is narrow: the crew stand this much closer in on it
const TALL_SQUEEZE = 0.55;

export class HubScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.3, 3000);
  readonly window = new THREE.Group(); // what's outside the glass: Earth, the stars, the Pleiades
  readonly earth: THREE.Group;
  readonly stars: THREE.Points;
  readonly pleiades: THREE.Group;
  private readonly flame: THREE.Mesh;
  private readonly electrons: THREE.Mesh[] = [];
  private readonly coreLight: THREE.PointLight;
  private members: Member[] = [];
  private t = 0;
  private spin = 0;
  private fuel = 0; // the flame's size, 0 to 1, easing to the bank
  private fuelTo = 0;
  private shot: 'wide' | 'crew' = 'wide';
  private cam = { at: new THREE.Vector3(), look: new THREE.Vector3(), fov: 52 };
  private camSet = false;
  // the camera's framing can be taken over (the ending's shots)
  hold: Shot | null = null;
  // the rider's height off the deck (the ending drops them in through the floor's light)
  riderUp = 0;
  // the rider stood in the middle of the spot (the ending) rather than out to the side
  riderCentre = false;
  //the crew's ink as the game's skater: black round each of them, a paper-white halo outside it
  private readonly ink = [glowMaterial(SKATER_INK, INK.color, 0), glowMaterial(SKATER_INK, INK.color, 0)];
  private readonly halo = [glowMaterial(SKATER_INK, PAPER, 0), glowMaterial(SKATER_INK, PAPER, 0)] as [THREE.ShaderMaterial, THREE.ShaderMaterial];
  private readonly sleepBody = new THREE.MeshBasicMaterial({ color: 0x1a1030 });
  private readonly sleepBoard = new THREE.MeshBasicMaterial({ color: 0x1a1030 });

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    const s = this.scene;
    s.background = new THREE.Color(0x06040e);
    s.add(this.window);
    this.stars = starfield();
    this.window.add(this.stars);
    this.pleiades = pleiades();
    this.window.add(this.pleiades);
    this.earth = earth();
    this.window.add(this.earth);
    const spot = new THREE.Group();
    spot.name = 'spot';
    s.add(spot);
    //the deck, the dome and the scrap never move: merged a mesh per look (batch.ts), ~85 draws down to ~25
    const still = new THREE.Group();
    deck(still);
    dome(still);
    scrap(still);
    batchStatic(still);
    spot.add(still);
    const core = stokenCore();
    this.flame = core.flame;
    this.electrons = core.electrons;
    spot.add(core.group);
    inkify(spot);
    //light: the violet glass overhead, Earth's blue from the side, and the Stoken flame's warm glow
    s.add(new THREE.HemisphereLight(0xc8b0ff, 0x30204a, 1.5));
    const earthLight = new THREE.DirectionalLight(0x9fd0ff, 1.6);
    earthLight.position.set(-60, 30, 40);
    s.add(earthLight);
    this.coreLight = new THREE.PointLight(0xff9a40, 18, 16, 1.6);
    this.coreLight.position.set(0, 2.5, -6.5);
    s.add(this.coreLight);
  }

  // the crew aboard: `rigs` for each skater (loaded by whoever made the hub), `awake` the unlocked ones, `rider`
  // the one you ride. Safe to call again when the unlocks change
  setCrew(rigs: Partial<Record<SkaterId, SkaterRig>>, awake: (id: SkaterId) => boolean, rider: SkaterId): void {
    for (const m of this.members) m.rig.mesh.removeFromParent();
    const order = [rider, ...SKATERS.filter((id) => id !== rider)];
    this.members = [];
    order.forEach((id, i) => {
      const rig = rigs[id];
      if (!rig) return;
      const on = awake(id);
      const spot = SPOTS[i];
      if (!rig.mesh.userData.hubInked) {
        rig.mesh.userData.hubInked = true;
        inkify(rig.mesh, { toon: false });
        rig.mesh.userData.looks = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
        rig.mesh.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && !m.userData.ink) rig.mesh.userData.looks.set(m, m.material);
        });
        silhouetteInk(rig.mesh, rig.boardGroup, outlineMaterial(), this.ink[0], this.ink[1], this.halo);
      }
      //asleep: one dark shape, no face to read; awake: their own colours back
      const board = new Set<THREE.Object3D>();
      rig.boardGroup.traverse((o) => board.add(o));
      for (const [mesh, look] of rig.mesh.userData.looks as Map<THREE.Mesh, THREE.Material | THREE.Material[]>) {
        mesh.material = on ? look : board.has(mesh) ? this.sleepBoard : this.sleepBody;
      }
      rig.mesh.position.set(spot.x, 0, spot.z);
      rig.mesh.rotation.y = spot.face;
      rig.mesh.scale.setScalar(SCALE);
      this.scene.add(rig.mesh);
      this.members.push({ id, rig, keys: dancePoses(rig, on ? (i === 0 ? 1 : 0.8) : 0, !on), awake: on, rider: i === 0, offset: i * 0.37, spot });
    });
    for (const m of [this.sleepBody, this.sleepBoard]) {
      m.stencilWrite = true;
      m.stencilFunc = THREE.AlwaysStencilFunc;
      m.stencilZPass = THREE.ReplaceStencilOp;
    }
    this.sleepBody.stencilRef = 1;
    this.sleepBoard.stencilRef = 2;
  }

  // the Stoken you've banked: the core's flame grows with it
  setBank(stoken: number, now = false): void {
    this.fuelTo = Math.min(1, Math.max(0, stoken) / HUB.full);
    if (now) this.fuel = this.fuelTo;
  }

  look(shot: 'wide' | 'crew'): void {
    this.shot = shot;
  }

  // a frame of the hub: posed, then drawn
  frame(dt: number): void {
    this.pose(dt);
    this.render();
  }

  // everything frame() does but the draw: the crew posed and placed, the core and the camera moved on
  pose(dt: number): void {
    this.t += dt;
    this.spin += dt * HUB.spin;
    this.fuel += (this.fuelTo - this.fuel) * Math.min(1, dt * 1.5);
    const beats = this.t / HUB.beat;
    const css = this.renderer.domElement;
    const squeeze = css.clientWidth < css.clientHeight ? TALL_SQUEEZE : 1;
    for (const m of this.members) {
      const p = danceAt(m.keys, beats + m.offset);
      m.rig.preview(p);
      const at = m.rider && this.riderCentre ? CENTRE : m.spot;
      m.rig.mesh.position.set(at.x * squeeze, m.rider ? this.riderUp : 0, at.z);
      m.rig.mesh.rotation.y = at.face * squeeze;
      if (m.rider) m.rig.boardGroup.rotation.x = this.spin;
      m.rig.mesh.scale.setScalar(SCALE);
    }
    //the core: the flame flickers and grows with the bank, the electrons ride their orbits
    const f = HUB.flameMin + (HUB.flameMax - HUB.flameMin) * this.fuel;
    const flick = 1 + Math.sin(this.t * 13) * 0.04 + Math.sin(this.t * 7.3) * 0.05;
    this.flame.scale.set(f * flick, f * 1.5 * (2 - flick), f * flick);
    this.coreLight.intensity = 10 + 16 * this.fuel;
    this.electrons.forEach((e, i) => {
      const a = this.t * (2.2 + i * 0.3) + (i * Math.PI * 2) / 3;
      e.position.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0);
    });
    this.earth.rotation.y += dt * 0.01;
    this.place(dt);
  }

  private place(dt: number): void {
    const css = this.renderer.domElement;
    this.camera.aspect = css.clientWidth / Math.max(1, css.clientHeight);
    const want = this.hold ?? SHOTS[this.shot][this.camera.aspect < 1 ? 'tall' : 'wide'];
    const k = this.camSet && !this.hold ? Math.min(1, dt * 2.5) : 1;
    this.camSet = true;
    this.cam.at.lerp(want.at, k);
    this.cam.look.lerp(want.look, k);
    this.cam.fov += (want.fov - this.cam.fov) * k;
    //a slow drift round the spot, so it's never a still
    const drift = this.hold ? 0 : 1;
    this.camera.position.copy(this.cam.at);
    this.camera.position.x += Math.sin(this.t * 0.18) * 1.6 * drift;
    this.camera.position.y += Math.sin(this.t * 0.23) * 0.25 * drift;
    this.camera.lookAt(this.cam.look);
    this.camera.fov = this.cam.fov;
  }

  // the rig you ride, to borrow for the ending's shots outside (put it back with setCrew)
  get rider(): SkaterRig | null {
    return this.members.find((m) => m.rider)?.rig ?? null;
  }

  // the crew's ink widths for this frame (the ending draws the rider in its own scene with the same ink)
  inkWidths(): void {
    const px = this.renderer.getPixelRatio();
    for (const m of this.ink) m.uniforms.uWidth.value = Math.max(1, SKATER_INK * px);
    for (const m of this.halo) m.uniforms.uWidth.value = Math.max(1.5, SKATER_INK * (1 + SKATER_HALO) * px);
  }

  render(): void {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    this.camera.updateProjectionMatrix();
    setInkLens(0, 1, 1);
    setInkResolution(size.x, size.y, r.getPixelRatio());
    this.inkWidths();
    r.setRenderTarget(null);
    r.clear();
    r.render(this.scene, this.camera);
  }
}

// ---- the pieces ----

// the deck: the saucer's pearl floor, a plywood spot in the middle the crew laid down, a ring of lights at the rim
function deck(g: THREE.Group): void {
  const floor = new THREE.Mesh(new THREE.CircleGeometry(HUB.floorR, 48), toon({ color: 0xcfc6e6 }));
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);
  const ply = toon({ color: 0xc89a5e });
  const seam = toon({ color: 0x9a7040 });
  //plywood sheets, 2.4 x 1.2, a little askew, as if dragged in one at a time
  const rng = makeRng(11);
  for (let i = 0; i < 7; i++) {
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 5.2), i % 2 ? ply : seam.clone());
    (sheet.material as THREE.MeshToonMaterial).color.set(i % 2 ? 0xc89a5e : 0xb88a50);
    sheet.position.set(-7.8 + i * 2.6, 0.03, 1.2 + (rng() - 0.5) * 0.3);
    sheet.rotation.y = (rng() - 0.5) * 0.04;
    g.add(sheet);
  }
  const lamp = new THREE.MeshBasicMaterial({ color: 0xbfe8ff });
  const n = 40;
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), lamp, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    lights.setMatrixAt(i, m.makeTranslation(Math.cos(a) * (HUB.floorR - 0.3), 0.08, Math.sin(a) * (HUB.floorR - 0.3)));
  }
  g.add(lights);
}

// the dome: violet glass you can see the stars through, and pearl ribs holding it up
function dome(g: THREE.Group): void {
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(HUB.domeR, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x9a5cff, transparent: true, opacity: 0.1, side: THREE.BackSide, depthWrite: false }),
  );
  g.add(glass);
  const rib = toon({ color: 0xe8e4f4, emissive: 0x2a2440 });
  for (let i = 0; i < 8; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(HUB.domeR, 0.13, 6, 40, Math.PI), rib);
    arc.rotation.y = (i / 8) * Math.PI;
    g.add(arc);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(HUB.domeR, 0.3, 8, 64), rib);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
}

// a sign's face on a canvas: the street sign the rail was, and the Flock camera's dead screen
function signTexture(text: string, bg: string, fg: string, w = 256, h = 64): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.strokeStyle = fg;
  x.lineWidth = 4;
  x.strokeRect(5, 5, w - 10, h - 10);
  x.fillStyle = fg;
  x.font = `bold ${Math.round(h * 0.55)}px Bangers, 'Arial Black', sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// the DIY spot, all of it carried up from the city: a pallet quarter pipe, a rail that was a street sign on two
// cinder blocks, traffic cones, milk crates, and the Flock camera they pulled off its pole, dead
function scrap(g: THREE.Group): void {
  const wood = toon({ color: 0xb98a52 });
  const dark = toon({ color: 0x7a5530 });
  //the quarter pipe, stage left, facing in: slats round a quarter circle on two pallet sides
  const qp = new THREE.Group();
  const R = 2.4;
  const W = 3.6;
  //its two pallet sides: the quarter circle's profile, cut from plywood
  const profile = new THREE.Shape();
  profile.moveTo(R + 0.3, 0);
  profile.absarc(R, R, R, -Math.PI / 2, -Math.PI, true);
  profile.lineTo(0, R + 0.1);
  profile.lineTo(-0.3, R + 0.1);
  profile.lineTo(-0.3, 0);
  profile.lineTo(R + 0.3, 0);
  const sideGeo = new THREE.ExtrudeGeometry(profile, { depth: 0.12, bevelEnabled: false, curveSegments: 12 });
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, W), i % 3 ? wood : dark);
    slat.position.set(R - Math.sin(a) * R, R - Math.cos(a) * R + 0.04, 0);
    slat.rotation.z = -a;
    qp.add(slat);
  }
  for (const z of [-W / 2, W / 2]) {
    const side = new THREE.Mesh(sideGeo, dark);
    side.position.set(0, 0, z - 0.06);
    qp.add(side);
  }
  const coping = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, W + 0.2, 8), toon({ color: 0xb8b8c8 }));
  coping.rotation.x = Math.PI / 2;
  coping.position.set(0.05, R + 0.06, 0);
  qp.add(coping);
  qp.position.set(-9.4, 0, 0.6); // its curve faces +x, into the spot
  g.add(qp);
  //the street-sign rail, stage right: the sign's pole laid across two cinder blocks, the sign still bolted to its end
  const block = toon({ color: 0x8a8a92 });
  const rail = new THREE.Group();
  for (const x of [-1.8, 1.8]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.8), block);
    b.position.set(x, 0.21, 0);
    rail.add(b);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.6, 10), toon({ color: 0x6a7a70 }));
  pole.rotation.z = Math.PI / 2;
  pole.position.y = 0.5;
  rail.add(pole);
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.38, 0.03),
    [block, block, block, block, new THREE.MeshToonMaterial({ map: signTexture('WEBSTER AVE', '#127a3a', '#ffffff') }), block],
  );
  plate.position.set(2.5, 0.7, 0);
  plate.rotation.z = 0.25;
  rail.add(plate);
  rail.position.set(6.6, 0, 3.2);
  rail.rotation.y = -0.35;
  g.add(rail);
  //cones
  const orange = toon({ color: 0xff6a1a });
  const white = toon({ color: 0xf4f4f4 });
  for (const [x, z, tip] of [[-5.2, 4.4, 0], [5.8, -0.8, 0], [8.4, 1.4, 1.2]] as const) {
    const cone = new THREE.Group();
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 14), orange);
    c.position.y = 0.42;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 14), white);
    band.position.y = 0.48;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.6), orange);
    foot.position.y = 0.03;
    cone.add(c, band, foot);
    cone.position.set(x, 0, z);
    cone.rotation.z = tip;
    if (tip) cone.position.y = 0.25;
    g.add(cone);
  }
  //milk crates, a stack of two and one on its own
  const crate = toon({ color: 0x2a6adf });
  for (const [x, y, z, r] of [[-6.8, 0.26, -3.2, 0.2], [-6.75, 0.78, -3.15, -0.1], [7.6, 0.26, -2.6, 0.5]] as const) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.52, 0.6), crate);
    box.position.set(x, y, z);
    box.rotation.y = r;
    g.add(box);
  }
  //the Flock camera, off its pole and dead on the floor: NO SIGNAL
  const cam = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5), toon({ color: 0x2a2a34 }));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.2, 14), toon({ color: 0x101018 }));
  lens.rotation.z = Math.PI / 2;
  lens.position.x = 0.52;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.22), new THREE.MeshBasicMaterial({ map: signTexture('NO SIGNAL', '#1a0408', '#ff3a4a', 256, 72) }));
  screen.position.set(0, 0.05, 0.26);
  cam.add(body, lens, screen);
  cam.position.set(4.4, 0.25, 5.0);
  cam.rotation.set(0, -0.3, 0.12);
  g.add(cam);
}

// the Stoken core: the ship's fuel, a flame burning in a violet glass column, three electrons riding round it, the
// Stoken particle grown to the size of a room
function stokenCore(): { group: THREE.Group; flame: THREE.Mesh; electrons: THREE.Mesh[] } {
  const g = new THREE.Group();
  g.name = 'stokenCore';
  g.position.set(0, 0, -6.5);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 0.6, 32), toon({ color: 0xe8e4f4, emissive: 0x2a2440 }));
  base.position.y = 0.3;
  g.add(base);
  const cap = base.clone();
  cap.position.y = 5.2;
  cap.scale.set(0.9, 0.6, 0.9);
  g.add(cap);
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 4.4, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xb070ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  glass.position.y = 2.8;
  g.add(glass);
  //the flame: three shells, outside in, red to gold to white hot
  const flame = new THREE.Group() as unknown as THREE.Mesh;
  for (const [r, color] of [[1, 0xff4a1c], [0.7, 0xffb21a], [0.4, 0xfff6c8]] as const) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: r === 1, opacity: r === 1 ? 0.85 : 1 }));
    m.userData.inked = true;
    flame.add(m);
  }
  flame.position.y = 2.7;
  g.add(flame);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff9a40, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(5);
  halo.position.y = 2.7;
  g.add(halo);
  const electrons: THREE.Mesh[] = [];
  const ring = new THREE.MeshBasicMaterial({ color: 0x8af6ff, transparent: true, opacity: 0.5 });
  const dot = new THREE.MeshBasicMaterial({ color: 0xd0fdff });
  for (let i = 0; i < 3; i++) {
    const orbit = new THREE.Group();
    orbit.position.y = 2.7;
    orbit.rotation.set(1.15, (i * Math.PI * 2) / 3, 0, 'YXZ');
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.025, 6, 48), ring);
    r.userData.inked = true;
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), dot);
    orbit.add(r, e);
    electrons.push(e);
    g.add(orbit);
  }
  return { group: g, flame, electrons };
}

// ---- outside the glass ----

function starfield(): THREE.Points {
  const rng = makeRng(7);
  const n = 1400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rng() * 2 - 1;
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * r * 1200, u * 1200, Math.sin(a) * r * 1200], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false }));
  stars.name = 'stars';
  stars.frustumCulled = false;
  return stars;
}

// the Pleiades: seven blue-white stars in a tight cluster, high over the far side of the dome (where the ending
// turns the ship to)
export const PLEIADES_AT = new THREE.Vector3(260, 420, -900);
function pleiades(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pleiades';
  const at = [[0, 0], [22, 9], [40, -4], [30, -22], [-14, -16], [8, 26], [52, 18]];
  const tex = glowTexture();
  for (const [x, y] of at) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xa8d8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set(x, y, 0);
    s.scale.setScalar(34);
    g.add(s);
  }
  g.position.copy(PLEIADES_AT);
  g.lookAt(0, 0, 0);
  return g;
}

// Earth below the ship: oceans, continents and cloud bands painted on a canvas, the night side's cities glowing,
// and a thin blue rim of air
function earthTexture(): THREE.Texture {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.fillStyle = '#1e4fa8';
  x.fillRect(0, 0, w, h);
  const rng = makeRng(3);
  //continents: clumps of round blobs
  for (let k = 0; k < 9; k++) {
    const cx = rng() * w;
    const cy = h * 0.2 + rng() * h * 0.6;
    x.fillStyle = k % 3 ? '#3f8a3e' : '#9a8a4a';
    for (let i = 0; i < 18; i++) {
      x.beginPath();
      x.arc(cx + (rng() - 0.5) * 90, cy + (rng() - 0.5) * 50, 6 + rng() * 18, 0, Math.PI * 2);
      x.fill();
    }
  }
  //ice caps and cloud swirls
  x.fillStyle = '#f4f8ff';
  x.fillRect(0, 0, w, 10);
  x.fillRect(0, h - 10, w, 10);
  x.globalAlpha = 0.55;
  for (let i = 0; i < 60; i++) {
    x.beginPath();
    x.ellipse(rng() * w, rng() * h, 10 + rng() * 40, 3 + rng() * 6, (rng() - 0.5) * 0.4, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function earth(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'earth';
  const R = 220;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), new THREE.MeshLambertMaterial({ map: earthTexture() }));
  ball.userData.inked = true;
  g.add(ball);
  const air = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x6ab8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  air.scale.setScalar(R * 2.9);
  g.add(air);
  g.position.set(-330, -150, -760);
  ball.rotation.z = 0.4;
  return g;
}
