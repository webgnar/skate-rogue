// Chinatown's moving parts (src/traffic/hill-cross.ts, src/traffic/cab.ts): the cars driving straight across each
// intersection on the way down, nose first, each with its light on the near corner, and the cabs on the cab flats,
// the Taxi model, turning off up the side street at the corner. Greybox: the Chinatown art comes from zack's
// photos (Walled City streets, /mnt/project-files/chinatown/refs).
import * as THREE from 'three';
import type { Level } from '../physics/level';
import type { Traffic } from '../traffic/traffic';
import type { HillCar, HillCross } from '../traffic/hill-cross';
import { CAB, type Cab } from '../traffic/cab';
import { STREET_Z } from '../traffic/traffic';
import { makeCar, toX, toY } from './kit';
import { inkify } from './toon';
import { headlights } from './night';
import { at } from '../game/interp';

const PAINTS = [0xd94a4a, 0x3a7be8, 0xe8e2d0, 0x48b86a, 0x2a2a30, 0xc8a050];
const CAB_YELLOW = 0xf6c21c;
const LEN = 2.1; // tiles: a cross car's length, along the cross street

export class ChinatownView {
  readonly group = new THREE.Group();
  private cars = new Map<HillCar, THREE.Group>();
  private lights: { h: HillCross; red: THREE.Mesh; green: THREE.Mesh }[] = [];
  private cabs: { cab: Cab; mesh: THREE.Group }[] = [];
  private traffic: Traffic | null = null; // the floor's, these were built for

  clear(): void {
    this.traffic = null;
    this.group.clear();
    this.cars.clear();
    this.lights = [];
    this.cabs = [];
  }

  private makeCross(level: Level, car: HillCar, h: HillCross): THREE.Group {
    const bottom = toY(level, h.y);
    const body = makeCar(0, LEN, bottom, toY(level, car.box.roof), PAINTS[(car.look + Math.floor(h.x)) % PAINTS.length], 'Sedan');
    body.position.x = 0;
    const beams = headlights(LEN);
    beams.position.y = bottom;
    body.add(beams);
    //its length along z, nose the way it's driving
    body.rotation.y = car.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    inkify(body);
    const g = new THREE.Group();
    g.add(body);
    g.position.x = toX(h.x);
    this.group.add(g);
    return g;
  }

  private makeLight(level: Level, h: HillCross): void {
    const post = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
    pole.position.y = 1.5;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.25), new THREE.MeshLambertMaterial({ color: 0x1a1a1f }));
    head.position.y = 3.1;
    const red = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    red.position.set(0, 3.27, 0.13);
    const green = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial({ color: 0x3aff7a }));
    green.position.set(0, 2.93, 0.13);
    inkify(post.add(pole, head));
    post.add(red, green);
    //on the corner before the cross street, at the back of the sidewalk
    post.position.set(toX(h.x) - 1.6 - 0.45, toY(level, h.y), STREET_Z.lamp);
    this.group.add(post);
    this.lights.push({ h, red, green });
  }

  private makeCab(level: Level, cab: Cab): THREE.Group {
    const bottom = toY(level, cab.run.y);
    const w = toX(CAB.w);
    //the cab model (art/cars.py Taxi): checker band down the sides, lit roof sign
    const body = makeCar(0, w, bottom, toY(level, cab.box.roof), CAB_YELLOW, 'Taxi');
    body.position.x = 0;
    const beams = headlights(w);
    beams.position.y = bottom;
    body.add(beams);
    inkify(body);
    const g = new THREE.Group();
    g.add(body);
    g.visible = false;
    this.group.add(g);
    return g;
  }

  // where a skitching skater holds on: the cab's back bumper, world space
  grab(level: Level, held: unknown): THREE.Vector3 | null {
    const c = this.cabs.find((k) => k.cab.box === held);
    if (!c) return null;
    return new THREE.Vector3(toX(at(c.cab.box, 'x0')) + 0.05, toY(level, c.cab.run.y) + 0.62, 0.55);
  }

  sync(level: Level, traffic: Traffic): void {
    if (this.traffic !== traffic) {
      this.clear();
      this.traffic = traffic;
      for (const h of traffic.hillCross) this.makeLight(level, h);
      this.cabs = traffic.cabs.map((cab) => ({ cab, mesh: this.makeCab(level, cab) }));
    }
    const live = new Set<HillCar>();
    for (const h of traffic.hillCross) {
      for (const car of h.cars) {
        live.add(car);
        let g = this.cars.get(car);
        if (!g) this.cars.set(car, (g = this.makeCross(level, car, h)));
        g.position.z = at(car, 'z');
      }
    }
    for (const [car, g] of this.cars) {
      if (!live.has(car)) {
        this.group.remove(g);
        this.cars.delete(car);
      }
    }
    for (const l of this.lights) {
      const red = l.h.red;
      l.red.visible = red;
      l.green.visible = !red;
    }
    for (const { cab, mesh } of this.cabs) {
      mesh.visible = cab.state !== 'wait' && cab.state !== 'gone';
      const turn = at(cab, 'turn');
      mesh.position.set(toX((at(cab.box, 'x0') + at(cab.box, 'x1')) / 2), 0, at(cab, 'z'));
      //swinging left, up the side street
      mesh.rotation.y = (turn * Math.PI) / 2;
    }
  }
}
