// The guards' shots (src/sim/shots.ts), drawn to read on a small phone: while a guard aims, a "!" over the gun and a
// red sight line from the gun to you at the height the bullet will fly, blinking faster as the shot comes; then a
// muzzle flash and a bright tracer streaking along that line. The flash is a spiky star with a warm glow behind it;
// the tracer a white-hot head in a glow, an orange streak tapering back from it and a faint wake back toward the gun.
// A hit throws sparks and a red impact star; a dodge leaves a puff of air whipping past under you. Everything is
// small and local (never the whole screen), and reduce-flashing shrinks the glows.
import * as THREE from 'three';
import type { Level } from '../physics/level';
import { SHOTS, type Shooter } from '../sim/shots';
import { toX, toY } from './kit';
import { bangTexture } from './traffic-view';
import { beamMaterial } from './night';
import { FX } from './fx-settings';
import type { Particles } from './particles';

export const SHOT_FX = {
  bullets: 4,
  tracer: 2.4, // the bright streak behind the head, world units
  wake: 7, // the faint wake back toward the gun
  thick: 0.26, // the streak's height
  headGlow: 1.1, // the glow round the head, across
  flashSecs: 0.1,
  flash: 1.7, // the muzzle star across at the bang
  flashGlow: 3, // and its glow
  hitSecs: 0.22,
  hitStar: 1.5,
  whiffSecs: 0.3,
};

const hex = (c: number) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const SPARKS = [hex(0xffffff), hex(0xfff2a0), hex(0xffb03a), hex(0xff6a2a)];
const AIR = [hex(0xffffff), hex(0xe4ecff), hex(0xc8d4f0)];

// a streak along x from the tail (u 0) to the head (u 1): white-hot at the head, orange toward the tail, soft top and
// bottom. uAmt fades it; uTail is how much of the length the hot colour holds
const streakMaterial = (hot: number, tail: number, power: number) =>
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHot;
      uniform vec3 uTail;
      uniform float uAmt;
      uniform float uPow;
      varying vec2 vUv;
      void main() {
        float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
        //tapers to a point at the tail
        float body = smoothstep(0.0, 0.35 + 0.65 * (1.0 - vUv.x), across);
        float a = pow(vUv.x, uPow) * body * uAmt;
        vec3 c = mix(uTail, uHot, smoothstep(0.55, 1.0, vUv.x) * smoothstep(0.3, 0.9, across));
        gl_FragColor = vec4(c * a, 1.0);
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uHot: { value: new THREE.Color(hot) },
      uTail: { value: new THREE.Color(tail) },
      uAmt: { value: 1 },
      uPow: { value: power },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

// a unit plane from x -1 (the tail) to 0 (the head)
const streakGeo = new THREE.PlaneGeometry(1, 1).translate(-0.5, 0, 0);
const discGeo = new THREE.PlaneGeometry(1, 1);

// a spiky comic burst: a white core in yellow, six long spikes and six short. Drawn once
let starTex: THREE.CanvasTexture | null = null;
function starTexture(): THREE.CanvasTexture {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const spikes = (r1: number, r0: number, fill: string) => {
    g.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = i % 2 === 0 ? (i % 4 === 0 ? r1 : r1 * 0.62) : r0;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  spikes(62, 22, '#ff8a2a');
  spikes(46, 17, '#ffe066');
  spikes(28, 12, '#ffffff');
  starTex = new THREE.CanvasTexture(c);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}

const flat = (color: number, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
const glowMat = (color: number) => {
  const m = beamMaterial(color);
  m.uniforms.uPool.value = 1;
  m.depthTest = false;
  return m;
};
const starSprite = (color: number) =>
  new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), color, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));

interface Tracer {
  group: THREE.Group;
  streak: THREE.Mesh;
  wake: THREE.Mesh;
  glow: THREE.Mesh;
}

export class ShotsView {
  readonly group = new THREE.Group();
  readonly front = new THREE.Group(); // the hit and the whiff, in the skater's pass (scene.ts front) so they show over Lou
  private readonly sight: THREE.Mesh;
  private readonly mark: THREE.Mesh;
  private readonly bang: THREE.Sprite;
  private readonly flash = starSprite(0xffffff);
  private readonly flashGlow = new THREE.Mesh(discGeo, glowMat(0xffb040));
  private readonly impact = starSprite(0xff8a8a);
  private readonly impactGlow = new THREE.Mesh(discGeo, glowMat(0xff4a3a));
  private readonly whiff = new THREE.Mesh(streakGeo, streakMaterial(0xffffff, 0xb8c8ff, 1.2));
  private readonly tracers: Tracer[] = [];
  private flashT = 0;
  private hitT = 0;
  private whiffT = 0;
  private spin = 0;
  private t = 0;

