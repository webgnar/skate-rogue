// The shop's card art (openspec/changes/ui3-shop-look): each shot is one of the game's own models, toon shaded and
// inked like in game, on a transparent background. art/cards/render.cjs opens this page and saves every shot to
// public/sprites/cards/<name>.png.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { inkify, setInkResolution } from '../../src/render/toon';

const SIZE = 320;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE, false);
renderer.setClearColor(0x000000, 0);
renderer.localClippingEnabled = true;
setInkResolution(SIZE, SIZE, 1.6);

const loader = new GLTFLoader();
const load = (f: string) => loader.loadAsync(`/models/${f}`).then((g) => g.scene);

const TRUCK = ['metal', 'bushing', 'steel', 'gold', 'bolt'];
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
  const deckOnly = (m: THREE.Mesh) => ['grip', 'deck', 'plies', 'logo'].includes(matName(m));
  //the deck on its own, graphic side up and angled like it's leaning on the shop wall
  out.deck = shot(part(board, deckOnly), [-1.25, 0.2, 0.75]);
  //the whole board, three ways: cruising, popped (tail down) and mid-flip
  out.board = shot(part(board, () => true), [0.35, -0.35, 0.5]);
  out.pop = shot(part(board, () => true), [0.3, -0.3, 0.75]);
  out.flip = shot(part(board, () => true), [2.2, -0.2, 0.55]);
  //one truck: the hardware on the nose side
  out.truck = shot(part(board, (m) => TRUCK.includes(matName(m)), (c) => c.x > 0.1 && c.y < -0.012), [0.35, -1.25, 0]);
  //one wheel, face on so the swirl shows
  out.wheel = shot(part(board, (m) => matName(m) === 'wheel', (c) => c.x > 0.1 && c.z > 0), [0.2, -0.45, 0]);
  //the board grinding a rail
  out.grind = shot(part(board, () => true), [0.3, -0.5, 0.25], 0.86, (_, pivot) => {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 12), new THREE.MeshLambertMaterial({ color: 0x9aa4b4 }));
    rail.rotation.set(0, 0, Math.PI / 2);
    rail.position.set(0, -0.09, 0); // under the trucks, between the wheels: a 50-50
    pivot.add(rail);
  });
  out.car = shot(named(cars, 'Sedan'), [0.25, -0.6, 0], 0.85);
  out.coin = shot(named(pickups, 'Coin'), [0.2, -0.5, 0], 0.7);
  out.stoken = shot(named(pickups, 'Stoken'), [0.2, -0.5, 0], 0.7);
  return out;
}

(window as unknown as { cardArt: Promise<Record<string, string>> }).cardArt = main();
