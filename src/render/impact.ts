// Comic-book impact bursts for slams and big landings: an open cylinder around the skater's feet, drawn with a
// shader as a jagged ink-outlined burst (white core, yellow, red tips, halftone dots and speed lines). Over its life
// the cylinder gets shorter and its top flares wide, and it dissolves dot by dot.
import * as THREE from 'three';

const LIFE = 0.55; // seconds

const vertex = /* glsl */ `
  uniform float uT;
  uniform float uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float e = 1.0 - pow(1.0 - uT, 3.0); // fast out, slow settle
    float h = uSize * (1.7 * pow(1.0 - uT, 1.6) + 0.08); // shortens
    float rBottom = uSize * (0.45 + 0.35 * e);
    float rTop = uSize * (0.55 + 2.4 * e); // flares
    vec3 p = position;
    float r = mix(rBottom, rTop, uv.y);
    p.xz *= r;
    p.y = uv.y * h;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uT;
  uniform float uSeed;
  uniform float uPx;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n * 91.345 + uSeed) * 47453.17); }
  void main() {
    // jagged top: one spike per slice round the cylinder, each its own height
    float slices = 13.0;
    float a = vUv.x * slices;
    float i = floor(a);
    float tri = 1.0 - abs(fract(a) - 0.5) * 2.0; // 0 at slice edges, 1 at the tip
    float tip = 0.55 + 0.45 * hash(i);
    float edge = mix(0.3, tip, tri) * (1.0 - 0.35 * uT);
    if (vUv.y > edge) discard;
    float d = edge - vUv.y; // distance below the jagged edge

    // white core at the bottom, yellow, red-orange toward the tips
    vec3 col = mix(vec3(1.0, 0.98, 0.86), vec3(1.0, 0.86, 0.12), smoothstep(0.0, 0.35, vUv.y));
    col = mix(col, vec3(0.95, 0.22, 0.12), smoothstep(0.25, 0.75, vUv.y / max(edge, 0.01)));

    // halftone dots in screen space, bigger toward the tips
    vec2 cell = fract(gl_FragCoord.xy / (7.0 * uPx)) - 0.5;
    float dotR = 0.12 + 0.3 * smoothstep(0.2, 0.9, vUv.y / max(edge, 0.01));
    if (length(cell) < dotR) col *= 0.72;

    // speed lines up the burst
    float line = step(0.9, fract(vUv.x * 41.0 + hash(floor(vUv.x * 41.0)) * 0.5));
    col = mix(col, vec3(1.0), line * 0.6 * (1.0 - vUv.y));

    // thick ink outline along the jagged edge
    if (d < 0.05) col = vec3(0.06, 0.03, 0.08);

    // dissolve: halftone cells drop out as it fades
    float n = hash(floor(gl_FragCoord.x / (7.0 * uPx)) * 17.0 + floor(gl_FragCoord.y / (7.0 * uPx)));
    if (n < smoothstep(0.45, 1.0, uT)) discard;
    gl_FragColor = vec4(col, 1.0);
  }
`;

interface Burst {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  age: number;
}

export class Impacts {
  readonly group = new THREE.Group();
  private readonly geo = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true).translate(0, 0.5, 0);
  private bursts: Burst[] = [];

  constructor(private readonly pixelRatio: () => number) {}

  // a burst at (x, y) in world units; size 1 for a slam
  spawn(x: number, y: number, size = 1): void {
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uT: { value: 0 }, uSize: { value: size }, uSeed: { value: Math.random() * 100 }, uPx: { value: this.pixelRatio() } },
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.set(x, y - 0.05, 0.25);
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.renderOrder = -1; // under the skater where they overlap
    this.group.add(mesh);
    this.bursts.push({ mesh, mat, age: 0 });
  }

  update(dt: number): void {
    for (const b of this.bursts) {
      b.age += dt;
      b.mat.uniforms.uT.value = Math.min(1, b.age / LIFE);
    }
    for (const b of this.bursts.filter((b) => b.age >= LIFE)) {
      this.group.remove(b.mesh);
      b.mat.dispose();
    }
    this.bursts = this.bursts.filter((b) => b.age < LIFE);
  }
}
