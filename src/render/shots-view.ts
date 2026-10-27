// The guards' shots (src/sim/shots.ts), drawn to read on a small phone: while a guard aims, a "!" over the gun and a
// red sight line from the gun to you at the height the bullet will fly, blinking faster as the shot comes; then a
// muzzle flash and a bright tracer streaking along that line. A first pass: the shaders thread polishes the flash and
// tracer, the models thread gives the guard a shooting pose.
import * as THREE from 'three';
import type { Level } from '../physics/level';
import { SHOTS, type Shooter } from '../sim/shots';
import { toX, toY } from './kit';
import { bangTexture } from './traffic-view';

const MAX_BULLETS = 4;
const TRACER = 2.2; // world units long: big enough to read on a phone
const FLASH_SECS = 0.08;

export class ShotsView {
  readonly group = new THREE.Group();
  private readonly sight: THREE.Mesh;
  private readonly mark: THREE.Mesh;
  private readonly bang: THREE.Sprite;
  private readonly flash: THREE.Mesh;
  private readonly tracers: THREE.Mesh[] = [];
  private flashT = 0;
  private t = 0;

  constructor() {
    const flat = (color: number, opacity = 1) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
    //the sight line: a unit box stretched from the gun to the skater each frame
    this.sight = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.1), flat(0xff2a3a, 0.8));
    this.sight.renderOrder = 20;
    //and a red ring on you at the height it'll come at
    this.mark = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 24), flat(0xff2a3a, 0.9));
    this.mark.renderOrder = 20;
    this.bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTexture(), depthTest: false, transparent: true }));
    this.bang.scale.set(0.7, 1.4, 1);
    this.bang.renderOrder = 21;
    this.flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), flat(0xfff2a0));
    this.flash.renderOrder = 21;
    for (let i = 0; i < MAX_BULLETS; i++) {
      //a hot white core in a yellow streak, its tail end at the bullet's back
      const streak = new THREE.Mesh(new THREE.BoxGeometry(TRACER, 0.22, 0.22), flat(0xffc21a, 0.9));
      const core = new THREE.Mesh(new THREE.BoxGeometry(TRACER * 0.5, 0.1, 0.23), flat(0xffffff));
      core.position.x = TRACER * 0.2;
      core.renderOrder = 23;
      streak.add(core);
      streak.renderOrder = 22;
      this.tracers.push(streak);
    }
    this.group.add(this.sight, this.mark, this.bang, this.flash, ...this.tracers);
    this.group.visible = false;
  }

  // bang: the game calls this on a shot event (the sim can step more than once a frame)
  fired(): void {
    this.flashT = FLASH_SECS;
  }

  // gunX: where the chaser is drawn (world units) plus the gun's reach; skaterX: the skater as drawn
  update(level: Level, shooter: Shooter | null, gunX: number, skaterX: number, dt: number): void {
    this.group.visible = shooter !== null;
    if (!shooter) return;
    this.t += dt;
    const gy = toY(level, shooter.gunY);
    const aiming = shooter.aimT > 0;
    this.sight.visible = this.mark.visible = this.bang.visible = aiming;
    if (aiming) {
      //from the gun, down or up to the line the bullet will fly along, then on to you
      const y = toY(level, shooter.aimY);
      const len = Math.max(0.1, skaterX - gunX);
      this.sight.scale.set(len, 1, 1);
      this.sight.position.set(gunX + len / 2, y, 1.2);
      //blinks faster as the shot comes
      const left = shooter.aimT / SHOTS.aim;
      const hz = 3 + 12 * (1 - left);
      const on = Math.sin(this.t * hz * Math.PI * 2) > -0.2;
      (this.sight.material as THREE.MeshBasicMaterial).opacity = on ? 0.9 : 0.25;
      (this.mark.material as THREE.MeshBasicMaterial).opacity = on ? 1 : 0.3;
      this.mark.position.set(skaterX, y, 1.3);
      this.mark.scale.setScalar(1 + 0.5 * left); // closes in on you as the shot comes
      this.bang.position.set(gunX - 0.2, gy + 1.6 + Math.abs(Math.sin(this.t * 10)) * 0.12, 1.2);
    }
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.visible = this.flashT > 0;
    if (this.flash.visible) {
      this.flash.position.set(gunX + 0.2, gy, 1.2);
      this.flash.scale.setScalar(0.6 + (this.flashT / FLASH_SECS) * 0.8);
      this.flash.rotation.z += 1.3;
    }
    this.tracers.forEach((m, i) => {
      const b = shooter.bullets[i];
      m.visible = !!b;
      if (b) m.position.set(toX(b.x) - TRACER / 2, toY(level, b.y), 1.2);
    });
  }
}
