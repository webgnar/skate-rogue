// The street dice's physics (zack, 2026-11-10: "actual physics ... a 3d ground, and the dice actually threw based on
// the players finger swipe or shaking the phone"). Two real rigid-body dice (cannon-es) thrown onto a patch of street:
// asphalt underfoot, the curb along the back, and invisible walls at the edges of the view so a pair never leaves it.
// Whatever face points up when they come to rest is the roll (src/run/dice.ts pays it). No DOM: the 3D view
// (src/render/dice3d.ts) draws it, and the tests throw it headless.
// Units: a die is 1 across. y is up, -z is away from you (toward the curb).
import * as CANNON from 'cannon-es';
import type { Face } from './dice';

export const DICE_PHYS = {
  gravity: 70, // die sizes / s². Real dice fall at ~600 of theirs; this reads right at the screen's zoom
  step: 1 / 120, // s, the physics step
  restitution: 0.32, // a die's bounce off the asphalt
  wallBounce: 0.45, // off the curb and the edges
  friction: 0.42,
  minSpeed: 9, // a throw's speed, die sizes a second, slowest and fastest
  maxSpeed: 26,
  tapSpeed: 15, // a tap, the ROLL button or a key: a toss at this speed
  lift: 3.2, // up, on top of a throw's speed (plus a share of it)
  liftShare: 0.22,
  spin: 16, // rad/s of tumble a throw puts on (plus a share of its speed)
  spinShare: 0.7,
  restSpeed: 0.12, // under this (and spinning under restSpin) a die counts as still
  restSpin: 0.2,
  restFor: 0.3, // s both dice have to stay still to count as landed
  cocked: 0.94, // a die whose top face points up less than this (cos of its tilt) is cocked on the curb or the other die
  maxNudges: 3, // cocked dice get this many nudges, then the face nearest up counts
  maxTime: 8, // s: a pair still moving after this counts anyway, face nearest up
  ceiling: 7, // the invisible lid, so a hard throw stays in view
};

// which face of the cube shows which number (opposite faces add up to 7): its outward normal in the die's own space
export const FACE_NORMAL: Record<Face, [number, number, number]> = {
  1: [0, 1, 0],
  6: [0, -1, 0],
  2: [1, 0, 0],
  5: [-1, 0, 0],
  3: [0, 0, 1],
  4: [0, 0, -1],
};

// the face pointing most nearly up, and how nearly (the cosine of the die's tilt off it)
export function faceUp(q: { x: number; y: number; z: number; w: number }): { face: Face; up: number } {
  let face: Face = 1;
  let up = -2;
  const n = new CANNON.Vec3();
  const quat = new CANNON.Quaternion(q.x, q.y, q.z, q.w);
  for (const f of [1, 2, 3, 4, 5, 6] as Face[]) {
    const [x, y, z] = FACE_NORMAL[f];
    quat.vmult(new CANNON.Vec3(x, y, z), n);
    if (n.y > up) (up = n.y), (face = f);
  }
  return { face, up };
}

// the patch of street the dice land on: x from -halfW to halfW, z from back (the curb's face) to front
export interface Bounds {
  halfW: number;
  back: number;
  front: number;
}

export type Vec = { x: number; y: number; z: number };

export class DicePhysics {
  readonly world = new CANNON.World({ gravity: new CANNON.Vec3(0, -DICE_PHYS.gravity, 0) });
  readonly dice: CANNON.Body[] = [];
  private readonly walls: Record<'left' | 'right' | 'back' | 'front' | 'lid', CANNON.Body>;
  private still = 0; // s both dice have been still
  private time = 0; // s since the throw
  private nudges = 0;
  private acc = 0;
  thrown = false;
  landed: [Face, Face] | null = null;

