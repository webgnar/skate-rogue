// The L on Chicago's street (src/traffic/el.ts): the track along the stretch and round its bends into the city,
// built into the floor's kit, and its trains, moved each frame along the same path. The track is the Blender
// ElSpan/ElColumn kit (art/street.py) laid span by span, bent by turning each span to the next point on the bend.
// Trains use the ElCar model when it's there, otherwise a code-built CTA car (stainless, blue and red band).
import * as THREE from 'three';
import { railBar, railMetal } from './rail-metal';
import { surface } from './surfaces';
import { EL, pathAt, pathLength, type ElTrain, type ElStretch } from '../traffic/el';
import type { Level } from '../physics/level';
import { TILE } from '../physics/constants';
import { flatGeometry, hasModel, model } from './models';
import { inkify } from './toon';
import { toX, toY } from './kit';

const SPAN = 3; // ElSpan's length, tiles
const BEND_STEPS = 6; // spans per bend

// the stretches' bends cut the back wall and the city behind it here (tiles), as cross streets do
export function elCuts(level: Level): [number, number][] {
  const out: [number, number][] = [];
  for (const s of level.el ?? []) {
    out.push([toX(s.x0) - EL.bend - 2.2, toX(s.x0) - EL.bend + 2.2], [toX(s.x1) + EL.bend - 2.2, toX(s.x1) + EL.bend + 2.2]);
  }
  return out;
}

// the points the track is laid through, tiles along the path: spans of about 3 on the straights, short ones round
// the bends
function stations(s: ElStretch): number[] {
  const arc = (Math.PI / 2) * EL.bend;
  const straight = (s.x1 - s.x0) / TILE;
  const out = [0];
  const run = (len: number, n: number) => {
    const from = out[out.length - 1];
    for (let i = 1; i <= n; i++) out.push(from + (len * i) / n);
  };
  run(EL.lead, Math.max(1, Math.round(EL.lead / SPAN)));
  run(arc, BEND_STEPS);
  run(straight, Math.max(1, Math.round(straight / SPAN)));
  run(arc, BEND_STEPS);
  run(EL.lead, Math.max(1, Math.round(EL.lead / SPAN)));
  return out;
}

// a piece of the track kit as one vertex-coloured mesh, so the whole L batches into a single draw
const trackMat = new THREE.MeshLambertMaterial({ vertexColors: true });
function piece(name: string): THREE.Group {
  const m = new THREE.Mesh(flatGeometry(name)!, trackMat);
  m.position.copy(model(name)!.position);
  const g = new THREE.Group();
  g.add(m);
  return g;
}

export function buildElTrack(level: Level, kit: THREE.Group): void {
  const built = hasModel('ElSpan') && hasModel('ElColumn') && hasModel('ElColumnCap');
  const steel = surface('steel', 0x2f3a33);
  const tie = surface('planks', 0x3a2a20);
  const lot = surface('asphalt', 0x34313a);
  for (const s of level.el ?? []) {
    const under = toY(level, s.under);
    const marks = stations(s);
    for (let i = 1; i < marks.length; i++) {
      const p = pathAt(s, marks[i - 1]);
      const q = pathAt(s, marks[i] - 1e-6);
      const len = Math.hypot(q.x - p.x, q.z - p.z);
      const turn = Math.atan2(-(q.z - p.z), q.x - p.x);
      //the span's line z = 0 is the track's back edge offset: its running rails straddle z = EL.lane
      const off = new THREE.Vector3(0, 0, -EL.lane).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
      if (built) {
        const span = piece('ElSpan');
        span.position.set(p.x + off.x, under, p.z + off.z);
        span.rotation.y = turn;
        span.scale.x = len / SPAN;
        kit.add(span);
      } else {
        const g = new THREE.Group();
        const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.25, 3.2), steel);
        deck.position.set(len / 2, 0.125, EL.lane);
        g.add(deck);
        for (const z of [-1.35, 1.75]) {
          const girder = new THREE.Mesh(new THREE.BoxGeometry(len, 0.7, 0.12), steel);
          girder.position.set(len / 2, 0.3, z);
          g.add(girder);
        }
        for (let x = 0.25; x < len; x += 0.5) {
          const t = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 2.2), tie);
          t.position.set(x, 0.3, EL.lane);
          g.add(t);
        }
        for (const z of [-0.3, 0.7]) {
          const r = new THREE.Mesh(railBar(len, 0.05), railMetal());
          r.position.set(len / 2, EL.head - 0.05, z);
          g.add(r);
        }
        g.position.set(p.x, under, p.z);
        g.rotation.y = turn;
        kit.add(g);
      }
      //a column under every span's start, but not out in the skate lane: on the straight they stand in the back
      //lane (the model's own offset), round the bends beside the track
      const onStraight = p.heading === 0;
      if (built) {
        const col = piece('ElColumn');
        const cap = piece('ElColumnCap');
        col.position.set(p.x + off.x, 0, p.z + off.z);
        col.rotation.y = turn;
        col.scale.y = under - 0.08;
        cap.position.set(p.x + off.x, under, p.z + off.z);
        cap.rotation.y = turn;
        if (onStraight || i > 1) kit.add(col, cap);
      } else {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, under, 0.35), steel);
        const back = new THREE.Vector3(0, 0, -2.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
        col.position.set(p.x + back.x, under / 2, p.z + back.z);
        kit.add(col);
      }
    }
    //the lots under the bends behind the wall, where the city is cut away for the track
    for (const bx of [toX(s.x0) - EL.bend, toX(s.x1) + EL.bend]) {
      const ground = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.2, EL.lead + 4), lot);
      ground.position.set(bx, -0.1, EL.lane - EL.bend - (EL.lead + 4) / 2 + 1.3);
      kit.add(ground);
    }
  }
}

