// The shop's card art (openspec/changes/ui3-shop-look): each shot is one of the game's own models, toon shaded and
// inked like in game, on a transparent background. art/cards/render.cjs opens this page and saves every shot to
// public/sprites/cards/<name>.png.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { inkify, setInkResolution } from '../../src/render/toon';

const SIZE = 320;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE, false);
renderer.setClearColor(0x000000, 0);
renderer.localClippingEnabled = true;
setInkResolution(SIZE, SIZE, 1.6);

// a room to reflect in, for the polished trucks and eyelets of the gear (art/gear.py)
const room = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const shiny = (s: THREE.Scene) => {
  s.environment = room;
  s.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.isMeshStandardMaterial && m.metalness < 0.5) m.envMapIntensity = 0.15; // no sheen off suede and urethane
  });
};

const loader = new GLTFLoader();
const load = (f: string) => loader.loadAsync(`/models/${f}`).then((g) => g.scene);

const matName = (o: THREE.Object3D) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.name ?? '';

// keep only some of a model: by material, and by where each triangle sits (in the model's own space)
type Where = (c: THREE.Vector3) => boolean;
function part(src: THREE.Object3D, keep: (m: THREE.Mesh) => boolean, where?: Where): THREE.Object3D {
  const root = src.clone(true);
  root.updateMatrixWorld(true);
  const drop: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (!keep(o)) return void drop.push(o);
    if (!where) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const pos = g.getAttribute('position');
    const keepTri: number[] = [];
    const a = new THREE.Vector3();
    for (let t = 0; t < pos.count; t += 3) {
      a.set(0, 0, 0);
      for (let k = 0; k < 3; k++) a.add(new THREE.Vector3().fromBufferAttribute(pos, t + k));
      a.divideScalar(3).applyMatrix4(o.matrixWorld);
      if (where(a)) keepTri.push(t);
    }
    const out = new THREE.BufferGeometry();
    for (const name of Object.keys(g.attributes)) {
      const attr = g.getAttribute(name) as THREE.BufferAttribute;
      const arr = new (attr.array.constructor as Float32ArrayConstructor)(keepTri.length * 3 * attr.itemSize);
      keepTri.forEach((t, n) => arr.set(attr.array.subarray(t * attr.itemSize, (t + 3) * attr.itemSize), n * 3 * attr.itemSize));
      out.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize, attr.normalized));
    }
    o.geometry = out;
  });
  drop.forEach((o) => o.removeFromParent());
  return root;
}

// frame the object: rotated, then fitted into the square by an orthographic camera
function shot(obj: THREE.Object3D, rot: [number, number, number], fill = 0.86, extra?: (s: THREE.Scene, pivot: THREE.Group) => void): string {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const pivot = new THREE.Group();
  pivot.add(obj);
  pivot.rotation.set(...rot);
  scene.add(pivot);
  extra?.(scene, pivot);
  inkify(scene);
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const half = (Math.max(size.x, size.y) / 2) / fill;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 100);
  cam.position.set(c.x, c.y, c.z + 10);
  cam.lookAt(c);
  renderer.render(scene, cam);
  return canvas.toDataURL('image/png');
}

