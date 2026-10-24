// The particle state, kept apart from Three.js so it can be tested: flat typed arrays, a fixed size, and a ring
// cursor so a spawn into a full pool takes the oldest slot.
export class ParticlePool {
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly pz: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vz: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array; // 0 = free
  readonly drag: Float32Array; // per second
  readonly grav: Float32Array; // world units / s²
  readonly size0: Float32Array;
  readonly size1: Float32Array;
  readonly floor: Float32Array; // bounce off this height (-Infinity = none)
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;
  private next = 0;

  constructor(readonly size: number) {
    const f = () => new Float32Array(size);
    this.px = f();
    this.py = f();
    this.pz = f();
    this.vx = f();
    this.vy = f();
    this.vz = f();
    this.age = f();
    this.life = f();
    this.drag = f();
    this.grav = f();
    this.size0 = f();
    this.size1 = f();
    this.floor = f().fill(-Infinity);
    this.r = f();
    this.g = f();
    this.b = f();
  }

  // a slot for a new particle, reset to still and weightless
  alloc(): number {
    const i = this.next;
    this.next = (this.next + 1) % this.size;
    this.age[i] = 0;
    this.vx[i] = this.vy[i] = this.vz[i] = 0;
    this.drag[i] = 0;
    this.grav[i] = 0;
    this.floor[i] = -Infinity;
    return i;
  }

  alive(i: number): boolean {
    return this.life[i] > 0 && this.age[i] < this.life[i];
  }

  // 0 at birth, 1 at death
  t(i: number): number {
    return this.life[i] > 0 ? Math.min(1, this.age[i] / this.life[i]) : 1;
  }

  step(dt: number): void {
    for (let i = 0; i < this.size; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.life[i] = 0;
        continue;
      }
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= k;
      this.vy[i] = this.vy[i] * k - this.grav[i] * dt;
      this.vz[i] *= k;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < this.floor[i] && this.vy[i] < 0) {
        this.py[i] = this.floor[i];
        this.vy[i] *= -0.35;
        this.vx[i] *= 0.6;
      }
    }
  }
}
