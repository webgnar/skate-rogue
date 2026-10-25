// Hair and loose cloth that trail the skater's motion (zack, 2026-10-25: "trail the direction the players falling or
// going"). The skater GLBs hang hair clumps and drawstrings off chains of extra bones named 'Spring<chain>_<n>'
// (art/skaters.py). Each bone's tail is a verlet particle in world space: it keeps its momentum, falls with gravity
// and is pulled back toward where the pose would put it, held at the bone's length from the bone's head and pushed
// out of the head and chest. So when the skater rolls, pops or falls, the hair lags behind and streams the other way.
// The clips never key these bones.
import * as THREE from 'three';

export const SPRING = {
  stiffness: 0.05, // pull back toward the posed direction, per step
  drag: 0.12, // momentum lost per step
  gravity: 6, // rig units per s², down in world space
  step: 1 / 60, // fixed solver step, s
  maxSteps: 4, // a slow frame catches up at most this many steps
  jump: 3, // a head that moves more than this (rig units) in a frame was teleported: snap to rest
};

interface Link {
  bone: THREE.Bone;
  rest: THREE.Quaternion; // the bone's bind rotation, in its parent's space
  tail: THREE.Vector3; // its tail in its own space (the next bone's head, or its length on along the chain)
  p: THREE.Vector3; // the tail particle, world space
  prev: THREE.Vector3;
}

interface Collider {
  bone: THREE.Object3D;
  at: THREE.Vector3; // centre in the bone's space
  r: number; // rig units
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const lag = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();

export class Springs {
  private readonly chains: Link[][] = [];
  private readonly colliders: Collider[] = [];
  private readonly head = new THREE.Vector3();
  private acc = 0;
  private fresh = true;

