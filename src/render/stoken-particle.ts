// The Stoken pickup as a quantum particle (zack, 2026-11-04: "2 sphere meshes, one with atoms going around an inner
// one", and inside, "the stoked flame of the spirit"): a flame burning in a glass core, three electrons riding tilted
// orbits round it, and a see-through shell with a bright rim holding it all. Every particle of a floor is drawn in five instanced calls (flames, cores, shells, orbit rings,
// electrons), so a floor full of them costs the same as the gem did, plus four.
import * as THREE from 'three';

export type ParticlePalette = { core: number; glow: number; electron: number; ring: number; shell: number; flame: [number, number, number] };

export const STOKEN_PALETTE: ParticlePalette = {
  core: 0xe060ff, // the Stoken purple the gem wore
  glow: 0x2a0850, // the glass deep in the middle, dark so the flame burns bright in it
  electron: 0xd0fdff,
  ring: 0x8af6ff,
  shell: 0xb070ff,
  flame: [0xff4a1c, 0xffb21a, 0xfff6c8], // outside in: the stoked flame of the spirit (zack, 2026-11-04)
};

export const PARTICLE = {
  core: 0.17, // core radius, m
  orbit: 0.31, // electron orbit radius
  shell: 0.37, // outer shell radius
  electron: 0.075,
  ring: 0.014, // orbit ring tube radius
  orbitSpeed: 5.5, // electron laps, rad/s
  tumble: 0.9, // the whole atom's slow turn, rad/s
  flame: 0.15, // the flame's half-height inside the core, m
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
        gl_FragColor = vec4(color * (0.05 + rim * 0.95), 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// The core: a purple glass ball, clear enough in the middle to see the flame in it, thick toward its edge, with the
// comic ink line round it (an inked hull can't go on something see-through, so the line is drawn in the glass)
function coreMaterial(color: number, glow: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, glow: { value: new THREE.Color(glow) } },
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
      uniform vec3 glow;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        float f = 1.0 - abs(dot(n, normalize(vV)));
        if (f > 0.8) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } // the ink line
        float a = 0.55 + 0.4 * smoothstep(0.45, 0.8, f);
        vec3 c = mix(glow, color, smoothstep(0.3, 0.75, f));
        // a hard glint up and to the left, like the toon highlights
        float spec = step(0.975, dot(n, normalize(vec3(-0.45, 0.55, 0.7))));
        c = mix(c, vec3(1.0, 0.92, 1.0), spec);
        gl_FragColor = vec4(c, max(a, spec));
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
}

// The flame: a camera-facing card drawn as a comic flame in three hard bands (red-orange, yellow, a white heart), its
// tongue licking and flickering. Each one flickers out of step with the next by where it sits.
function flameMaterial(colors: [number, number, number]): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      outer: { value: new THREE.Color(colors[0]) },
      mid: { value: new THREE.Color(colors[1]) },
      heart: { value: new THREE.Color(colors[2]) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vPhase;
      void main() {
        vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
        float k = 1.0;
        #ifdef USE_INSTANCING
          c = instanceMatrix * c;
          k = length(instanceMatrix[0].xyz);
        #endif
        vPhase = c.x * 1.7 + c.y * 0.9;
        vec4 mv = modelViewMatrix * c;
        mv.xy += position.xy * k;
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform vec3 outer;
      uniform vec3 mid;
      uniform vec3 heart;
      varying vec2 vUv;
      varying float vPhase;
      // a teardrop flame, 1 at its spine falling to 0 at its edge; size shrinks it toward its base
      float flame(vec2 p, float size, float t) {
        float y = (p.y + 1.0) * 0.5 / size; // 0 at the base, 1 at the tip
        if (y < 0.0 || y > 1.0) return 0.0;
        float lick = (sin(y * 7.0 - t * 11.0) * 0.16 + sin(y * 13.0 - t * 17.0) * 0.06) * y * y;
        float w = 0.95 * size * pow(1.0 - y, 0.75) * sqrt(clamp(y * 3.0, 0.0, 1.0)) + 0.001;
        return 1.0 - abs(p.x - lick) / w;
      }
      void main() {
        float t = time + vPhase;
        float tip = 0.9 + 0.1 * sin(t * 19.0) * sin(t * 7.0); // the tip flickers up and down
        float o = flame(vUv, tip, t);
        if (o <= 0.0) discard;
        vec3 c = outer;
        if (flame(vUv + vec2(0.0, 0.12), tip * 0.75, t + 0.4) > 0.1) c = mid;
        if (flame(vUv + vec2(0.0, 0.22), tip * 0.5, t + 0.8) > 0.2) c = heart;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
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
  private readonly flames: THREE.InstancedMesh;
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
      coreMaterial(palette.core, palette.glow),
      n,
    );
    this.flames = new THREE.InstancedMesh(new THREE.PlaneGeometry(PARTICLE.flame * 2, PARTICLE.flame * 2), flameMaterial(palette.flame), n);
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
    // the dark glass core, the flame drawn over it (it reads as inside, and the glass would only dim it), then the
    // shell's rim over everything
    this.cores.renderOrder = 1;
    this.flames.renderOrder = 2;
    this.shells.renderOrder = 3;
    for (const mesh of this.all) mesh.frustumCulled = false;
    this.count = count;
    // none take the inked hull: the core draws its own ink line, and the electrons, rings and shell are light, which an
    // outline would swallow at phone size
    this.group.add(this.flames, this.cores, this.rings, this.electrons, this.shells);
  }

  private get all(): THREE.InstancedMesh[] {
    return [this.flames, this.cores, this.shells, this.rings, this.electrons];
  }

  set count(c: number) {
    this.flames.count = this.cores.count = this.shells.count = this.rings.count = c;
    this.electrons.count = c * ELECTRONS;
  }

  // place particle i at pos, scaled, at time t (seconds); scale 0 hides it
  place(i: number, pos: THREE.Vector3, scale: number, t: number, seed = 0): void {
    if (scale <= 0) {
      for (const mesh of [this.flames, this.cores, this.shells, this.rings]) mesh.setMatrixAt(i, this.hidden);
      for (let k = 0; k < ELECTRONS; k++) this.electrons.setMatrixAt(i * ELECTRONS + k, this.hidden);
      return;
    }
    (this.flames.material as THREE.ShaderMaterial).uniforms.time.value = t;
    const turn = t * PARTICLE.tumble + seed;
    this.e.set(0.35 * Math.sin(turn * 0.7), turn, 0.25);
    this.q.setFromEuler(this.e);
    this.s.setScalar(scale);
    this.m.compose(pos, this.q, this.s);
    this.cores.setMatrixAt(i, this.m);
    this.rings.setMatrixAt(i, this.m);
    this.shells.setMatrixAt(i, this.m);
    this.flames.setMatrixAt(i, this.m); // the card faces the camera whatever the turn
    for (let k = 0; k < ELECTRONS; k++) {
      const a = t * PARTICLE.orbitSpeed + seed * 2 + (k * Math.PI * 2) / ELECTRONS;
      this.v.set(Math.cos(a) * PARTICLE.orbit, 0, Math.sin(a) * PARTICLE.orbit).applyQuaternion(TILTS[k]);
      this.v.applyQuaternion(this.q).multiplyScalar(scale).add(pos);
      this.m.compose(this.v, this.q, this.s);
      this.electrons.setMatrixAt(i * ELECTRONS + k, this.m);
    }
  }

  flush(): void {
    for (const mesh of this.all) mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of this.all) {
      mesh.geometry.dispose();
      [mesh.material].flat().forEach((m) => m.dispose());
      mesh.dispose();
    }
  }
}
