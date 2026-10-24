// Draws moving traffic, the enforcer cruiser (the Heat meter) and the drone that drops in at high Heat.
import * as THREE from 'three';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import type { Vehicle, VehicleKind } from '../traffic/traffic';
import { TRAFFIC } from '../traffic/traffic';
import { CROSS, type CrossCar } from '../traffic/cross';
import { makeBus, makeCar, makeTruck, toX, toY } from './kit';
import { model } from './models';
import { inkify } from './toon';
import { headlights } from './night';
import { HeatBeams } from './heat-beams';

const DRONE_EYE = new THREE.Vector3(-0.4, -0.25, 0); // from the drone's centre
import { HeatLights } from './heat-light';

const PAINTS: Record<VehicleKind, number[]> = {
  robotaxi: [0xf2f2f6, 0xd8dce6],
  oncoming: [0xe8c33a, 0x3a7be8, 0xd94a4a, 0x48b86a],
  bus: [0xeeeef2],
  truck: [0xf4f1ea, 0xd9e2ec, 0xffd23f],
};
const BACK_LANE_Z = -2.2;
const CROSS_GONE_Z = 2.7;
const CRUISER_Z = -1.3; // the lane just behind the skate lane

export class TrafficView {
  readonly group = new THREE.Group();
  private meshes = new Map<number, THREE.Group>();
  private cruiser: THREE.Group;
  private lights: THREE.Mesh[] = [];
  private drone: THREE.Group;
  private rotors: THREE.Mesh[] = [];
  private crossings: { car: THREE.Group; post: THREE.Group; red: THREE.Mesh; green: THREE.Mesh }[] = [];
  private cruiserGap = 10; // tiles behind the skater
  private t = 0;
  readonly heatLights = new HeatLights();
  readonly beams = new HeatBeams();
  private readonly beamFrom = new THREE.Vector3();
  private readonly eyeAt = new THREE.Vector3();
  private readonly bar = new THREE.Vector3();

  constructor() {
    this.cruiser = this.makeCruiser();
    this.drone = this.makeDrone();
    this.group.add(this.cruiser, this.drone, this.heatLights.group, this.beams.group);
    inkify(this.group);
  }

