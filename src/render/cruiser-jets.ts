// The Heat cruiser's jump jets (zack: "when the chasing cop car jumps the water it should have jet thrusters under
// it"). Two thruster pods fold down out of the chassis as the cruiser leaves the bank over a canal, and fire for
// the jump: a white-hot core in an orange flame, flickering in length (never in brightness, so nothing strobes),
// roaring hardest on the way up. They fold away again after it lands. TrafficView drives them from the cruiser's
// path height; game.ts adds the exhaust smoke and the touchdown dust from the shared particle pool.
import * as THREE from 'three';
import { inkify } from './toon';
import type { Particles } from './particles';

const hex = (c: number) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const SMOKE = [hex(0xd8d0e0), hex(0xb0a8bc), hex(0x8a8496)];
const FIRE = [hex(0xfff4c8), hex(0xffb04a), hex(0xff7a1a)];
const DUST = [hex(0xd8c8a8), hex(0xb8a888)];

export const JETS = {
  pods: [-0.22, 0.32], // along the car from its middle, tiles: between the wheels, where the camera sees them
  side: 0.72, // out on the camera's side of the chassis, tiles (the car is about 1.6 deep)
  podY: 0.3, // the pods' tops when out (the sill); they fold up into the body
  podR: 0.2,
  flame: 1.5, // flame length at full thrust, tiles
  deploy: 0.12, // seconds to fold out
  stow: 0.45, // seconds to fold away after landing
  lift: 1.35, // flame on the way up, against 1 on the way down
};

const flameVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// v runs 0 at the tip to 1 at the nozzle on three's ConeGeometry (flipped to point down)
const flameFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAmt;
  varying vec2 vUv;
  void main() {
    float a = pow(vUv.y, 1.3) * uAmt;
    gl_FragColor = vec4(uColor * a, 1.0);
    #include <colorspace_fragment>
  }
