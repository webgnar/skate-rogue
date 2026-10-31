// The animation editor (?editor): keyframe the skater's clips on the real rig, in the browser.
//
// Pick a clip, scrub the timeline, and pose the key under the playhead: drag the hips, feet and board in the view,
// or set any of the pose's values on the right. Editing between keys adds a key there. The clip plays on the same
// rig, model and leg IK as the game. Save writes src/render/clip-edits.json through the dev server (npm run dev),
// which the game plays over the clips in poses.ts; elsewhere it downloads that file instead.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { BASE, BOARD, CLIPS, CODE_CLIPS, clipLength, feetYaw, footTarget, sample, type Clip, type Pose } from '../render/poses';
import savedEdits from '../render/clip-edits.json';
import { SkaterRig, isSkater } from '../render/skater-rig';
import { inkify, setInkResolution } from '../render/toon';
import { FPS, SNAP, addKey, deleteKey, formatEdits, keyAt, moveKey, nearestDeckX, scaleClip, snapT, toClip, toWork, type WorkClip } from './clip-doc';
import { loadDrafts, saveDrafts } from './drafts';
import './editor.css';

type Field = keyof Pose;
interface FieldDef {
  f: Field;
  label: string;
  min: number;
  max: number;
  angle?: boolean; // shown in degrees, stored in radians
}

const PI = Math.PI;
const TAU = PI * 2;
const GROUPS: { name: string; fields: FieldDef[] }[] = [
  {
    name: 'Body',
    fields: [
      { f: 'hipX', label: 'hips along', min: -1, max: 1 },
      { f: 'hipY', label: 'hips height', min: 0, max: 1.6 },
      { f: 'hipZ', label: 'hips toe/heel', min: -0.6, max: 0.6 },
      { f: 'yaw', label: 'body turn', min: -PI * 1.5, max: PI * 1.5, angle: true },
      { f: 'lean', label: 'lean', min: -1, max: 1, angle: true },
      { f: 'bend', label: 'bend over', min: -0.8, max: 1.6, angle: true },
      { f: 'tumble', label: 'tumble', min: -PI, max: PI, angle: true },
    ],
  },
  {
    name: 'Head',
    fields: [
      { f: 'head', label: 'turn', min: -1.6, max: 1.6, angle: true },
      { f: 'nod', label: 'nod (down +)', min: -1, max: 1.2, angle: true },
      { f: 'headTilt', label: 'tilt', min: -1, max: 1, angle: true },
    ],
  },
  {
    name: 'Front arm (left)',
    fields: [
      { f: 'armLRaise', label: 'raise', min: -0.5, max: 3.2, angle: true },
      { f: 'armLFwd', label: 'swing fwd', min: -2, max: 2, angle: true },
      { f: 'armLElbow', label: 'elbow', min: 0, max: 2.6, angle: true },
      { f: 'armLTwist', label: 'elbow swing', min: -PI, max: PI, angle: true },
    ],
  },
  {
    name: 'Back arm (right)',
    fields: [
      { f: 'armRRaise', label: 'raise', min: -0.5, max: 3.2, angle: true },
      { f: 'armRFwd', label: 'swing fwd', min: -2, max: 2, angle: true },
      { f: 'armRElbow', label: 'elbow', min: 0, max: 2.6, angle: true },
      { f: 'armRTwist', label: 'elbow swing', min: -PI, max: PI, angle: true },
    ],
  },
  {
    name: 'Front foot (left)',
    fields: [
      { f: 'footFOn', label: 'on board', min: 0, max: 1 },
      { f: 'footFX', label: 'along', min: -1, max: 1 },
      { f: 'footFY', label: 'height (off)', min: -0.2, max: 1.2 },
      { f: 'footFZ', label: 'toe/heel', min: -0.6, max: 0.6 },
      { f: 'footFTurn', label: 'turn', min: -1.6, max: 1.6, angle: true },
      { f: 'footFPitch', label: 'heel lift', min: -0.8, max: 1.4, angle: true },
      { f: 'footFToe', label: 'toes up', min: -0.8, max: 1.4, angle: true },
      { f: 'footFRoll', label: 'roll on edge', min: -0.6, max: 1.6, angle: true },
    ],
  },
  {
    name: 'Back foot (right)',
    fields: [
      { f: 'footBOn', label: 'on board', min: 0, max: 1 },
      { f: 'footBX', label: 'along', min: -1, max: 1 },
      { f: 'footBY', label: 'height (off)', min: -0.2, max: 1.2 },
      { f: 'footBZ', label: 'toe/heel', min: -0.6, max: 0.6 },
      { f: 'footBTurn', label: 'turn', min: -1.6, max: 1.6, angle: true },
      { f: 'footBPitch', label: 'heel lift', min: -0.8, max: 1.4, angle: true },
      { f: 'footBToe', label: 'toes up', min: -0.8, max: 1.4, angle: true },
      { f: 'footBRoll', label: 'roll on edge', min: -0.6, max: 1.6, angle: true },
    ],
  },
  {
    // the knees' pole targets (the diamond handles): where each knee bends toward, as an offset from where it aims
    // by itself
    name: 'Knees (pole targets)',
    fields: [
      { f: 'kneeFX', label: 'front along', min: -1.5, max: 1.5 },
      { f: 'kneeFY', label: 'front up', min: -1.5, max: 1.5 },
      { f: 'kneeFZ', label: 'front toe/heel', min: -1.5, max: 1.5 },
      { f: 'kneeBX', label: 'back along', min: -1.5, max: 1.5 },
      { f: 'kneeBY', label: 'back up', min: -1.5, max: 1.5 },
      { f: 'kneeBZ', label: 'back toe/heel', min: -1.5, max: 1.5 },
    ],
  },
  {
    name: 'Board',
    fields: [
      { f: 'boardX', label: 'along', min: -2, max: 2 },
      { f: 'boardY', label: 'lift', min: -0.3, max: 1.2 },
      { f: 'boardZ', label: 'toe/heel', min: -0.6, max: 0.6 },
      { f: 'boardPivot', label: 'pitch pivot', min: -BOARD.tail, max: BOARD.tail },
      { f: 'boardPitch', label: 'pitch (nose up +)', min: -1.6, max: 1.6, angle: true },
      { f: 'boardRoll', label: 'flip (kick −)', min: -TAU * 1.5, max: TAU * 1.5, angle: true },
      { f: 'boardYaw', label: 'spin (bs −)', min: -TAU * 1.5, max: TAU * 1.5, angle: true },
    ],
  },
];
const DEFS = new Map(GROUPS.flatMap((g) => g.fields).map((d) => [d.f, d]));
const DEG = 180 / PI;
const ROLL_SPEED = 6; // tiles a second the ground scrolls by with "roll" on

