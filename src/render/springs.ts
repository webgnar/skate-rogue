// Hair and loose cloth that trail the skater's motion (zack, 2026-10-25: "trail the direction the players falling or
// going"). The skater GLBs hang hair clumps and drawstrings off chains of extra bones named 'Spring<chain>_<n>'
// (art/skaters.py). Each bone's tail is a verlet particle in world space: it keeps its momentum, falls with gravity
// and is pulled back toward where the pose would put it, held at the bone's length from the bone's head and pushed
// out of the head and chest. So when the skater rolls, pops or falls, the hair lags behind and streams the other way.
// The clips never key these bones. Hair, drawstrings and fabric are all just chains: each kind gets its own feel from
// SPRING_KINDS by its bone name. Fabric (zack, 2026-10-31: Keanu's hood "should be like the hair") is a row of chains
// side by side, 'SpringHood0', 'SpringHood1'...: each tail is also tied to the same tail on the chains either side, so
// the row moves as one sheet that balloons and flaps instead of a fringe of separate strands. A sheet that closes into
// a loop (the hood, a sweatshirt's body) ties its last chain back to its first.
import * as THREE from 'three';

export const SPRING = {
  stiffness: 0.05, // pull back toward the posed direction, per step
  drag: 0.12, // momentum lost per step
  gravity: 6, // rig units per s², down in world space
  step: 1 / 60, // fixed solver step, s
  maxSteps: 4, // a slow frame catches up at most this many steps
  jump: 3, // a head that moves more than this (rig units) in a frame was teleported: snap to rest
};

export type SpringFeel = Pick<typeof SPRING, 'stiffness' | 'drag' | 'gravity'> & {
  cloth?: number; // fabric: how hard each tail holds its distance to its neighbours' (0..1, per step)
};

// per kind of chain, by the start of its bones' names (the longest match wins); anything else feels like SPRING.
// Anime spikes are gelled: they stand up against gravity and snap back, flicking at the tips on a pop or a landing.
export const SPRING_KINDS: Record<string, Partial<SpringFeel>> = {
  SpringSpike: { stiffness: 0.22, drag: 0.2, gravity: 1 },
  SpringLock: { stiffness: 0.1, drag: 0.14, gravity: 4 }, // the locks framing the face
  // a hood up over the head: soft, so it puffs back off the head with speed and flops on a landing
  SpringHood: { stiffness: 0.035, drag: 0.08, gravity: 5, cloth: 0.6 },
  // a sweatshirt's body hanging off the chest: a little firmer, so it swings out and settles rather than drapes
  SpringShirt: { stiffness: 0.06, drag: 0.1, gravity: 5, cloth: 0.7 },
};

export function feelOf(name: string): SpringFeel {
  let best = '';
  for (const k of Object.keys(SPRING_KINDS)) if (name.startsWith(k) && k.length > best.length) best = k;
  const { stiffness, drag, gravity } = SPRING;
  return { stiffness, drag, gravity, ...SPRING_KINDS[best] };
}

interface Link {
  bone: THREE.Bone;
  rest: THREE.Quaternion; // the bone's bind rotation, in its parent's space
  tail: THREE.Vector3; // its tail in its own space (the next bone's head, or its length on along the chain)
  p: THREE.Vector3; // the tail particle, world space
  prev: THREE.Vector3;
}