async function main(): Promise<Record<string, string>> {
  const board = await load('board.glb');
  const cars = await load('cars.glb');
  const pickups = await load('pickups.glb');
  const named = (root: THREE.Object3D, n: string) => root.getObjectByName(n)!.clone(true);
  const out: Record<string, string> = {};
  const deckOnly = (m: THREE.Mesh) => ['grip', 'gripbar', 'deck', 'plies', 'logo'].includes(matName(m));
  //the deck on its own, graphic side up and angled like it's leaning on the shop wall
  out.deck = shot(part(board, deckOnly), [-1.25, 0.2, 0.75]);
  //the whole board, three ways: cruising, popped (tail down) and mid-flip
  out.board = shot(part(board, () => true), [0.35, -0.35, 0.5]);
  out.pop = shot(part(board, () => true), [0.3, -0.3, 0.75]);
  out.flip = shot(part(board, () => true), [2.2, -0.2, 0.55]);
  //the gear cards: the shop's own detailed models (art/gear.py), not the game's board. A truck upside down like it's
  //sitting on the shop counter, from above, a wheel turned so the swirl and the rounded tread both show, a shoe from the outside
  const gear = (await loader.loadAsync('/art/cards/gear.glb')).scene;
  out.truck = shot(named(gear, 'Truck'), [Math.PI + 0.85, -1.45, 0], 0.9, shiny);
  out.wheel = shot(named(gear, 'Wheel'), [0.2, 0.5, 0], 0.84, shiny);
  out.shoe = shot(named(gear, 'Shoe'), [0.3, 0.35, 0], 0.92, shiny);
  //the board grinding a rail
  out.grind = shot(part(board, () => true), [0.3, -0.5, 0.25], 0.86, (_, pivot) => {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 12), new THREE.MeshLambertMaterial({ color: 0x9aa4b4 }));
    rail.rotation.set(0, 0, Math.PI / 2);
    rail.position.set(0, -0.09, 0); // under the trucks, between the wheels: a 50-50
    pivot.add(rail);
  });
  out.car = shot(named(cars, 'Sedan'), [0.25, -0.6, 0], 0.85);
  //for the boon cards (src/ui/boon-art.ts): the chase, the street and a landmark
  const street = await load('street.glb');
  const drone = await load('drone.glb');
  const chopper = await load('chopper.glb');
  const landmarks = await load('landmarks.glb');
  out.cruiser = shot(named(cars, 'Cruiser'), [0.25, -0.6, 0], 0.85);
  out.robotaxi = shot(named(cars, 'Robotaxi'), [0.25, -0.6, 0], 0.85);
  out.bus = shot(named(cars, 'Bus'), [0.2, -0.5, 0], 0.9);
  out.boxtruck = shot(named(cars, 'BoxTruck'), [0.2, 0.6, 0], 0.9);
  out.drone = shot(drone.clone(true), [0.4, -0.5, 0], 0.85);
  out.chopper = shot(chopper.clone(true), [0.2, -0.6, 0], 0.9);
  out.wanted = shot(named(street, 'WantedBoard'), [0.1, -0.35, 0], 0.85);
  out.signal = shot(named(street, 'TrafficSignal'), [0.1, -0.5, 0], 0.9);
  out.rocket = shot(named(landmarks, 'Rocket'), [0.1, -0.4, 0], 0.9);
  out.coin = shot(named(pickups, 'Coin'), [0.2, -0.5, 0], 0.7);
  out.stoken = shot(named(pickups, 'Stoken'), [0.2, -0.5, 0], 0.7);
  //for the unlocks screen (openspec ui6-unlocks-look): each skater's head and shoulders, the four decks, a cone
  const props = await load('props.glb');
  out.cone = shot(named(props, 'Cone'), [0.25, -0.5, 0], 0.8);
  for (const id of ['lou-gnar', 'webster', 'roxy', 'keanu', 'goldie']) out[`skater-${id}`] = portrait(await load(`${id}.glb`));
  for (const [id, look] of Object.entries(DECKS)) out[`deck-${id}`] = shot(deckLook(part(board, deckOnly), look), [-1.25, 0.2, 1.05]);
  return out;
}

// a skater from the shoulders up, turned a little toward the camera, framed on the head
function portrait(model: THREE.Object3D): string {
  const root = model; // not a clone: a cloned skinned mesh still follows the original's bones
  root.traverse((o) => {
    if (o.name === 'Board') o.visible = false;
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).frustumCulled = false;
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  root.rotation.y = 0.4; // a three-quarter view
  scene.add(root);
  inkify(scene);
  scene.updateMatrixWorld(true);
  const head = root.getObjectByName('Head')!.getWorldPosition(new THREE.Vector3());
  const chest = root.getObjectByName('Spine1')!.getWorldPosition(new THREE.Vector3());
  const span = head.distanceTo(chest);
  const c = head.clone().lerp(chest, 0.25).add(new THREE.Vector3(0, span * 0.35, 0));
  const half = span * 1.25;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 100);
  cam.position.set(c.x, c.y, c.z + 10);
  cam.lookAt(c);
  renderer.render(scene, cam);
  return canvas.toDataURL('image/png');
}

// the decks only differ in play (src/run/meta.ts), so each gets its own look here: a colour for the graphic and a shape
interface Look { deck: number; logo: number; w?: number; l?: number }
const DECKS: Record<string, Look> = {
  popsicle: { deck: 0xb8322a, logo: 0xf2e8d0 },
  cruiser: { deck: 0x2fb8b0, logo: 0xffe23a, l: 0.86, w: 1.1 },
  bombhill: { deck: 0x1c1c24, logo: 0xff3b4e, l: 1.12, w: 0.94 },
  slab: { deck: 0x7a2fb8, logo: 0x4dff8a, w: 1.3 },
};
function deckLook(obj: THREE.Object3D, look: Look): THREE.Object3D {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = matName(m);
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    if (name === 'deck' || name === 'plies') mat.color.setHex(look.deck);
    if (name === 'logo') mat.color.setHex(look.logo);
    m.material = mat;
  });
  obj.scale.set(look.l ?? 1, 1, look.w ?? 1);
  return obj;
}

(window as unknown as { cardArt: Promise<Record<string, string>> }).cardArt = main();