type Handle = 'hips' | 'footF' | 'footB' | 'kneeF' | 'kneeB' | 'board' | 'handL' | 'handR' | 'elbowL' | 'elbowR' | 'head';
const POLES = ['kneeF', 'kneeB', 'elbowL', 'elbowR'] as const; // the diamonds: pole targets
const ELBOW_OUT = 0.3; // the elbow's diamond sits this far out from the elbow, the way it bends
const HANDLES: { id: Handle; color: number; label: string }[] = [
  { id: 'hips', color: 0xffd23a, label: 'hips' },
  { id: 'footF', color: 0x4ad8ff, label: 'front foot' },
  { id: 'footB', color: 0xff5ad8, label: 'back foot' },
  { id: 'kneeF', color: 0x4ad8ff, label: 'front knee aim' },
  { id: 'kneeB', color: 0xff5ad8, label: 'back knee aim' },
  { id: 'board', color: 0xff8a2a, label: 'board' },
  { id: 'handL', color: 0x7df0a0, label: 'front hand' },
  { id: 'handR', color: 0xb98cff, label: 'back hand' },
  { id: 'elbowL', color: 0x7df0a0, label: 'front elbow aim' },
  { id: 'elbowR', color: 0xb98cff, label: 'back elbow aim' },
  { id: 'head', color: 0xffffff, label: 'head' },
];
// what the less obvious clips are for, in the clip menu
const NOTES: Record<string, string> = {
  air: 'falling after a trick or off a drop',
  boneless: 'car hop',
  freefall: 'bailed, off the board',
  ride: 'rolling, no push',
  land: 'landing squash',
  grind1: '50-50',
  grind2: 'bs boardslide',
  shuv1: 'bs pop shove-it',
  shuv2: '360 shove-it',
  tre: '360 flip',
};
const HEAD_UP = 0.2; // the head's dot sits this far above the neck pivot, in the helmet
const OFF_DECK = 0.1; // lift a foot this far up off the deck and it steps off the board

const VIEWS: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  side: { pos: [0, 1.2, 9], target: [0, 1, 0.25] }, // the game's camera: from the toe side
  front: { pos: [8, 1.2, 0.25], target: [0, 1, 0.25] }, // from the way they skate
  back: { pos: [-8, 1.2, 0.25], target: [0, 1, 0.25] },
  top: { pos: [0, 9, 0.3], target: [0, 0.5, 0.25] },
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
}

const same = (a: Clip | undefined, b: Clip | undefined) => JSON.stringify(a) === JSON.stringify(b);