// ------------------------------------------------------------------------------------------------------ trains

const CAR = { len: EL.carLen / TILE, h: EL.carH / TILE - 0.05, w: 1.9 };

// a CTA car, code-built: stainless body, a dark window band, the blue and red stripe, doors, a sign at the front
function fallbackCar(front: boolean): THREE.Group {
  const g = new THREE.Group();
  const { len, h, w } = CAR;
  const lam = (color: number) => new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, h - 0.3, w), lam(0xc8ccd4));
  body.position.set(0, 0.3 + (h - 0.3) / 2, 0);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(len - 0.3, 0.42, w + 0.02), lam(0x1c2333));
  windows.position.set(0, 0.3 + (h - 0.3) * 0.68, 0);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(len + 0.01, 0.08, w + 0.03), lam(0x1f5fbf));
  blue.position.set(0, 0.3 + (h - 0.3) * 0.42, 0);
  const red = new THREE.Mesh(new THREE.BoxGeometry(len + 0.01, 0.05, w + 0.03), lam(0xc8202a));
  red.position.set(0, 0.3 + (h - 0.3) * 0.36, 0);
  const trucks = new THREE.Mesh(new THREE.BoxGeometry(len - 0.6, 0.3, w - 0.3), lam(0x222228));
  trucks.position.set(0, 0.15, 0);
  g.add(body, windows, blue, red, trucks);
  for (const dx of [-len * 0.25, len * 0.25]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, h - 0.55, w + 0.025), lam(0xa8acb6));
    door.position.set(dx, 0.3 + (h - 0.55) / 2 + 0.05, 0);
    g.add(door);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(len * 0.5, 0.12, w * 0.5), lam(0x6a6e78));
  roof.position.set(0, h + 0.06, 0);
  g.add(roof);
  if (front) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.9), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
    sign.position.set(len / 2 + 0.02, h - 0.22, 0);
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    g.add(sign);
    for (const z of [-0.6, 0.6]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.2), lamp);
      head.position.set(len / 2 + 0.02, 0.55, z);
      g.add(head);
    }
  }
  return g;
}

function trainCar(front: boolean): THREE.Group {
  const name = front && hasModel('ElCarFront') ? 'ElCarFront' : 'ElCar';
  if (hasModel(name)) {
    //one vertex-coloured mesh per car, so a train costs two draws (and two outlines), not one per material
    const g = new THREE.Group();
    const m = new THREE.Mesh(flatGeometry(name)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.position.copy(model(name)!.position);
    m.position.x -= CAR.len / 2; // the model's origin is its back end, already centred on the track (z = EL.lane)
    m.position.z -= EL.lane;
    g.add(m);
    return g;
  }
  return fallbackCar(front);
}

export class ElView {
  readonly group = new THREE.Group();
  private lines: { train: ElTrain; cars: THREE.Group[] }[] = [];

  clear(): void {
    for (const l of this.lines) for (const c of l.cars) this.group.remove(c);
    this.lines = [];
  }

  // each train's cars along its track: placed between where its back and front are on the path
  sync(level: Level, trains: readonly ElTrain[]): void {
    if (this.lines.length !== trains.length || this.lines.some((l, i) => l.train !== trains[i])) {
      this.clear();
      this.lines = trains.map((train) => {
        const cars = Array.from({ length: EL.cars }, (_, i) => trainCar(i === 0));
        for (const c of cars) {
          inkify(c);
          c.visible = false;
          this.group.add(c);
        }
        return { train, cars };
      });
    }
    for (const { train, cars } of this.lines) {
      const spans = train.cars();
      const total = pathLength(train.stretch);
      const y = toY(level, train.stretch.y);
      cars.forEach((car, i) => {
        const span = spans[i];
        if (!span || span[1] <= 0 || span[0] >= total) {
          car.visible = false;
          return;
        }
        const p = pathAt(train.stretch, Math.max(0, span[0]));
        const q = pathAt(train.stretch, Math.min(total, span[1]));
        car.visible = true;
        car.position.set((p.x + q.x) / 2, y, (p.z + q.z) / 2);
        car.rotation.y = Math.atan2(-(q.z - p.z), q.x - p.x);
      });
    }
  }
}