  constructor() {
    //the sight line: a unit box stretched from the gun to the skater each frame
    this.sight = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.1), flat(0xff2a3a, 0.8));
    this.sight.renderOrder = 20;
    //and a red ring on you at the height it'll come at
    this.mark = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 24), flat(0xff2a3a, 0.9));
    this.mark.renderOrder = 20;
    this.bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTexture(), depthTest: false, transparent: true }));
    this.bang.scale.set(0.7, 1.4, 1);
    this.bang.renderOrder = 21;
    this.flashGlow.renderOrder = 21;
    this.flash.renderOrder = 22;
    this.impactGlow.renderOrder = 21;
    this.impact.renderOrder = 22;
    this.whiff.renderOrder = 21;
    for (let i = 0; i < SHOT_FX.bullets; i++) {
      const group = new THREE.Group();
      const wake = new THREE.Mesh(streakGeo, streakMaterial(0xffd890, 0xff7a3a, 1.6));
      const streak = new THREE.Mesh(streakGeo, streakMaterial(0xffffff, 0xff9a1a, 1.4));
      const glow = new THREE.Mesh(discGeo, glowMat(0xffc860));
      wake.renderOrder = 22;
      streak.renderOrder = 23;
      glow.renderOrder = 24;
      group.add(wake, streak, glow);
      this.tracers.push({ group, streak, wake, glow });
      this.group.add(group);
    }
    this.group.add(this.sight, this.mark, this.bang, this.flashGlow, this.flash);
    this.front.add(this.impactGlow, this.impact, this.whiff);
    this.group.visible = false;
  }

  // bang: the game calls this on a shot event (the sim can step more than once a frame)
  fired(): void {
    this.flashT = SHOT_FX.flashSecs;
    this.spin = Math.random() * Math.PI;
  }

  // it got you, at (x, y) world units: a red impact star and a burst of sparks
  hit(p: Particles, x: number, y: number): void {
    this.hitT = SHOT_FX.hitSecs;
    this.impact.position.set(x, y, 1.3);
    this.impactGlow.position.set(x, y, 1.25);
    this.impact.material.rotation = Math.random() * Math.PI;
    p.spray(x, y, { n: 18, colors: SPARKS, life: [0.22, 0.45], size: [0.09, 0.15], speed: [3, 7.5], angle: [-Math.PI, Math.PI], jitter: 0.05, grav: 9, drag: 1.5, z: 1.2 });
  }

  // it went under you, at (x, y): a whip of air flicking past and a few puffs
  dodged(p: Particles, x: number, y: number): void {
    this.whiffT = SHOT_FX.whiffSecs;
    this.whiff.position.set(x + 1.4, y, 1.25);
    p.spray(x, y, { n: 8, colors: AIR, life: [0.25, 0.45], size: [0.07, 0.12], size1: 0.32, speed: [2.5, 6], angle: [-0.25, 0.25], jitter: 0.1, drag: 5, alpha: 0.75, fadeFrom: 0, z: 1.2 });
  }

  // gunX: where the chaser is drawn (world units) plus the gun's reach; skaterX: the skater as drawn
  update(level: Level, shooter: Shooter | null, gunX: number, skaterX: number, dt: number): void {
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.hitT = Math.max(0, this.hitT - dt);
    this.whiffT = Math.max(0, this.whiffT - dt);
    this.group.visible = shooter !== null;
    //the hit and whiff outlive the shooter by a beat (a hit can end the chase)
    this.afterFx();
    const soft = FX.reduceFlashing ? 0.45 : 1;
    if (!shooter) return;
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
    //the muzzle star: pops out full and shrinks away, with a warm glow round it
    const f = this.flashT / SHOT_FX.flashSecs;
    this.flash.visible = this.flashGlow.visible = f > 0;
    if (f > 0) {
      const fy = shooter.bullets.length ? toY(level, shooter.bullets[shooter.bullets.length - 1].y) : gy;
      this.flash.position.set(gunX + 0.35, fy, 1.3);
      this.flash.scale.setScalar(SHOT_FX.flash * (0.45 + 0.55 * f));
      this.flash.material.rotation = this.spin;
      this.flashGlow.position.set(gunX + 0.35, fy, 1.25);
      this.flashGlow.scale.setScalar(SHOT_FX.flashGlow * (0.6 + 0.4 * f) * soft);
      (this.flashGlow.material as THREE.ShaderMaterial).uniforms.uAmt.value = 2.4 * f * soft;
    }
    this.tracers.forEach((tr, i) => {
      const b = shooter.bullets[i];
      tr.group.visible = !!b;
      if (!b) return;
      const head = toX(b.x);
      tr.group.position.set(head, toY(level, b.y), 1.25);
      //never back past the gun: it grows out of the muzzle
      const room = Math.max(0.05, head - gunX - 0.35);
      tr.streak.scale.set(Math.min(SHOT_FX.tracer, room), SHOT_FX.thick, 1);
      tr.wake.scale.set(Math.min(SHOT_FX.wake, room), SHOT_FX.thick * 0.45, 1);
      (tr.wake.material as THREE.ShaderMaterial).uniforms.uAmt.value = 0.45;
      tr.streak.position.z = 0.01;
      tr.glow.position.z = 0.02;
      tr.glow.scale.setScalar(SHOT_FX.headGlow * (0.9 + 0.1 * Math.sin(this.t * 40 + i)) * (FX.reduceFlashing ? 0.7 : 1));
      (tr.glow.material as THREE.ShaderMaterial).uniforms.uAmt.value = 2.6 * soft;
    });
  }

  // the hit's star and the dodge's whip, fading out
  private afterFx(): void {
    const h = this.hitT / SHOT_FX.hitSecs;
    this.impact.visible = this.impactGlow.visible = h > 0;
    if (h > 0) {
      this.impact.scale.setScalar(SHOT_FX.hitStar * (0.6 + 0.4 * h));
      this.impact.material.opacity = Math.min(1, h * 1.5);
      this.impactGlow.scale.setScalar(SHOT_FX.hitStar * 1.8 * (FX.reduceFlashing ? 0.5 : 1));
      (this.impactGlow.material as THREE.ShaderMaterial).uniforms.uAmt.value = 2.2 * h * (FX.reduceFlashing ? 0.45 : 1);
    }
    const w = this.whiffT / SHOT_FX.whiffSecs;
    this.whiff.visible = w > 0;
    if (w > 0) {
      //a thin line that stretches out ahead and thins as it fades
      this.whiff.scale.set(2.6 + 1.6 * (1 - w), 0.14 * w + 0.03, 1);
      (this.whiff.material as THREE.ShaderMaterial).uniforms.uAmt.value = 0.9 * w;
    }
  }
}
