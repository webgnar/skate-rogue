// Draws moving traffic, the enforcer cruiser (the Heat meter) and the drone that drops in at high Heat.
import * as THREE from 'three';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import type { Vehicle } from '../traffic/traffic';
import { TRAFFIC } from '../traffic/traffic';
import { makeCar, toX, toY } from './kit';
import { inkify } from './toon';
import { HeatLights } from './heat-light';

const PAINTS = { robotaxi: [0xf2f2f6, 0xd8dce6], oncoming: [0xe8c33a, 0x3a7be8, 0xd94a4a, 0x48b86a] };
const BACK_LANE_Z = -2.2;
const CRUISER_Z = -1.3; // the lane just behind the skate lane

export class TrafficView {
  readonly group = new THREE.Group();
  private meshes = new Map<number, THREE.Group>();
  private cruiser: THREE.Group;
  private lights: THREE.Mesh[] = [];
  private drone: THREE.Group;
  private cruiserGap = 10; // tiles behind the skater
  private t = 0;
  readonly heatLights = new HeatLights();
  private readonly bar = new THREE.Vector3();

  constructor() {
    this.cruiser = this.makeCruiser();
    this.drone = this.makeDrone();
    this.group.add(this.cruiser, this.drone, this.heatLights.group);
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
    this.cruiserGap = 10;
  }

  sync(level: Level, vehicles: Vehicle[]): void {
    const live = new Set<number>();
    for (const v of vehicles) {
      live.add(v.id);
      let mesh = this.meshes.get(v.id);
      if (!mesh) {
        const paints = PAINTS[v.kind];
        mesh = makeCar(0, toX(v.x1 - v.x0), toY(level, v.bottom), toY(level, v.roof), paints[v.id % paints.length], v.kind === 'robotaxi' ? 'Robotaxi' : 'Sedan');
        if (v.speed < 0) mesh.rotation.y = Math.PI; // oncoming: headlights toward the skater
        inkify(mesh);
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

  // heat 0..100; hold: don't creep closer during a remount; caught: pull level with the skater
  chase(level: Level, skaterX: number, heat: number, hold: boolean, caught: boolean, dtMs: number): void {
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
    }
  }
}