// two neighbouring tails of a fabric sheet and how far apart they hang at rest (rig units)
interface Tie {
  a: Link;
  b: Link;
  len: number;
  k: number;
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

// a bone's world matrix from its parent's, which is already up to date: the solver works down each chain, so this
// skips the walk up to the scene root that getWorldPosition and updateMatrixWorld would do for every bone, every step
function place(bone: THREE.Object3D): void {
  bone.updateMatrix();
  bone.matrixWorld.multiplyMatrices(bone.parent!.matrixWorld, bone.matrix);
}

export class Springs {
  private readonly chains: Link[][] = [];
  private readonly feels: SpringFeel[] = [];
  private readonly ties: Tie[] = [];
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
      this.feels.push(feelOf(root.name));
    }
    // fabric: tie each chain of a sheet to the next one along ('SpringHood3' to 'SpringHood4'), tail to tail
    const sheet = (name: string) => /^(Spring\D+)(\d+)_/.exec(name);
    this.chains.forEach((chain, c) => {
      const k = this.feels[c].cloth;
      const m = sheet(chain[0].bone.name);
      if (!k || !m) return;
      const named = (n: number) => this.chains.find((o) => sheet(o[0].bone.name)?.[0] === `${m[1]}${n}_`);
      let next = named(Number(m[2]) + 1);
      // the last chain of a sheet closes a loop when it hangs as close to the first as the first does to the second
      const first = named(0);
      const second = named(1);
      if (!next && first && second && first !== chain) {
        const gap = (a: Link[], b: Link[]) => a[0].bone.getWorldPosition(v1).distanceTo(b[0].bone.getWorldPosition(v2));
        if (gap(chain, first) < gap(first, second) * 1.5) next = first;
      }
      if (!next) return;
      for (let i = 0; i < Math.min(chain.length, next.length); i++) this.ties.push({ a: chain[i], b: next[i], len: 0, k });
    });
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
      for (const t of this.ties) t.len = t.a.p.distanceTo(t.b.p) / scale;
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
    for (let s = 0; s < steps; s++) {
      lag.copy(move).multiplyScalar(1 - (s + 1) / steps);
      this.chains.forEach((chain, c) => {
        const feel = this.feels[c];
        this.solve(chain, feel, feel.gravity * scale * SPRING.step * SPRING.step, scale, lag);
      });
      this.tie(scale);
    }
    for (const chain of this.chains) this.aim(chain);
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
  private solve(chain: Link[], feel: SpringFeel, g: number, scale: number, back: THREE.Vector3): void {
    // heads move with the pose; each tail swings about the tail before it (or the chain's root)
    for (let i = 0; i < chain.length; i++) {
      const l = chain[i];
      l.bone.quaternion.copy(l.rest);
      place(l.bone);
      const at = v3.setFromMatrixPosition(l.bone.matrixWorld);
      const head = i ? chain[i - 1].p : v1.copy(at).sub(back);
      const posed = v2.copy(l.tail).applyMatrix4(l.bone.matrixWorld);
      posed.sub(at).add(head); // the posed direction, hung from the (swung) head
      const len = l.tail.length() * scale;
      const next = v3
        .copy(l.p)
        .sub(l.prev)
        .multiplyScalar(1 - feel.drag)
        .add(l.p)
        .addScaledVector(posed.sub(l.p), feel.stiffness);
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

  // fabric: pull each pair of neighbouring tails back toward their rest spacing, both ends half way. Each chain's next
  // step puts its bone lengths back, so the sheet settles between holding its width and hanging from its seams.
  private tie(scale: number): void {
    for (let n = 0; n < 2; n++) {
      for (const t of this.ties) {
        const d = v1.copy(t.b.p).sub(t.a.p);
        const len = d.length();
        if (len < 1e-6) continue;
        d.multiplyScalar(((len - t.len * scale) / len) * 0.5 * t.k);
        t.a.p.add(d);
        t.b.p.sub(d);
      }
    }
  }

  // turn each bone so its tail points at its particle
  private aim(chain: Link[]): void {
    for (const l of chain) {
      l.bone.quaternion.copy(l.rest);
      place(l.bone);
      const head = v1.setFromMatrixPosition(l.bone.matrixWorld);
      const from = v2.copy(l.tail).applyMatrix4(l.bone.matrixWorld).sub(head).normalize();
      const to = v3.copy(l.p).sub(head).normalize();
      const turn = q1.setFromUnitVectors(from, to);
      // world turn -> the bone's own: rest * parent⁻¹ · turn · parent
      l.bone.parent!.matrixWorld.decompose(v2, q2, v3);
      l.bone.quaternion.copy(q2).invert().multiply(turn).multiply(q2).multiply(l.rest);
      place(l.bone);
    }
  }
}

// where a skater's body pushes hair out: world positions at the bind pose from the bones' (art/lou_gnar.py sizes,
// rig units; `scale` is the rig's world scale)
export function bodyColliders(bindPos: (name: string) => THREE.Vector3 | undefined, scale: number): { bone: string; at: THREE.Vector3; r: number }[] {
  const out: { bone: string; at: THREE.Vector3; r: number }[] = [];
  const head = bindPos('Head');
  const chest = bindPos('Spine1');
  const waist = bindPos('Spine');
  if (head) out.push({ bone: 'Head', at: head.clone().add(new THREE.Vector3(0, 0.14 * scale, 0)), r: 0.15 });
  if (chest) out.push({ bone: 'Spine1', at: chest.clone().add(new THREE.Vector3(0, 0.08 * scale, 0)), r: 0.17 });
  // a sweatshirt's body hangs round the waist, and doesn't sink into it
  if (waist) out.push({ bone: 'Spine', at: waist.clone().add(new THREE.Vector3(0, 0.02 * scale, 0)), r: 0.12 });
  return out;
}