  private makeCruiser(): THREE.Group {
    const h = TRAFFIC.carH / TILE;
    const car = makeCar(0, TRAFFIC.carW / TILE, 0, h, 0x1c1c24, 'Cruiser');
    //white doors (the Blender cruiser has its own) and a light bar
    if (car.children.length > 1) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, h * 0.4, 1.62), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
      door.position.set(0, 0.15 + h * 0.3, 0);
      car.add(door);
    }
    //a light bar across the roof: red on the driver's side (away from the camera), blue on the passenger side
    const roof = new THREE.Box3().setFromObject(car).max.y;
    for (const [dz, color] of [[-0.3, 0xff2a2a], [0.3, 0x2a6bff]] as const) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.11, 0.58), new THREE.MeshBasicMaterial({ color }));
      light.position.set(-0.05, roof + 0.055, dz);
      this.lights.push(light);
      car.add(light);
    }
    car.position.z = CRUISER_Z;
    return car;
  }

  private makeDrone(): THREE.Group {
    const drone = new THREE.Group();
    const model3d = model('Drone');
    if (model3d) {
      //the Blender drone (art/drone.py): it faces -x, back at the skater; the rotors spin in chase()
      drone.add(model3d);
      for (let i = 0; i < 4; i++) {
        const rotor = model(`Rotor${i}`);
        if (rotor) {
          this.rotors.push(rotor);
          drone.add(rotor);
        }
      }
      drone.scale.setScalar(1.5);
      drone.visible = false;
      return drone;
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x30303a }));
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    eye.position.set(0.2, -0.06, 0);
    drone.add(body, eye);
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 10), new THREE.MeshBasicMaterial({ color: 0x9aa0b0, transparent: true, opacity: 0.5 }));
      rotor.position.set(x, 0.12, z);
      drone.add(rotor);
    }
    drone.scale.setScalar(1.6);
    drone.visible = false;
    return drone;
  }

  clear(): void {
    for (const m of this.meshes.values()) this.group.remove(m);
    this.meshes.clear();
    for (const c of this.crossings) this.group.remove(c.car, c.post);
    this.crossings = [];
    this.cruiserGap = 10;
  }

  sync(level: Level, vehicles: Vehicle[]): void {
    const live = new Set<number>();
    for (const v of vehicles) {
      live.add(v.id);
      let mesh = this.meshes.get(v.id);
      if (!mesh) {
        const paints = PAINTS[v.kind];
        const [w, b, r, paint] = [toX(v.x1 - v.x0), toY(level, v.bottom), toY(level, v.roof), paints[v.id % paints.length]];
        mesh =
          v.kind === 'bus' ? makeBus(0, w, b, r)
          : v.kind === 'truck' ? makeTruck(0, w, b, r, paint, (v.kicker ?? 0) / TILE)
          : makeCar(0, w, b, r, paint, v.kind === 'robotaxi' ? 'Robotaxi' : 'Sedan');
        if (v.speed < 0) mesh.rotation.y = Math.PI; // oncoming: headlights toward the skater
        inkify(mesh);
        const beams = headlights(toX(v.x1 - v.x0));
        beams.position.y = toY(level, v.bottom);
        mesh.add(beams);
        this.meshes.set(v.id, mesh);
        this.group.add(mesh);
      }
      mesh.position.x = toX((v.x0 + v.x1) / 2);
      mesh.position.z = v.lane * BACK_LANE_Z;
    }
    for (const [id, mesh] of this.meshes) {
      if (!live.has(id)) {
        this.group.remove(mesh);
        this.meshes.delete(id);
      }
    }
  }

  // cross traffic: each intersection's car, coming nose-first out of the back lanes and across, and its light
  syncCross(level: Level, cross: CrossCar[]): void {
    if (this.crossings.length !== cross.length) {
      for (const c of this.crossings) this.group.remove(c.car, c.post);
      this.crossings = cross.map((c, i) => this.makeCrossing(level, c, i));
    }
    cross.forEach((c, i) => {
      const v = this.crossings[i];
      v.car.position.z = c.z;
      //off the front edge of the street it's out of shot
      v.car.visible = c.t >= 0 && c.z < CROSS_GONE_Z;
      v.red.visible = c.red;
      v.green.visible = !c.red;
    });
  }

  private makeCrossing(level: Level, c: CrossCar, i: number): { car: THREE.Group; post: THREE.Group; red: THREE.Mesh; green: THREE.Mesh } {
    const street = toY(level, level.streetY);
    const len = 2.1;
    //a car with its length along z: built along x, turned so the nose faces the camera
    const body = makeCar(0, len, street, toY(level, c.box.roof), PAINTS.oncoming[i % PAINTS.oncoming.length], 'Sedan');
    body.position.x = 0;
    const beams = headlights(len);
    beams.position.y = street;
    body.add(beams);
    body.rotation.y = -Math.PI / 2;
    inkify(body);
    const car = new THREE.Group();
    car.add(body);
    car.position.x = toX((c.box.x0 + c.box.x1) / 2);
    car.visible = false;
    //the light: a post just before the crossing, back of the skate lane, red and green lamps facing the camera
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
    //on the near corner of the cross street, at the back of the sidewalk
    post.position.set(toX(c.box.x0 + CROSS.w / 2) - CROSS.street - 0.45, street, -2.0);
    this.group.add(car, post);
    return { car, post, red, green };
  }

  // heat 0..100; hold: don't creep closer during a remount; caught: pull level with the skater
  // skaterY (px) aims the searchlight; it defaults to the street
  chase(level: Level, skaterX: number, heat: number, hold: boolean, caught: boolean, dtMs: number, skaterY = level.streetY): void {
    this.t += dtMs;
    const target = caught ? 0.2 : 9 - 8.3 * (heat / 100);
    if (!(hold && target < this.cruiserGap)) this.cruiserGap += (target - this.cruiserGap) * (caught ? 0.12 : 0.06);
    const x = toX(skaterX) - this.cruiserGap - TRAFFIC.carW / TILE / 2;
    this.cruiser.position.x = x;
    this.cruiser.position.y = toY(level, level.streetY);
    this.cruiser.visible = this.cruiserGap < 8.8;
    const flash = Math.floor(this.t / 160) % 2 === 0;
    this.lights[0].visible = flash;
    this.lights[1].visible = !flash;
    //the light bar lights the street
    this.lights[0].getWorldPosition(this.bar);
    this.heatLights.update(this.bar, this.cruiser.visible, flash, heat, caught, dtMs / 1000);

    //a drone drops in front at 75
    this.drone.visible = heat >= 75 || caught;
    if (this.drone.visible) {
      this.drone.position.set(toX(skaterX) + 3.5, 3.2 + Math.sin(this.t / 200) * 0.15, 0.4);
      //a slight bank and bob, rotors spinning in opposite pairs
      this.drone.rotation.set(Math.sin(this.t / 330) * 0.06, 0, Math.sin(this.t / 260) * 0.05);
      this.rotors.forEach((r, i) => (r.rotation.y += (i % 3 === 0 ? 1 : -1) * dtMs * 0.06));
    }

    //the pillar searchlight on the cruiser's roof hunts for the skater; the drone's scan sweeps the street below it
    const ground = toY(level, skaterY);
    const from = this.cruiser.visible ? this.beamFrom.set(this.cruiser.position.x + 0.5, this.cruiser.position.y + 1.4, this.cruiser.position.z + 0.35) : null;
    this.beams.searchlight(from, toX(skaterX), ground, heat, caught, dtMs / 1000);
    this.beams.droneScan(this.drone.visible ? this.eyeAt.copy(this.drone.position).add(DRONE_EYE) : null, toY(level, level.streetY));
  }
}