`;

function flameMat(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: flameVertex,
    fragmentShader: flameFragment,
    uniforms: { uColor: { value: new THREE.Color(color) }, uAmt: { value: 1 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// a cone 1 long, its base (the nozzle end) at the origin, pointing straight down
const flameGeo = new THREE.ConeGeometry(1, 1, 10, 1, true).rotateX(Math.PI).translate(0, -0.5, 0);

// how far out the pods are and how hard they fire, for a cruiser `y` tiles up over a canal moving `vy` tiles/s
export function jetState(out: number, y: number, vy: number, dt: number): { out: number; thrust: number } {
  const air = y > 0.02;
  const next = air ? Math.min(1, out + dt / JETS.deploy) : Math.max(0, out - dt / JETS.stow);
  const thrust = air ? next * (vy > 0 ? JETS.lift : 1) : 0;
  return { out: next, thrust };
}

export class CruiserJets {
  readonly group = new THREE.Group();
  private readonly pods: THREE.Group[] = [];
  private readonly flames: THREE.Mesh[] = [];
  private readonly outer = flameMat(0xff7a1a);
  private readonly core = flameMat(0xfff4c8);
  private readonly nozzle = new THREE.Vector3();
  out = 0; // 0 stowed .. 1 down
  thrust = 0; // 0 .. JETS.lift
  private lastY = 0;
  private t = 0;
  landed = false; // it touched down this frame

  constructor() {
    const housing = new THREE.MeshLambertMaterial({ color: 0x3a3e48 });
    const rim = new THREE.MeshLambertMaterial({ color: 0x9aa0ae });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffb04a });
    for (const x of JETS.pods) {
      const pod = new THREE.Group();
      //a squat can with a flared nozzle and a hot ring inside it
      const can = new THREE.Mesh(new THREE.CylinderGeometry(JETS.podR, JETS.podR * 0.9, 0.22, 10), housing);
      can.position.y = -0.11;
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(JETS.podR * 0.8, JETS.podR * 1.05, 0.12, 10, 1, true), rim);
      bell.position.y = -0.28;
      const hot = new THREE.Mesh(new THREE.CircleGeometry(JETS.podR * 0.75, 10).rotateX(Math.PI / 2), glow);
      hot.position.y = -0.33;
      pod.add(can, bell, hot);
      inkify(pod);
      const outerFlame = new THREE.Mesh(flameGeo, this.outer);
      const coreFlame = new THREE.Mesh(flameGeo, this.core);
      for (const f of [outerFlame, coreFlame]) {
        f.position.y = -0.34;
        f.renderOrder = 3;
        f.frustumCulled = false;
        pod.add(f);
        this.flames.push(f);
      }
      pod.position.set(x, JETS.podY, JETS.side);
      pod.visible = false;
      this.pods.push(pod);
      this.group.add(pod);
    }
  }

  // y: the cruiser's height over the street (CruiserPath.y), tiles
  update(y: number, dt: number): void {
    this.t += dt;
    const vy = dt > 0 ? (y - this.lastY) / dt : 0;
    this.landed = this.lastY > 0.02 && y <= 0.02;
    this.lastY = y;
    const s = jetState(this.out, y, vy, dt);
    this.out = s.out;
    this.thrust = s.thrust;
    const ease = this.out * this.out * (3 - 2 * this.out);
    this.pods.forEach((pod, i) => {
      pod.visible = this.out > 0;
      //down out of the chassis, and a touch of swing as they lock
      pod.position.y = JETS.podY + 0.25 * (1 - ease);
      pod.scale.setScalar(0.4 + 0.6 * ease);
      pod.rotation.z = (1 - ease) * (i === 0 ? 0.6 : -0.6);
    });
    //the flames flicker in length, never in brightness
    this.flames.forEach((f, i) => {
      const core = i % 2 === 1;
      const flick = 0.85 + 0.1 * Math.sin(this.t * 37 + i * 1.7) + 0.05 * Math.sin(this.t * 61 + i);
      const len = JETS.flame * this.thrust * flick * (core ? 0.55 : 1);
      const r = JETS.podR * (core ? 0.5 : 0.95);
      f.visible = len > 0.02;
      f.scale.set(r, Math.max(0.001, len), r);
    });
    this.outer.uniforms.uAmt.value = 1.4;
    this.core.uniforms.uAmt.value = 1.8;
  }

  // where pod i's nozzle is in the world, for the exhaust
  nozzleAt(i: number, out = this.nozzle): THREE.Vector3 {
    return this.pods[i].localToWorld(out.set(0, -0.34, 0));
  }

  // the exhaust (smoke and embers off each nozzle while they fire) and the dust where it lands; z its lane
  exhaust(p: Particles, ground: number, dt: number): void {
    if (this.thrust > 0) {
      for (let i = 0; i < this.pods.length; i++) {
        const n = this.nozzleAt(i);
        const tip = n.y - JETS.flame * this.thrust * 0.8;
        p.stream(`jetSmoke${i}`, n.x, tip, 22 * this.thrust, dt, { n: 0, colors: SMOKE, life: [0.5, 0.9], size: [0.16, 0.26], size1: 0.5, speed: [0.6, 1.6], angle: [Math.PI * 0.35, Math.PI * 0.65], jitter: 0.12, drag: 2.5, grav: -1.2, alpha: 0.55, fadeFrom: 0, z: n.z });
        p.stream(`jetFire${i}`, n.x, tip + 0.1, 16 * this.thrust, dt, { n: 0, colors: FIRE, life: [0.15, 0.3], size: [0.07, 0.11], speed: [2, 4], angle: [-Math.PI * 0.62, -Math.PI * 0.38], jitter: 0.06, grav: 4, floor: ground, z: n.z });
      }
    }
    if (this.landed) {
      const a = this.nozzleAt(0).clone();
      const b = this.nozzleAt(1);
      for (const n of [a, b]) p.spray(n.x, ground + 0.05, { n: 10, colors: DUST, life: [0.4, 0.7], size: [0.14, 0.22], size1: 0.4, speed: [1, 2.6], angle: [Math.PI * 0.05, Math.PI * 0.95], jitter: 0.2, drag: 2.5, grav: -0.2, alpha: 0.7, fadeFrom: 0, z: n.z });
    }
  }

  // a fresh floor: stowed
  reset(): void {
    this.out = this.thrust = this.lastY = 0;
    this.landed = false;
    for (const pod of this.pods) pod.visible = false;
  }
}
