// The shop's card art (openspec/changes/ui3-shop-look): each shot is one of the game's own models, toon shaded and
// inked like in game, on a transparent background. art/cards/render.cjs opens this page and saves every shot to
// public/sprites/cards/<name>.png.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { inkify, setInkResolution } from '../../src/render/toon';
import { StokenParticles } from '../../src/render/stoken-particle';
import { boardFile, SkaterRig, type SkaterId } from '../../src/render/skater-rig';
import { deckDecal } from '../../src/render/wear';
import { deckTexture } from '../../src/render/deck-graphic';
import { BASE } from '../../src/render/poses';
import { stockDeck, type DeckArt } from '../../src/board/deck-art';

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

const DECK_PARTS = ['grip', 'gripbar', 'deck', 'plies', 'logo'];
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
// the Stoken particle (src/render/stoken-particle.ts) caught mid-orbit, its electrons spread round the flame
function stokenParticle(): THREE.Object3D {
  const p = new StokenParticles(1);
  p.place(0, new THREE.Vector3(), 1, 1.5);
  p.flush();
  //the frame: a hidden ball round the shell and orbits (the instanced pieces don't measure themselves to the shell)
  const frame = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8));
  frame.visible = false;
  p.group.add(frame);
  return p.group;
}

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
  const deckOnly = (m: THREE.Mesh) => DECK_PARTS.includes(matName(m));
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
  //the GRIND boons' wax: three sticks of Ledge Butter, and a slab of More Wax in front of its box
  out.butter = shot(named(gear, 'LedgeButter'), [0.5, -0.35, 0], 0.9);
  out.wax = shot(named(gear, 'MoreWax'), [0.35, -0.3, 0], 0.9);
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
  out.stoken = shot(stokenParticle(), [0, 0, 0], 1.15);
  //for the unlocks screen (openspec ui6-unlocks-look): each skater's head and shoulders, the four decks, a cone
  const props = await load('props.glb');
  out.cone = shot(named(props, 'Cone'), [0.25, -0.5, 0], 0.8);
  for (const id of ['lou-gnar', 'webster', 'roxy', 'keanu', 'goldie'] as SkaterId[]) out[`skater-${id}`] = portrait(await SkaterRig.create('/', id));
  //each deck in its own shape (art/board.py) and the paint and graphic it starts a run in (deck-art.ts stockDeck)
  for (const id of ['popsicle', 'cruiser', 'bombhill', 'slab']) {
    const deck = part(await load(boardFile(id)), (m) => [...DECK_PARTS, 'decktop', 'plastic'].includes(matName(m)));
    //underside up and nearly side on, so the outline and the graphic read at thumbnail size, tipped enough to show the
    //7-ply edge along the top
    out[`deck-${id}`] = shot(deckLook(deck, stockDeck(id)), [-0.9, -0.3, 0.22], 0.96);
  }
  return out;
}

// a skater from the chest up, through the game's own rig (SkaterRig: the same model, hair, toon shading and stance
// as in a run), turned a little toward the camera and framed on the head
function portrait(rig: SkaterRig): string {
  const root = rig.mesh;
  rig.boardGroup.visible = false;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  //the stance, but body and head turned to the camera (in a run they look down the road): a three-quarter view
  rig.preview({ ...BASE, yaw: 0.25, head: 0.05, nod: -0.05, armLRaise: 0.3, armRRaise: 0.3 });
  scene.add(root);
  inkify(root, { toon: false });
  scene.updateMatrixWorld(true);
  const head = root.localToWorld(rig.headAt());
  const span = 0.5 * SCALE_OF(root); // neck to mid chest, in world units
  const c = head.clone().add(new THREE.Vector3(0, span * 0.4, 0));
  const half = span * 0.72;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 100);
  cam.position.set(c.x, c.y, c.z + 10);
  cam.lookAt(c);
  renderer.render(scene, cam);
  scene.remove(root);
  return canvas.toDataURL('image/png');
}
const SCALE_OF = (o: THREE.Object3D) => o.scale.y;

// a deck painted in its run-start colour, its graphic on the underside as in game (wear.ts deckDecal)
function deckLook(obj: THREE.Object3D, art: DeckArt): THREE.Object3D {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = matName(m);
    m.userData.mat = name;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    if (name === 'deck') mat.color.setHex(art.base);
    m.material = mat;
  });
  if (art.shape !== 'plain') {
    const decal = deckDecal(obj, new THREE.MeshLambertMaterial({ map: deckTexture(art), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    if (decal) decal.userData.inked = true;
  }
  return obj;
}

(window as unknown as { cardArt: Promise<Record<string, string>> }).cardArt = main();
