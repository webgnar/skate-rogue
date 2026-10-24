// Manga focus lines for the slam freeze: black wedges rushing in from the screen edges toward the skater, with a
// white impact flash for the first few frames. A screen-space quad drawn only while active.
import * as THREE from 'three';
import { FX } from './fx-settings';

const LIFE = 0.32; // seconds, real time

const vertex = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec2 uCentre; // skater in NDC
  uniform float uAspect;
  uniform float uT;
  uniform float uFlashK; // 0..1
  uniform float uSeed;
  varying vec2 vNdc;
  float hash(float n) { return fract(sin(n * 78.233 + uSeed) * 43758.5453); }
  void main() {
    vec2 d = vNdc - uCentre;
    d.x *= uAspect;
    float r = length(d);
    float a = atan(d.y, d.x) / 6.2831853 + 0.5;
    float n = 110.0;
    float i = floor(a * n);
    float f = fract(a * n);
    // each wedge: its own inner radius (pulled back as it fades) and width, thicker toward the edges
    float inner = 0.32 + 0.38 * hash(i) + uT * uT * 1.6;
    float w = (0.08 + 0.42 * hash(i + 31.0)) * smoothstep(inner, inner + 0.9, r);
    bool line = r > inner && abs(f - 0.5) < w * 0.5 && hash(i + 7.0) > 0.25;
    float flash = (1.0 - smoothstep(0.0, 0.3, uT)) * smoothstep(0.28, 0.6, r);
    if (!line && flash < 0.02) discard;
    vec3 col = line ? vec3(0.04, 0.02, 0.06) : vec3(1.0, 0.98, 0.9);
    gl_FragColor = vec4(col, line ? 0.92 : flash * 0.55 * uFlashK);
  }
`;

export class FocusLines {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private age = LIFE;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uCentre: { value: new THREE.Vector2() },
        uAspect: { value: 1 },
        uT: { value: 1 },
        uSeed: { value: 0 },
        uFlashK: { value: 1 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
  }

  trigger(): void {
    this.age = 0;
    this.mat.uniforms.uSeed.value = Math.random() * 100;
    this.mat.uniforms.uFlashK.value = FX.reduceFlashing ? 0 : 1;
  }

  // real seconds; `at` is the world point to focus on
  update(dt: number, camera: THREE.PerspectiveCamera, at: THREE.Vector3): void {
    this.age += dt;
    const on = this.age < LIFE;
    this.mesh.visible = on;
    if (!on) return;
    const p = at.clone().project(camera);
    this.mat.uniforms.uCentre.value.set(p.x, p.y);
    this.mat.uniforms.uAspect.value = camera.aspect;
    this.mat.uniforms.uT.value = this.age / LIFE;
  }
}
