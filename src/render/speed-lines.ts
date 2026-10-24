// Comic speed lines at flow speed: thin tapered streaks between the skater and the camera, rushing past the
// opposite way they ride. One draw call; the streaks wrap round as they leave the screen. In the gnar state they
// burn gold and magenta.
import * as THREE from 'three';

const N = 18;

const vertex = /* glsl */ `
  attribute vec2 aUv;
  attribute float aFade;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    vUv = aUv;
    vFade = aFade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uAmount;
  uniform float uGnar;
  uniform float uTime;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    // tapered: thin at the tail (u = 0), thick at the head, soft across
    float taper = mix(0.15, 1.0, vUv.x);
    float across = abs(vUv.y - 0.5) * 2.0;
    if (across > taper) discard;
    float a = uAmount * vFade * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
    if (a < 0.02) discard;
    vec3 gnar = mix(vec3(1.0, 0.82, 0.2), vec3(1.0, 0.25, 0.75), 0.5 + 0.5 * sin(uTime * 9.0 + vFade * 20.0));
    vec3 col = mix(vec3(1.0), gnar, uGnar);
    gl_FragColor = vec4(col, a * 0.55);
  }
`;

interface Line {
  dx: number; // from the camera, world units
  dy: number; // fraction of the half height
  z: number;
  len: number;
  speed: number;
}

export class SpeedLines {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly pos: THREE.BufferAttribute;
  private readonly fade: THREE.BufferAttribute;
  private readonly lines: Line[] = [];
  private amount = 0;
  private gnar = 0;
  private time = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(N * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.fade = new THREE.BufferAttribute(new Float32Array(N * 4), 1);
    const uv = new Float32Array(N * 4 * 2);
    const index: number[] = [];
    for (let i = 0; i < N; i++) {
      uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
      const v = i * 4;
      index.push(v, v + 1, v + 2, v, v + 2, v + 3);
      const f = 0.4 + Math.random() * 0.6;
      for (let k = 0; k < 4; k++) this.fade.setX(v + k, f);
      this.lines.push(this.fresh(Math.random()));
    }
    geo.setAttribute('position', this.pos);
    geo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aFade', this.fade);
    geo.setIndex(index);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uAmount: { value: 0 }, uGnar: { value: 0 }, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
  }

  // a new streak entering from the right; `at` places it across the screen (0..1) for the first fill
  private fresh(at = 1): Line {
    return {
      dx: (at * 2 - 1) * 1.3, // in half-widths; turned into world units per frame
      dy: (Math.random() * 2 - 1) * 0.95,
      z: 3 + Math.random() * 9,
      len: 0.25 + Math.random() * 0.45, // in half-widths
      speed: 2.2 + Math.random() * 2.2, // half-widths per second at full amount
    };
  }

  // `flow` 0..1 is how far past cruising speed the skater is; gnar forces them on
  update(dt: number, camera: THREE.PerspectiveCamera, flow: number, gnar: boolean): void {
    const target = Math.max(flow, gnar ? 0.45 : 0);
    this.amount += (target - this.amount) * Math.min(1, dt * 5);
    this.gnar += ((gnar ? 1 : 0) - this.gnar) * Math.min(1, dt * 4);
    this.time += dt;
    this.mesh.visible = this.amount > 0.02;
    if (!this.mesh.visible) return;
    this.mat.uniforms.uAmount.value = this.amount;
    this.mat.uniforms.uGnar.value = this.gnar;
    this.mat.uniforms.uTime.value = this.time;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const cam = camera.position;
    for (let i = 0; i < N; i++) {
      let l = this.lines[i];
      l.dx -= l.speed * (0.6 + this.amount) * dt;
      if (l.dx + l.len < -1.3) l = this.lines[i] = this.fresh();
      //half-height and half-width of the view at this streak's depth
      const d = cam.z - l.z;
      const hh = tanHalf * d;
      const hw = hh * camera.aspect;
      const x0 = cam.x + l.dx * hw;
      const x1 = x0 + l.len * hw;
      const y = cam.y - d * 0.18 + l.dy * hh; // the camera looks a little down
      const t = hh * 0.014; // thickness
      const v = i * 4;
      this.pos.setXYZ(v, x0, y - t, l.z);
      this.pos.setXYZ(v + 1, x1, y - t, l.z);
      this.pos.setXYZ(v + 2, x1, y + t, l.z);
      this.pos.setXYZ(v + 3, x0, y + t, l.z);
    }
    this.pos.needsUpdate = true;
  }
}
