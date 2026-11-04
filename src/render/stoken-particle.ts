// The Stoken pickup as a quantum particle (zack, 2026-11-04: "2 sphere meshes, one with atoms going around an inner
// one"): a glowing inked core, three electrons riding tilted orbits round it, and a see-through shell with a bright rim
// holding it all. Every particle of a floor is drawn in four instanced calls (cores, shells, orbit rings, electrons),
// so a floor full of them costs the same as the gem did, plus three.
import * as THREE from 'three';
import { inkify } from './toon';

export type ParticlePalette = { core: number; glow: number; electron: number; ring: number; shell: number };

export const STOKEN_PALETTE: ParticlePalette = {
  core: 0xe060ff, // the Stoken purple the gem wore
  glow: 0x8a2ad0,
  electron: 0xd0fdff,
  ring: 0x8af6ff,
  shell: 0xb070ff,
};

export const PARTICLE = {
  core: 0.15, // core radius, m
  orbit: 0.31, // electron orbit radius
  shell: 0.37, // outer shell radius
  electron: 0.075,
  ring: 0.014, // orbit ring tube radius
  orbitSpeed: 5.5, // electron laps, rad/s
  tumble: 0.9, // the whole atom's slow turn, rad/s
};

// the three orbit planes, tipped 60° apart round the vertical like the textbook atom
const TILTS = [0, 1, 2].map((k) => new THREE.Quaternion().setFromEuler(new THREE.Euler(1.15, (k * Math.PI * 2) / 3, 0, 'YXZ')));

// a fresnel rim: clear through the middle, bright at the edge, added on top of what's behind
function shellMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 p = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * p;
        vN = normalize(normalMatrix * n);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(f, 2.2);
        gl_FragColor = vec4(color * (0.08 + rim * 1.4), 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function ringGeometry(): THREE.BufferGeometry {
  const parts = TILTS.map((q) => {
    const g = new THREE.TorusGeometry(PARTICLE.orbit, PARTICLE.ring, 4, 40);
    g.rotateX(Math.PI / 2); // torus lies in XY; turn it flat into XZ, the orbit plane before the tilt
    g.applyQuaternion(q);
    return g;
  });
  const merged = new THREE.BufferGeometry();
  const pos: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const g of parts) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    const ix = g.getIndex()!;
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
    g.dispose();
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setIndex(idx);
  return merged;
}

const ELECTRONS = TILTS.length;

export class StokenParticles {
  readonly group = new THREE.Group();
  readonly cores: THREE.InstancedMesh;
  private readonly shells: THREE.InstancedMesh;
  private readonly rings: THREE.InstancedMesh;
  private readonly electrons: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly s = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(count: number, palette: ParticlePalette = STOKEN_PALETTE) {
    const n = Math.max(1, count);
    this.cores = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(PARTICLE.core, 2),
      new THREE.MeshLambertMaterial({ color: palette.core, emissive: palette.glow }),
      n,
    );
    this.electrons = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(PARTICLE.electron, 1),
      new THREE.MeshBasicMaterial({ color: palette.electron }),
      n * ELECTRONS,
    );
    this.rings = new THREE.InstancedMesh(
      ringGeometry(),
      new THREE.MeshBasicMaterial({ color: palette.ring, transparent: true, opacity: 0.8, depthWrite: false }),
      n,
    );
    this.shells = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(PARTICLE.shell, 2), shellMaterial(palette.shell), n);
    this.shells.renderOrder = 1; // after the core and electrons, so the rim lays over them
    for (const mesh of [this.cores, this.electrons, this.rings, this.shells]) mesh.frustumCulled = false;
    this.count = count;
    // the core gets the comic ink outline; the electrons, rings and shell are light, and an outline would swallow them
    // at phone size
    inkify(this.cores);
    this.group.add(this.cores, this.rings, this.electrons, this.shells);
  }

  set count(c: number) {
    this.cores.count = this.shells.count = this.rings.count = c;
    this.electrons.count = c * ELECTRONS;
  }

  // place particle i at pos, scaled, at time t (seconds); scale 0 hides it
  place(i: number, pos: THREE.Vector3, scale: number, t: number, seed = 0): void {
    if (scale <= 0) {
      for (const mesh of [this.cores, this.shells, this.rings]) mesh.setMatrixAt(i, this.hidden);
      for (let k = 0; k < ELECTRONS; k++) this.electrons.setMatrixAt(i * ELECTRONS + k, this.hidden);
      return;
    }
    const turn = t * PARTICLE.tumble + seed;
    this.e.set(0.35 * Math.sin(turn * 0.7), turn, 0.25);
    this.q.setFromEuler(this.e);
    this.s.setScalar(scale);
    this.m.compose(pos, this.q, this.s);
    this.cores.setMatrixAt(i, this.m);
    this.rings.setMatrixAt(i, this.m);
    this.shells.setMatrixAt(i, this.m);
    for (let k = 0; k < ELECTRONS; k++) {
      const a = t * PARTICLE.orbitSpeed + seed * 2 + (k * Math.PI * 2) / ELECTRONS;
      this.v.set(Math.cos(a) * PARTICLE.orbit, 0, Math.sin(a) * PARTICLE.orbit).applyQuaternion(TILTS[k]);
      this.v.applyQuaternion(this.q).multiplyScalar(scale).add(pos);
      this.m.compose(this.v, this.q, this.s);
      this.electrons.setMatrixAt(i * ELECTRONS + k, this.m);
    }
  }

  flush(): void {
    for (const mesh of [this.cores, this.shells, this.rings, this.electrons]) mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.cores, this.shells, this.rings, this.electrons]) {
      mesh.geometry.dispose();
      [mesh.material].flat().forEach((m) => m.dispose());
      mesh.dispose();
    }
  }
}