  constructor(
    bounds: Bounds,
    private readonly rng: () => number = Math.random,
  ) {
    const w = this.world;
    w.allowSleep = true;
    (w.solver as CANNON.GSSolver).iterations = 14;
    const dieMat = new CANNON.Material('die');
    const groundMat = new CANNON.Material('ground');
    const wallMat = new CANNON.Material('wall');
    w.addContactMaterial(new CANNON.ContactMaterial(dieMat, groundMat, { friction: DICE_PHYS.friction, restitution: DICE_PHYS.restitution }));
    w.addContactMaterial(new CANNON.ContactMaterial(dieMat, wallMat, { friction: 0.2, restitution: DICE_PHYS.wallBounce }));
    w.addContactMaterial(new CANNON.ContactMaterial(dieMat, dieMat, { friction: 0.3, restitution: 0.4 }));
    //the ground, and the walls as planes facing in
    const plane = (mat: CANNON.Material, axis: CANNON.Vec3, angle: number) => {
      const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Plane() });
      b.quaternion.setFromAxisAngle(axis, angle);
      w.addBody(b);
      return b;
    };
    const X = new CANNON.Vec3(1, 0, 0);
    const Y = new CANNON.Vec3(0, 1, 0);
    plane(groundMat, X, -Math.PI / 2); // facing +y
    this.walls = {
      left: plane(wallMat, Y, Math.PI / 2), // facing +x
      right: plane(wallMat, Y, -Math.PI / 2), // facing -x
      back: plane(wallMat, Y, 0), // facing +z
      front: plane(wallMat, Y, Math.PI), // facing -z
      lid: plane(wallMat, X, Math.PI / 2), // facing -y
    };
    this.walls.lid.position.y = DICE_PHYS.ceiling;
    for (let i = 0; i < 2; i++) {
      const d = new CANNON.Body({ mass: 1, material: dieMat, shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)), linearDamping: 0.04, angularDamping: 0.06 });
      d.allowSleep = true;
      d.sleepSpeedLimit = DICE_PHYS.restSpeed;
      d.sleepTimeLimit = 0.25;
      d.type = CANNON.Body.KINEMATIC;
      w.addBody(d);
      this.dice.push(d);
    }
    this.fit(bounds);
  }

  fit(b: Bounds): void {
    this.walls.left.position.x = -b.halfW;
    this.walls.right.position.x = b.halfW;
    this.walls.back.position.z = b.back;
    this.walls.front.position.z = b.front;
    //a die outside the new walls (the phone turned) comes back in
    for (const d of this.dice) {
      d.position.x = Math.max(-b.halfW + 0.6, Math.min(b.halfW - 0.6, d.position.x));
      d.position.z = Math.max(b.back + 0.6, Math.min(b.front - 0.6, d.position.z));
    }
  }

  // the pair held in your hand at p: a die either side, turned anyhow
  hold(p: Vec, wobble = 0, now = 0): void {
    this.thrown = false;
    this.landed = null;
    this.dice.forEach((d, i) => {
      const side = i ? 1 : -1;
      const a = now / 90 + i * 2.3;
      d.type = CANNON.Body.KINEMATIC;
      d.velocity.setZero();
      d.angularVelocity.setZero();
      d.position.set(p.x + side * 0.62 + Math.sin(a * 1.3) * wobble * 0.4, p.y + i * 0.08 + Math.cos(a * 1.7) * wobble * 0.3, p.z + i * 0.12);
    });
  }

  // a fresh pair, turned at random (so how they land is up to the throw)
  shuffle(): void {
    for (const d of this.dice) {
      d.quaternion.setFromEuler(this.rng() * 6.3, this.rng() * 6.3, this.rng() * 6.3);
    }
  }

  // rattle the dice in your hand (the phone shaking): spin them a little
  turn(amount: number): void {
    for (const d of this.dice) {
      const q = new CANNON.Quaternion();
      q.setFromEuler((this.rng() - 0.5) * amount, (this.rng() - 0.5) * amount, (this.rng() - 0.5) * amount);
      d.quaternion = q.mult(d.quaternion);
    }
  }

  // let go: v is the throw (die sizes a second, along the street); it's kept between the slowest and fastest throw,
  // always heading away from you a little, and gets lift and tumble on top
  throw(v: Vec): void {
    const flat = Math.hypot(v.x, v.z);
    const speed = Math.max(DICE_PHYS.minSpeed, Math.min(DICE_PHYS.maxSpeed, flat));
    let dx = flat > 0.01 ? v.x / flat : 0;
    let dz = flat > 0.01 ? v.z / flat : -1;
    if (dz > -0.35) {
      //a sideways or backward swipe still sends the dice up the street
      dz = -0.35;
      const s = Math.sqrt(1 - dz * dz);
      dx = (dx >= 0 ? 1 : -1) * s;
    }
    this.dice.forEach((d, i) => {
      const jitter = 1 + (this.rng() - 0.5) * 0.18;
      const sx = dx * speed * jitter + (this.rng() - 0.5) * 1.2 + (i ? 0.4 : -0.4);
      const sz = dz * speed * jitter + (this.rng() - 0.5) * 1.2;
      d.type = CANNON.Body.DYNAMIC;
      d.wakeUp();
      d.velocity.set(sx, DICE_PHYS.lift + speed * DICE_PHYS.liftShare + this.rng() * 1.5, sz);
      //tumbling forward the way it was thrown, and a random spin on top
      const roll = DICE_PHYS.spin + speed * DICE_PHYS.spinShare;
      d.angularVelocity.set(-dz * roll + (this.rng() - 0.5) * roll, (this.rng() - 0.5) * roll, dx * roll + (this.rng() - 0.5) * roll);
    });
    this.thrown = true;
    this.landed = null;
    this.still = 0;
    this.time = 0;
    this.nudges = 0;
    this.acc = 0;
  }

  // run the physics on by dt seconds (in fixed steps); the faces once both dice have come to rest
  advance(dt: number): [Face, Face] | null {
    if (!this.thrown || this.landed) return this.landed;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= DICE_PHYS.step && !this.landed) {
      this.acc -= DICE_PHYS.step;
      this.world.step(DICE_PHYS.step);
      this.time += DICE_PHYS.step;
      this.check();
    }
    return this.landed;
  }

  // run it to the end now (a tap while they tumble, reduce motion)
  finish(): [Face, Face] {
    for (let i = 0; i < 20000 && !this.landed; i++) this.advance(DICE_PHYS.step);
    return this.landed ?? this.read();
  }

  private read(): [Face, Face] {
    return [faceUp(this.dice[0].quaternion).face, faceUp(this.dice[1].quaternion).face];
  }

  private check(): void {
    const calm = this.dice.every((d) => d.sleepState === CANNON.Body.SLEEPING || (d.velocity.length() < DICE_PHYS.restSpeed && d.angularVelocity.length() < DICE_PHYS.restSpin));
    this.still = calm ? this.still + DICE_PHYS.step : 0;
    const late = this.time > DICE_PHYS.maxTime;
    if (this.still < DICE_PHYS.restFor && !late) return;
    //cocked: leaning on the curb or on the other die. Like a street game, it doesn't count: give it a nudge
    const cocked = this.dice.filter((d) => faceUp(d.quaternion).up < DICE_PHYS.cocked || d.position.y > 0.75);
    if (cocked.length && this.nudges < DICE_PHYS.maxNudges && !late) {
      this.nudges++;
      this.still = 0;
      for (const d of cocked) {
        d.wakeUp();
        d.velocity.set((this.rng() - 0.5) * 3, 3.5, 2 + this.rng() * 2);
        d.angularVelocity.set((this.rng() - 0.5) * 10, (this.rng() - 0.5) * 10, (this.rng() - 0.5) * 10);
      }
      return;
    }
    this.landed = this.read();
    for (const d of this.dice) {
      d.velocity.setZero();
      d.angularVelocity.setZero();
      d.type = CANNON.Body.KINEMATIC;
    }
  }
}