  // `model` in its bind pose; collider centres are world positions at that pose, radii in rig units
  constructor(model: THREE.Object3D, colliders: { bone: string; at: THREE.Vector3; r: number }[]) {
    model.updateMatrixWorld(true);
    const roots: THREE.Bone[] = [];
    model.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone && b.name.startsWith('Spring') && !b.parent?.name.startsWith('Spring')) roots.push(b);
    });
    for (const root of roots) {
      const chain: Link[] = [];
      for (let b: THREE.Bone | undefined = root; b; b = b.children.find((c): c is THREE.Bone => (c as THREE.Bone).isBone && c.name.startsWith('Spring'))) {
        chain.push({ bone: b, rest: b.quaternion.clone(), tail: new THREE.Vector3(), p: new THREE.Vector3(), prev: new THREE.Vector3() });
      }
      chain.forEach((l, i) => {
        const next = chain[i + 1];
        // the last bone has no child to end at: it runs on as far as the one before it
        l.tail.copy(next ? next.bone.position : chain.length > 1 ? chain[i].bone.position : new THREE.Vector3(0, 0.1, 0));
      });
      this.chains.push(chain);
    }
    for (const c of colliders) {
      let bone: THREE.Object3D | undefined;
      model.traverse((o) => (bone ??= (o as THREE.Bone).isBone && o.name === c.bone ? o : undefined));
      if (!bone) continue;
      // keep the centre in the bone's space so it moves with it
      this.colliders.push({ bone, at: c.at.clone().applyMatrix4(bone.matrixWorld.clone().invert()), r: c.r });
    }
  }

  get count(): number {
    return this.chains.length;
  }

  // next frame starts every tail where the pose puts it, at rest (after a respawn, or entering the editor)
  reset(): void {
    this.fresh = true;
  }

  // after the pose: swing the chains for `dt` seconds. `scale` is the rig's world scale (rig units to world).
  update(dt: number, scale: number): void {
    if (!this.chains.length) return;
    for (const chain of this.chains) chain[0].bone.parent!.updateWorldMatrix(true, false);
    // a jump in where the chains hang from is a teleport, not motion
    this.chains[0][0].bone.parent!.getWorldPosition(v1);
    if (!this.fresh && v1.distanceTo(this.head) > SPRING.jump * scale) this.fresh = true;
    if (this.fresh) {
      for (const chain of this.chains) this.rest(chain);
      this.head.copy(v1);
      this.fresh = false;
      this.acc = 0;
      return;
    }
    this.acc = Math.min(this.acc + dt, SPRING.step * SPRING.maxSteps);
    const steps = Math.floor(this.acc / SPRING.step);
    if (!steps) return; // the move carries over to the next frame's steps
    this.acc -= steps * SPRING.step;
    // the skater's move since the last steps, shared out over this frame's steps: each step sees the body only part
    // of the way there, so a slow frame doesn't fling the hair ahead
    const move = v1.clone().sub(this.head);
    this.head.copy(v1);
    const g = SPRING.gravity * scale * SPRING.step * SPRING.step;
    for (const chain of this.chains) {
      for (let s = 0; s < steps; s++) this.solve(chain, g, scale, lag.copy(move).multiplyScalar(1 - (s + 1) / steps));
      this.aim(chain);
    }
  }

  private rest(chain: Link[]): void {
    for (const l of chain) {
      l.bone.quaternion.copy(l.rest);
      l.bone.updateMatrixWorld(true);
      l.p.copy(l.tail).applyMatrix4(l.bone.matrixWorld);
      l.prev.copy(l.p);
    }
  }

  // `back`: how far the body still has to go this frame (it is drawn back by that much)
  private solve(chain: Link[], g: number, scale: number, back: THREE.Vector3): void {
    // heads move with the pose; each tail swings about the tail before it (or the chain's root)
    for (let i = 0; i < chain.length; i++) {
      const l = chain[i];
      l.bone.quaternion.copy(l.rest);
      l.bone.updateMatrixWorld(true);
      const head = i ? chain[i - 1].p : l.bone.getWorldPosition(v1).sub(back);
      const posed = v2.copy(l.tail).applyMatrix4(l.bone.matrixWorld);
      posed.sub(l.bone.getWorldPosition(v3)).add(head); // the posed direction, hung from the (swung) head
      const len = l.tail.length() * scale;
      const next = v3
        .copy(l.p)
        .sub(l.prev)
        .multiplyScalar(1 - SPRING.drag)
        .add(l.p)
        .addScaledVector(posed.sub(l.p), SPRING.stiffness);
      next.y -= g;
      // hold the bone's length, then push out of the body
      next.sub(head).setLength(len).add(head);
      for (const c of this.colliders) {
        const at = v2.copy(c.at).applyMatrix4(c.bone.matrixWorld).sub(back);
        const r = c.r * scale;
        const d = next.distanceTo(at);
        if (d < r) next.sub(at).setLength(r).add(at).sub(head).setLength(len).add(head);
      }
      l.prev.copy(l.p);
      l.p.copy(next);
    }
  }

  // turn each bone so its tail points at its particle
  private aim(chain: Link[]): void {
    for (const l of chain) {
      l.bone.quaternion.copy(l.rest);
      l.bone.updateMatrixWorld(true);
      const head = l.bone.getWorldPosition(v1);
      const from = v2.copy(l.tail).applyMatrix4(l.bone.matrixWorld).sub(head).normalize();
      const to = v3.copy(l.p).sub(head).normalize();
      const turn = q1.setFromUnitVectors(from, to);
      l.bone.getWorldQuaternion(q2).premultiply(turn);
      l.bone.parent!.getWorldQuaternion(q1).invert();
      l.bone.quaternion.copy(q1.multiply(q2));
      l.bone.updateMatrixWorld(true);
    }
  }
}

// where a skater's body pushes hair out: world positions at the bind pose from the bones' (art/lou_gnar.py sizes,
// rig units; `scale` is the rig's world scale)
export function bodyColliders(bindPos: (name: string) => THREE.Vector3 | undefined, scale: number): { bone: string; at: THREE.Vector3; r: number }[] {
  const out: { bone: string; at: THREE.Vector3; r: number }[] = [];
  const head = bindPos('Head');
  const chest = bindPos('Spine1');
  if (head) out.push({ bone: 'Head', at: head.clone().add(new THREE.Vector3(0, 0.14 * scale, 0)), r: 0.15 });
  if (chest) out.push({ bone: 'Spine1', at: chest.clone().add(new THREE.Vector3(0, 0.08 * scale, 0)), r: 0.17 });
  return out;
}
