// The splash when you go into the water (zack, 2026-10-31: "like the impact shader but more water"): the slam's
// comic burst (impact.ts) redrawn in water, a wide crown and a tall column, deep blue at the foot to white foam at
// the jagged tips, ink-outlined, halftone dots, dissolving dot by dot; and a ripple ring spreading on the surface.
// Drawn in the effects pass (view.over), over the skater going under.
import * as THREE from 'three';
import { warmMesh } from './shader-keep';

export const SPLASH = {
  life: 1.0, // seconds
  ring: 1.3, // the ripple's life, seconds
};

// the crown and the column: open cylinders, shaped in the vertex shader. uKind 0 is the crown (short, flares wide
// fast), 1 the column (narrow, shoots up then falls back into the water)
const vertex = /* glsl */ `
  uniform float uT;
  uniform float uSize;
  uniform float uKind;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float e = 1.0 - pow(1.0 - uT, 3.0);
    float h, rBottom, rTop;
    if (uKind < 0.5) {
      h = uSize * (1.5 * pow(1.0 - uT, 1.3) * smoothstep(0.0, 0.08, uT) + 0.1);
      rBottom = uSize * (0.5 + 0.5 * e);
      rTop = uSize * (0.7 + 2.6 * e);
    } else {
      // up fast, hangs, drops back
      float up = sin(3.14159 * min(1.0, uT * 1.15));
      h = uSize * (3.4 * pow(max(up, 0.0), 0.7) + 0.05);
      rBottom = uSize * (0.42 + 0.15 * e);
      rTop = uSize * (0.22 + 0.55 * e);
    }
    vec3 p = position;
    p.xz *= mix(rBottom, rTop, uv.y);
    p.y = uv.y * h;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uT;
  uniform float uSeed;
  uniform float uPx;
  uniform float uKind;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n * 91.345 + uSeed) * 47453.17); }
  void main() {
    // jagged top, rounder than the slam's: each spike ends in a blob of water
    float slices = uKind < 0.5 ? 15.0 : 9.0;
    float a = vUv.x * slices;
    float i = floor(a);
    float f = fract(a) - 0.5;
    float tri = 1.0 - abs(f) * 2.0;
    float tip = 0.5 + 0.5 * hash(i);
    float edge = mix(0.35, tip, pow(tri, 0.6)) * (1.0 - 0.3 * uT);
    // a drop breaking off above each tall spike
    float blobY = edge + 0.08 + 0.12 * hash(i + 3.0);
    float blob = length(vec2(f * 2.2, (vUv.y - blobY) * 7.0));
    bool inBlob = tip > 0.7 && blob < 0.42;
    if (vUv.y > edge && !inBlob) discard;
    float d = inBlob ? (0.42 - blob) * 0.12 : edge - vUv.y;
    float up = vUv.y / max(edge, 0.01);

    // deep blue at the foot, bright cyan, white foam at the tips
    vec3 col = mix(vec3(0.12, 0.38, 0.82), vec3(0.42, 0.78, 1.0), smoothstep(0.0, 0.45, up));
    col = mix(col, vec3(0.96, 0.99, 1.0), smoothstep(0.6, 0.95, up));
    if (inBlob) col = vec3(0.92, 0.98, 1.0);

    // halftone dots in screen space, darker blue, thinning toward the foam
    vec2 cell = fract(gl_FragCoord.xy / (7.0 * uPx)) - 0.5;
    float dotR = 0.3 - 0.22 * smoothstep(0.1, 0.8, up);
    if (length(cell) < dotR) col *= vec3(0.72, 0.82, 0.92);

    // streaks of light running up the water
    float line = step(0.88, fract(vUv.x * 37.0 + hash(floor(vUv.x * 37.0)) * 0.5));
    col = mix(col, vec3(1.0), line * 0.7 * (1.0 - up));

    // thick ink outline along the edge
    if (d < 0.045) col = vec3(0.04, 0.06, 0.14);

    // dissolve: halftone cells drop out as it fades
    float n = hash(floor(gl_FragCoord.x / (7.0 * uPx)) * 17.0 + floor(gl_FragCoord.y / (7.0 * uPx)));
    if (n < smoothstep(0.5, 1.0, uT)) discard;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// the ripple: a flat ring on the water, a white band with ink either side, spreading and thinning
const ringFragment = /* glsl */ `
  uniform float uT;
  uniform float uPx;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float at = 0.25 + 0.7 * (1.0 - pow(1.0 - uT, 2.0));
    float w = 0.09 * (1.0 - 0.6 * uT);
    float d = abs(r - at);
    if (d > w) discard;
    vec3 col = d > w * 0.55 ? vec3(0.04, 0.06, 0.14) : vec3(0.9, 0.97, 1.0);
    float n = fract(sin(floor(gl_FragCoord.x / (6.0 * uPx)) * 12.9 + floor(gl_FragCoord.y / (6.0 * uPx)) * 78.2 + uSeed) * 43758.5);
    if (n < smoothstep(0.4, 1.0, uT)) discard;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const ringVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

interface Part {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  age: number;
  life: number;
}

export class WaterSplashes {
  readonly group = new THREE.Group();
  private readonly geo = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true).translate(0, 0.5, 0);
  private readonly ringGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private parts: Part[] = [];

  constructor(private readonly pixelRatio: () => number) {
    this.group.add(warmMesh(this.burstMaterial(1, 0)), warmMesh(this.ringMaterial()));
  }

  private burstMaterial(size: number, kind: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uT: { value: 0 }, uSize: { value: size }, uKind: { value: kind }, uSeed: { value: Math.random() * 100 }, uPx: { value: this.pixelRatio() } },
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  private ringMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      uniforms: { uT: { value: 0 }, uSeed: { value: Math.random() * 100 }, uPx: { value: this.pixelRatio() } },
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }

  private add(mesh: THREE.Mesh, mat: THREE.ShaderMaterial, life: number): void {
    this.group.add(mesh);
    this.parts.push({ mesh, mat, age: 0, life });
  }

  // a splash where the skater broke the surface at (x, y), world units; size 1 for a fall into the canal
  spawn(x: number, y: number, size = 1): void {
    for (const kind of [1, 0]) {
      const mat = this.burstMaterial(size * (kind ? 0.8 : 1), kind);
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.position.set(x, y - 0.05, 0.25);
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.renderOrder = kind; // the crown in front of the column
      this.add(mesh, mat, SPLASH.life);
    }
    const ring = this.ripple(x, y, 4.5 * size);
    ring.renderOrder = -1;
  }

  // a ring spreading on the water at (x, y), `w` across at its widest
  ripple(x: number, y: number, w: number): THREE.Mesh {
    const mat = this.ringMaterial();
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(x, y + 0.01, 0.25);
    mesh.scale.set(w, 1, w * 0.6);
    this.add(mesh, mat, SPLASH.ring);
    return mesh;
  }

  // the world moved (the next floor took over): move the splashes with it
  shift(dx: number, dy: number): void {
    for (const p of this.parts) p.mesh.position.add(new THREE.Vector3(dx, dy, 0));
  }

  update(dt: number): void {
    for (const p of this.parts) {
      p.age += dt;
      p.mat.uniforms.uT.value = Math.min(1, p.age / p.life);
    }
    for (const p of this.parts.filter((p) => p.age >= p.life)) {
      this.group.remove(p.mesh);
      p.mat.dispose();
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
  }

  clear(): void {
    for (const p of this.parts) {
      this.group.remove(p.mesh);
      p.mat.dispose();
    }
    this.parts = [];
  }
}