export async function startEditor(base: string): Promise<void> {
  document.getElementById('app')?.remove();
  document.title = 'Gnar Run · animation editor';
  const params = new URLSearchParams(location.search);
  const skater = params.get('skater');

  // ---------- state ----------
  let saved = { ...(savedEdits as Record<string, Clip>) }; // what clip-edits.json holds
  const codeClip = (name: string) => toClip(toWork(CODE_CLIPS[name] ?? CLIPS[name])); // normalised like a save
  const savedClip = (name: string) => saved[name] ?? codeClip(name);
  const work: Record<string, WorkClip> = {}; // clips opened in the editor
  for (const [name, clip] of Object.entries(loadDrafts())) if (CLIPS[name]) work[name] = toWork(clip);
  const names = Object.keys(CLIPS);
  let name = params.get('clip') && CLIPS[params.get('clip')!] ? params.get('clip')! : 'ollie';
  const clipOf = (n: string) => (work[n] ??= toWork(saved[n] ?? CLIPS[n]));
  let clip = clipOf(name);
  let t = 0;
  let playing = false;
  let speed = 0.5;
  let hold = 0; // pause at the end of a one-shot clip before it plays again
  let selected = 0; // key index, -1 when the playhead is between keys
  let copied: Pose | null = null;
  let roll = false;
  let rolled = 0;
  let ghostOn = false;
  const undo: { name: string; json: string }[] = [];
  const redo: { name: string; json: string }[] = [];
  let lastTag = '';
  let lastAt = 0;

  // ---------- layout ----------
  const root = el('div', { id: 'editor' });
  const bar = el('div', { class: 'bar' });
  const main = el('div', { class: 'main' });
  const viewWrap = el('div', { class: 'view' });
  const canvas = el('canvas');
  const refImg = el('img', { class: 'ref', alt: '' });
  refImg.hidden = true;
  const hint = el('div', { class: 'hint' });
  viewWrap.append(refImg, canvas, hint);
  const panel = el('div', { class: 'props' });
  main.append(viewWrap, panel);
  const tl = el('div', { class: 'timeline' });
  const status = el('div', { class: 'status' });
  root.append(bar, main, tl, status);
  document.body.append(root);

  // top bar
  const clipSel = el('select', { title: 'Clip' });
  const playBtn = el('button', { title: 'Play / pause (space)' }, '▶');
  const speedSel = el('select', { title: 'Playback speed' });
  for (const s of [0.1, 0.25, 0.5, 1]) speedSel.append(el('option', { value: String(s) }, `${s}×`));
  speedSel.value = String(speed);
  const loopBox = el('input', { type: 'checkbox' });
  const loopLbl = el('label', { title: 'The clip loops in the game' });
  loopLbl.append(loopBox, ' loop');
  const lenIn = el('input', { type: 'number', step: String(SNAP), min: String(SNAP), class: 'len', title: 'Clip length (s): stretches the keys' });
  const viewBtns = el('span', { class: 'group' });
  for (const v of Object.keys(VIEWS)) {
    const b = el('button', { 'data-view': v }, v);
    b.onclick = () => setView(v);
    viewBtns.append(b);
  }
  const rollBox = el('input', { type: 'checkbox' });
  const rollLbl = el('label', { title: 'Scroll the ground as if rolling' });
  rollLbl.append(rollBox, ' roll');
  const ghostBox = el('input', { type: 'checkbox' });
  const ghostLbl = el('label', { title: 'Show the previous key as a ghost' });
  ghostLbl.append(ghostBox, ' ghost');
  const refBtn = el('button', { title: 'Show a reference photo over the view (or drop one on it)' }, 'ref photo');
  const refFile = el('input', { type: 'file', accept: 'image/*' });
  refFile.hidden = true;
  const refOpacity = el('input', { type: 'range', min: '0.1', max: '1', step: '0.05', value: '0.45', title: 'Reference opacity' });
  const refFlip = el('button', { title: 'Mirror the reference' }, '⇋');
  const refClear = el('button', { title: 'Hide the reference' }, '✕');
  const refGroup = el('span', { class: 'group ref-tools' });
  refGroup.append(refOpacity, refFlip, refClear);
  refGroup.hidden = true;
  const undoBtn = el('button', { title: 'Undo (ctrl+z)' }, '↶');
  const redoBtn = el('button', { title: 'Redo (ctrl+shift+z)' }, '↷');
  const revertBtn = el('button', { title: 'Put this clip back to the one in poses.ts' }, 'revert clip');
  const gameBtn = el('button', { title: 'Open the game with your unsaved clips (?drafts)' }, 'try in game');
  const saveBtn = el('button', { class: 'save', title: 'Save every edited clip to src/render/clip-edits.json (ctrl+s)' }, 'save');
  bar.append(
    clipSel, playBtn, speedSel, loopLbl, lenIn, el('span', { class: 'sep' }), viewBtns, rollLbl, ghostLbl,
    el('span', { class: 'sep' }), refBtn, refFile, refGroup, el('span', { class: 'grow' }), undoBtn, redoBtn, revertBtn, gameBtn, saveBtn,
  );

  // timeline
  const tlTools = el('div', { class: 'tools' });
  const prevBtn = el('button', { title: 'Previous key (,)' }, '⏮');
  const nextBtn = el('button', { title: 'Next key (.)' }, '⏭');
  const addBtn = el('button', { title: 'Add a key at the playhead (k)' }, '+ key');
  const delBtn = el('button', { title: 'Delete the selected key (delete)' }, '− key');
  const copyBtn = el('button', { title: 'Copy the pose at the playhead (ctrl+c)' }, 'copy pose');
  const pasteBtn = el('button', { title: 'Paste the copied pose at the playhead (ctrl+v)' }, 'paste pose');
  const timeOut = el('span', { class: 'time' });
  tlTools.append(prevBtn, nextBtn, addBtn, delBtn, copyBtn, pasteBtn, timeOut);
  const track = el('div', { class: 'track' });
  const ruler = el('div', { class: 'ruler' });
  const keysRow = el('div', { class: 'keys' });
  const head = el('div', { class: 'playhead' });
  track.append(ruler, keysRow, head);
  tl.append(tlTools, track);

  // panel: one row per pose value
  const rows = new Map<Field, { row: HTMLElement; range: HTMLInputElement; num: HTMLInputElement }>();
  const panelHead = el('div', { class: 'keyinfo' });
  panel.append(panelHead);
  for (const g of GROUPS) {
    const box = el('details', { open: '' });
    box.append(el('summary', {}, g.name));
    for (const d of g.fields) {
      const row = el('div', { class: 'row' });
      const label = el('span', { class: 'label', title: `${d.f} — double-click to reset to the default (${fmt(d, BASE[d.f])})` }, d.label);
      const range = el('input', { type: 'range', min: String(shown(d, d.min)), max: String(shown(d, d.max)), step: d.angle ? '1' : '0.01' });
      const num = el('input', { type: 'number', step: d.angle ? '1' : '0.01' });
      row.append(label, range, num);
      box.append(row);
      rows.set(d.f, { row, range, num });
      range.oninput = () => setField(d.f, stored(d, Number(range.value)));
      num.onchange = () => Number.isFinite(Number(num.value)) && setField(d.f, stored(d, Number(num.value)));
      label.ondblclick = () => setField(d.f, BASE[d.f]);
    }
    panel.append(box);
  }

  // ---------- 3D ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 200);
  scene.add(new THREE.HemisphereLight(0xffe8f0, 0x403050, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0e0, 2.1);
  sun.position.set(-6, 12, 10);
  scene.add(sun);
  const grid = new THREE.GridHelper(40, 40, 0x8a7ab8, 0x4a3a78);
  scene.add(grid);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x2a1d4a, transparent: true, opacity: 0.55 }));
  ground.rotation.x = -PI / 2;
  ground.position.y = -0.002;
  scene.add(ground);

  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  const setView = (v: string) => {
    const { pos, target } = VIEWS[v];
    camera.position.set(...pos);
    orbit.target.set(...target);
    orbit.update();
  };
  setView('side');
  if (params.has('debug')) Object.assign(window, { editorView: { camera, orbit } });

  status.textContent = 'loading the skater…';
  const rig = await SkaterRig.create(base, isSkater(skater) ? skater : 'lou-gnar');
  inkify(rig.mesh, { toon: false });
  if (params.has('debug')) Object.assign(window, { editorRig: rig });
  scene.add(rig.mesh);
  // the ghost: the same rig, see-through, showing the key before the playhead
  const ghost = await SkaterRig.create(base, isSkater(skater) ? skater : 'lou-gnar');
  ghost.mesh.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = [o.material].flat().map((m: THREE.Material) => {
      const c = m.clone();
      c.transparent = true;
      c.opacity = 0.22;
      c.depthWrite = false;
      return c;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
  });
  ghost.mesh.visible = false;
  scene.add(ghost.mesh);

  // drag handles, in the rig's own space (children of its mesh)
  const handles = new Map<Handle, THREE.Mesh>();
  for (const h of HANDLES) {
    const knee = h.id.startsWith('knee') || h.id.startsWith('elbow');
    const m = new THREE.Mesh(
      // the knees' and elbows' pole targets are diamonds in their foot's or hand's colour
      knee ? new THREE.OctahedronGeometry(0.06) : new THREE.SphereGeometry(h.id === 'hips' ? 0.07 : 0.055, 16, 12),
      new THREE.MeshBasicMaterial({ color: h.color, depthTest: false, transparent: true, opacity: 0.9 }),
    );
    m.renderOrder = 10;
    m.userData.handle = h.id;
    m.userData.inked = true;
    rig.mesh.add(m);
    handles.set(h.id, m);
  }
  // a line from each knee and elbow to its pole target, so it reads which joint a diamond steers
  const poleLines = POLES.map((id) => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: HANDLES.find((h) => h.id === id)!.color, dashSize: 0.04, gapSize: 0.03, depthTest: false, transparent: true, opacity: 0.8 }),
    );
    line.renderOrder = 9;
    line.userData.inked = true;
    rig.mesh.add(line);
    return line;
  });
  const gizmo = new TransformControls(camera, canvas);
  gizmo.setSize(0.8);
  scene.add(gizmo.getHelper());
  let active: Handle | null = null;
  gizmo.addEventListener('dragging-changed', (e) => {
    orbit.enabled = !e.value;
    if (e.value) playing = false;
    else placeHandles(sampleNow());
  });
  gizmo.addEventListener('objectChange', () => {
    if (!active || !gizmo.dragging) return;
    const p = handles.get(active)!.position;
    const pose = sampleNow();
    if (active === 'head') {
      const e = new THREE.Euler().setFromQuaternion(handles.get('head')!.quaternion, 'YXZ');
      edit('drag:head', { nod: e.x, head: e.y, headTilt: -e.z });
    } else if (active === 'hips') edit('drag:hips', { hipX: p.x, hipY: p.y, hipZ: p.z });
    else if (active === 'handL' || active === 'handR') edit(`drag:${active}`, reach(pose, active === 'handL' ? 0 : 1, p));
    else if (active === 'elbowL' || active === 'elbowR') edit(`drag:${active}`, rig.swivel(pose, active === 'elbowL' ? 0 : 1, p));
    else if (active === 'kneeF' || active === 'kneeB') {
      // the offset from where the knee aims by itself (SkaterRig.poleAt), which doesn't move while only this does
      const front = active === 'kneeF';
      const o = p.clone().sub(rig.poleAt(front ? 0 : 1).base);
      edit(`drag:${active}`, front ? { kneeFX: o.x, kneeFY: o.y, kneeFZ: o.z } : { kneeBX: o.x, kneeBY: o.y, kneeBZ: o.z });
    } else if (active === 'board') edit('drag:board', { boardX: p.x, boardY: p.y - BOARD.deckTop, boardZ: p.z });
    else {
      const front = active === 'footF';
      const on = front ? pose.footFOn : pose.footBOn;
      const fx = front ? 'footFX' : 'footBX';
      // A foot on the board slides along the deck (X) and across it toward the toe or heel edge (Z); lifted well
      // up off it, it steps off. A foot already off goes anywhere.
      const dx = nearestDeckX(pose, p);
      const fz = front ? 'footFZ' : 'footBZ';
      const deck = footTarget({ ...pose, [front ? 'footFOn' : 'footBOn']: 1, [fx]: dx, [fz]: 0 }, front);
      const yaw = feetYaw(pose);
      const across = (p.x - deck.x) * Math.sin(yaw) + (p.z - deck.z) * Math.cos(yaw);
      const off = p.y - deck.y > OFF_DECK;
      if (on >= 0.5 && !off) edit(`drag:${active}`, { [fx]: dx, [fz]: Math.max(-0.3, Math.min(0.3, across)) });
      else if (on >= 0.5) edit(`drag:${active}`, front ? { footFOn: 0, footFX: p.x, footFY: p.y, footFZ: p.z } : { footBOn: 0, footBX: p.x, footBY: p.y, footBZ: p.z });
      else edit(`drag:${active}`, front ? { footFX: p.x, footFY: p.y, footFZ: p.z } : { footBX: p.x, footBY: p.y, footBZ: p.z });
    }
  });
  const pick = (h: Handle | null) => {
    active = h;
    if (h) {
      // the head turns (rings), everything else moves (arrows)
      gizmo.setMode(h === 'head' ? 'rotate' : 'translate');
      gizmo.setSpace(h === 'head' ? 'local' : 'world');
      gizmo.attach(handles.get(h)!);
    } else gizmo.detach();
    for (const [id, m] of handles) (m.material as THREE.MeshBasicMaterial).opacity = id === h ? 1 : 0.75;
    updateHint();
  };
  const ray = new THREE.Raycaster();
  canvas.addEventListener('pointerdown', (e) => {
    if (gizmo.axis !== null) return; // grabbing the gizmo itself
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects([...handles.values()].filter((m) => m.visible))[0];
    if (hit) pick(hit.object.userData.handle as Handle);
  });

  // ---------- editing ----------
  function sampleNow(): Pose {
    return sample(clip as Clip, t);
  }

  function remember(tag: string): void {
    const now = performance.now();
    if (tag && tag === lastTag && now - lastAt < 700) {
      lastAt = now;
      return;
    }
    lastTag = tag;
    lastAt = now;
    undo.push({ name, json: JSON.stringify(clip) });
    if (undo.length > 200) undo.shift();
    redo.length = 0;
  }

  let draftTimer = 0;
  function changed(): void {
    const len = clipLength(clip as Clip);
    if (t > len) t = len;
    selected = keyAt(clip, t);
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(storeDrafts, 300);
    refresh();
  }

  // the key under the playhead, added (holding the pose shown there) if there isn't one
  function keyHere(): number {
    const tt = snapT(t);
    const at = keyAt(clip, t);
    if (at >= 0) return at;
    t = tt;
    return addKey(clip, tt, sampleNow());
  }

  function edit(tag: string, values: Partial<Pose>): void {
    playing = false;
    remember(tag);
    const i = keyHere();
    const ks = clip.keys;
    const end = ks.length - 1;
    // a loop whose last key matches its first keeps them matching, so it doesn't jump where it wraps
    const pair = clip.loop && end > 0 && (i === 0 || i === end) && JSON.stringify(ks[0].pose) === JSON.stringify(ks[end].pose);
    Object.assign(ks[i].pose, values);
    if (pair) Object.assign(ks[i === 0 ? end : 0].pose, values);
    changed();
  }

  function setField(f: Field, v: number): void {
    edit(`field:${f}`, { [f]: v });
  }

  function restore(from: typeof undo, to: typeof undo): void {
    const s = from.pop();
    if (!s) return;
    to.push({ name: s.name, json: JSON.stringify(clipOf(s.name)) });
    work[s.name] = JSON.parse(s.json);
    if (s.name !== name) openClip(s.name, false);
    clip = work[s.name];
    lastTag = '';
    changed();
  }

  function openClip(n: string, rewind = true): void {
    name = n;
    clip = clipOf(n);
    if (rewind) t = 0;
    playing = false;
    hold = 0;
    const url = new URL(location.href);
    url.searchParams.set('clip', n);
    history.replaceState(null, '', url);
    changed();
  }

  // every clip that differs from what's saved, as the file would hold it
  function pending(): Record<string, Clip> {
    const out: Record<string, Clip> = {};
    for (const [n, w] of Object.entries(work)) {
      const c = toClip(w);
      if (!same(c, savedClip(n))) out[n] = c;
    }
    return out;
  }

  function storeDrafts(): void {
    saveDrafts(pending());
  }

  // clip-edits.json after a save: the saved clips with the pending ones over them, minus any back to the code clip
  function nextEdits(): Record<string, Clip> {
    const out = { ...saved };
    for (const [n, c] of Object.entries(pending())) {
      if (same(c, codeClip(n))) delete out[n];
      else out[n] = c;
    }
    return out;
  }

  async function save(): Promise<void> {
    const edits = nextEdits();
    const text = formatEdits(edits);
    try {
      const res = await fetch('/__clip-edits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: text });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      saved = edits;
      for (const n of Object.keys(CLIPS)) CLIPS[n] = edits[n] ?? CODE_CLIPS[n];
      storeDrafts();
      flash(`saved ${Object.keys(edits).length} edited clip(s) to src/render/clip-edits.json`);
    } catch (err) {
      // no dev server here (the deployed game): hand over the file instead
      const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: 'clip-edits.json' });
      a.click();
      flash(`couldn't save here (${String(err).slice(0, 60)}), so clip-edits.json downloaded: put it in src/render/, or run npm run dev`, true);
    }
    refresh();
  }

  let flashUntil = 0;
  function flash(msg: string, bad = false): void {
    status.textContent = msg;
    status.classList.toggle('bad', bad);
    flashUntil = performance.now() + 5000;
  }

  // ---------- drawing the UI ----------
  let range = 1; // seconds the timeline shows; frozen while dragging a key
  let draggingKey = -1;

  function refresh(): void {
    const dirty = pending();
    clipSel.replaceChildren(
      ...names.map((n) => el('option', { value: n }, `${n}${NOTES[n] ? ` (${NOTES[n]})` : ''}${dirty[n] ? ' •' : saved[n] ? ' ✎' : ''}`)),
    );
    clipSel.value = name;
    loopBox.checked = clip.loop;
    const len = clipLength(clip as Clip);
    if (document.activeElement !== lenIn) lenIn.value = len.toFixed(3);
    if (draggingKey < 0) range = Math.max(0.5, len * 1.15 + 0.1);
    keysRow.replaceChildren(
      ...clip.keys.map((k, i) => {
        const d = el('div', { class: `key${i === selected ? ' sel' : ''}`, title: `key ${i + 1} · ${k.t.toFixed(3)} s (frame ${Math.round(k.t * FPS)})` });
        d.style.left = `${(k.t / range) * 100}%`;
        d.dataset.i = String(i);
        return d;
      }),
    );
    ruler.replaceChildren();
    for (let s = 0; s <= range + 1e-6; s += 0.1) {
      const tick = el('span', { class: Math.round(s * 10) % 5 === 0 ? 'major' : '' }, Math.round(s * 10) % 5 === 0 ? `${s.toFixed(1)}s` : '');
      tick.style.left = `${(s / range) * 100}%`;
      ruler.append(tick);
    }
    const end = el('div', { class: 'end' });
    end.style.left = `${(len / range) * 100}%`;
    ruler.append(end);
    undoBtn.disabled = !undo.length;
    redoBtn.disabled = !redo.length;
    delBtn.disabled = selected <= 0;
    pasteBtn.disabled = !copied;
    revertBtn.disabled = same(toClip(clip), codeClip(name));
    saveBtn.classList.toggle('dirty', Object.keys(dirty).length > 0);
    if (performance.now() > flashUntil) {
      const list = Object.keys(dirty);
      status.classList.remove('bad');
      status.textContent = list.length ? `unsaved: ${list.join(', ')}` : 'all clips saved';
    }
    panelDirty = true;
  }

  let panelDirty = true;
  function drawPanel(pose: Pose): void {
    const onKey = selected >= 0;
    panelHead.textContent = onKey
      ? `key ${selected + 1} of ${clip.keys.length} · ${clip.keys[selected].t.toFixed(3)} s`
      : `between keys · ${t.toFixed(3)} s — changing a value adds a key here`;
    panel.classList.toggle('between', !onKey);
    for (const [f, { row, range: r, num }] of rows) {
      const d = DEFS.get(f)!;
      const v = shown(d, pose[f]);
      if (document.activeElement !== r) r.value = String(v);
      if (document.activeElement !== num) num.value = String(Math.round(v * (d.angle ? 1 : 1000)) / (d.angle ? 1 : 1000));
      row.classList.toggle('changed', Math.abs(pose[f] - BASE[f]) > 1e-4);
    }
  }

  // Arm IK (SkaterRig.reach): the clip still stores the angles
  const reach = (pose: Pose, arm: 0 | 1, goal: THREE.Vector3): Partial<Pose> => rig.reach(pose, arm, goal);

  function placeHandles(pose: Pose): void {
    const head = handles.get('head')!;
    head.position.copy(rig.headAt()).add(new THREE.Vector3(0, HEAD_UP, 0));
    head.quaternion.setFromEuler(new THREE.Euler(pose.nod, pose.head, -pose.headTilt, 'YXZ'));
    handles.get('handL')!.position.copy(rig.handFor(pose, 0));
    handles.get('handR')!.position.copy(rig.handFor(pose, 1));
    handles.get('hips')!.position.set(pose.hipX, pose.hipY, 0);
    const f = footTarget(pose, true);
    const b = footTarget(pose, false);
    handles.get('footF')!.position.set(f.x, f.y, f.z);
    handles.get('footB')!.position.set(b.x, b.y, b.z);
    handles.get('board')!.position.set(pose.boardX, pose.boardY + BOARD.deckTop, pose.boardZ);
    ([0, 1] as const).forEach((i) => handles.get(i ? 'kneeB' : 'kneeF')!.position.copy(rig.poleAt(i).target));
    // the elbows' diamonds: out from the elbow, away from the shoulder-hand line (the arm stores angles, so the
    // diamond only says which way the elbow points; dragging it swings the elbow round with the hand held still)
    ([0, 1] as const).forEach((i) => {
      const hand = rig.handFor(pose, i);
      const { shoulder, elbow } = rig.jointsFor(pose, i);
      const axis = hand.clone().sub(shoulder).normalize();
      const out = elbow.clone().sub(shoulder);
      out.addScaledVector(axis, -out.dot(axis));
      if (out.lengthSq() < 1e-6) out.set(0, 0, 1);
      handles.get(i ? 'elbowR' : 'elbowL')!.position.copy(elbow).addScaledVector(out.normalize(), ELBOW_OUT);
    });
  }

  // the dashed lines from the knees and elbows to their diamonds, wherever the diamonds are (while dragging too)
  function drawPoleLines(pose: Pose): void {
    POLES.forEach((id, k) => {
      const line = poleLines[k];
      const i = (k % 2) as 0 | 1;
      const joint = k < 2 ? rig.kneeAt(i) : rig.jointsFor(pose, i).elbow;
      line.visible = handles.get('hips')!.visible;
      line.geometry.setFromPoints([joint, handles.get(id)!.position]);
      line.computeLineDistances();
    });
  }

  function updateHint(): void {
    const h = HANDLES.find((x) => x.id === active);
    hint.innerHTML = h
      ? `dragging the <b>${h.label}</b>${h.id.startsWith('foot') ? ' (on the board it slides along and across the deck; lift it up off the deck and it steps off, "on board" puts it back)' : h.id.startsWith('hand') ? ' (the shoulder and elbow follow)' : h.id.startsWith('knee') ? ' (the pole target: the knee bends toward it; double-click "Knees" values to put it back)' : h.id.startsWith('elbow') ? ' (the pole target: the elbow swings toward it, the hand stays put; "elbow swing" holds it)' : ''} · esc to let go`
      : `click a dot to move it: ${HANDLES.map((x) => `<b style="color:#${x.color.toString(16).padStart(6, '0')}">${x.label}</b>`).join(' ')} · drag to orbit, scroll to zoom, h hides the dots`;
  }
  updateHint();

  // ---------- inputs ----------
  clipSel.onchange = () => openClip(clipSel.value);
  playBtn.onclick = () => {
    playing = !playing;
    if (playing && !clip.loop && t >= clipLength(clip as Clip) - 1e-6) t = 0;
  };
  speedSel.onchange = () => (speed = Number(speedSel.value));
  loopBox.onchange = () => {
    remember('loop');
    clip.loop = loopBox.checked;
    changed();
  };
  lenIn.onchange = () => {
    const len = snapT(Number(lenIn.value));
    if (!(len > 0) || clip.keys.length < 2) return refresh();
    remember('length');
    scaleClip(clip, len);
    changed();
  };
  rollBox.onchange = () => (roll = rollBox.checked);
  ghostBox.onchange = () => (ghostOn = ghostBox.checked);
  undoBtn.onclick = () => restore(undo, redo);
  redoBtn.onclick = () => restore(redo, undo);
  revertBtn.onclick = () => {
    remember('revert');
    work[name] = toWork(CODE_CLIPS[name]);
    clip = work[name];
    changed();
  };
  gameBtn.onclick = () => {
    storeDrafts();
    window.open(`${location.pathname}?drafts`, '_blank');
  };
  saveBtn.onclick = () => void save();
  prevBtn.onclick = () => jumpKey(-1);
  nextBtn.onclick = () => jumpKey(1);
  addBtn.onclick = () => {
    remember('add');
    keyHere();
    changed();
  };
  delBtn.onclick = () => {
    if (selected <= 0) return;
    remember('delete');
    deleteKey(clip, selected);
    changed();
  };
  copyBtn.onclick = () => {
    copied = sampleNow();
    flash(`copied the pose at ${t.toFixed(3)} s`);
    refresh();
  };
  pasteBtn.onclick = () => copied && edit('paste', { ...copied });

  function jumpKey(dir: 1 | -1): void {
    playing = false;
    const ks = clip.keys;
    const next = dir > 0 ? ks.find((k) => k.t > t + 1e-6) : [...ks].reverse().find((k) => k.t < t - 1e-6);
    t = next ? next.t : dir > 0 ? ks[ks.length - 1].t : 0;
    changed();
  }

  // timeline: drag a key to retime it, or scrub anywhere else
  const timeAt = (x: number) => {
    const r = track.getBoundingClientRect();
    return Math.max(0, Math.min(range, ((x - r.left) / r.width) * range));
  };
  track.addEventListener('pointerdown', (e) => {
    playing = false;
    track.setPointerCapture(e.pointerId);
    const k = (e.target as HTMLElement).dataset.i;
    if (k !== undefined) {
      draggingKey = Number(k);
      t = clip.keys[draggingKey].t;
      if (draggingKey > 0) remember(`move:${draggingKey}:${performance.now()}`);
    } else {
      t = Math.min(snapT(timeAt(e.clientX)), clipLength(clip as Clip));
    }
    changed();
  });
  track.addEventListener('pointermove', (e) => {
    if (!track.hasPointerCapture(e.pointerId)) return;
    if (draggingKey > 0) {
      t = moveKey(clip, draggingKey, timeAt(e.clientX));
    } else if (draggingKey < 0) {
      t = Math.min(snapT(timeAt(e.clientX)), clipLength(clip as Clip));
    }
    changed();
  });
  const endDrag = () => {
    draggingKey = -1;
    changed();
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  // reference photo
  const showRef = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    refImg.src = URL.createObjectURL(file);
    refImg.hidden = false;
    refGroup.hidden = false;
  };
  refBtn.onclick = () => refFile.click();
  refFile.onchange = () => showRef(refFile.files?.[0]);
  refOpacity.oninput = () => (refImg.style.opacity = refOpacity.value);
  refImg.style.opacity = refOpacity.value;
  refFlip.onclick = () => refImg.classList.toggle('flip');
  refClear.onclick = () => {
    refImg.hidden = true;
    refGroup.hidden = true;
  };
  viewWrap.addEventListener('dragover', (e) => e.preventDefault());
  viewWrap.addEventListener('drop', (e) => {
    e.preventDefault();
    showRef(e.dataTransfer?.files[0]);
  });

  window.addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLInputElement && e.target.type !== 'range' && e.target.type !== 'checkbox';
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void save();
      return;
    }
    if (typing || e.target instanceof HTMLSelectElement) return;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) restore(redo, undo);
      else restore(undo, redo);
    } else if (mod && e.key.toLowerCase() === 'y') restore(redo, undo);
    else if (mod && e.key.toLowerCase() === 'c') copyBtn.click();
    else if (mod && e.key.toLowerCase() === 'v') pasteBtn.click();
    else if (e.code === 'Space') {
      e.preventDefault();
      playBtn.click();
    } else if (e.key === 'k' || e.key === 'K') addBtn.click();
    else if (e.key === 'Delete' || e.key === 'Backspace') delBtn.click();
    else if (e.key === ',') jumpKey(-1);
    else if (e.key === '.') jumpKey(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      playing = false;
      t = Math.min(clipLength(clip as Clip), snapT(t + (e.key === 'ArrowLeft' ? -SNAP : SNAP)));
      changed();
    } else if (e.key === 'Escape') pick(null);
    else if (e.key === 'h') {
      // hide the dots to see the pose underneath
      const show = !handles.get('hips')!.visible;
      for (const m of handles.values()) m.visible = show;
      if (!show) pick(null);
    }
    else if (e.key === 'w') gizmo.setMode('translate');
  });

  const resize = () => {
    const r = viewWrap.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    setInkResolution(buf.x, buf.y, renderer.getPixelRatio());
  };
  new ResizeObserver(resize).observe(viewWrap);
  resize();

  // ---------- frame ----------
  let last = performance.now();
  let shownT = -1;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const len = clipLength(clip as Clip);
    if (playing) {
      if (clip.loop) t = len > 0 ? (t + dt * speed) % len : 0;
      else if (t < len) t = Math.min(len, t + dt * speed);
      else if ((hold += dt) > 0.5) {
        hold = 0;
        t = 0;
      }
      if (roll) rolled += dt * speed * ROLL_SPEED;
    }
    grid.position.x = -(rolled % 1);
    playBtn.textContent = playing ? '❚❚' : '▶';
    const pose = sampleNow();
    rig.preview(pose, name);
    if (!gizmo.dragging) placeHandles(pose);
    drawPoleLines(pose);
    // the ghost: the last key before the playhead (or the one before the key under it)
    const prev = [...clip.keys].reverse().find((k) => k.t < t - 1e-6);
    ghost.mesh.visible = ghostOn && !!prev;
    if (ghostOn && prev) ghost.preview(prev.pose, name);
    if (t !== shownT) {
      shownT = t;
      if (!playing) selected = keyAt(clip, t);
      panelDirty = true;
    }
    if (panelDirty) {
      panelDirty = false;
      drawPanel(pose);
      for (const k of keysRow.children) k.classList.toggle('sel', Number((k as HTMLElement).dataset.i) === selected);
      delBtn.disabled = selected <= 0;
    }
    head.style.left = `${(t / range) * 100}%`;
    timeOut.textContent = `${t.toFixed(3)} s · frame ${Math.round(t * FPS)} / ${Math.round(len * FPS)}`;
    orbit.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  openClip(name, true);
  requestAnimationFrame(frame);
}

function shown(d: FieldDef, v: number): number {
  return d.angle ? Math.round(v * DEG * 10) / 10 : v;
}

function stored(d: FieldDef, v: number): number {
  return d.angle ? v / DEG : v;
}

function fmt(d: FieldDef, v: number): string {
  return d.angle ? `${Math.round(v * DEG)}°` : v.toFixed(2);
}
