// The floor's exit gates come alive: a portal of light rings flowing in fills each arch, and as the skater rolls
// up the gate brightens and swells, so the way out reads from across the screen. One extra draw per gate.
import * as THREE from 'three';

export const GATE_FX = {
  near: 12, // tiles out where a gate starts to wake
  swell: 0.08, // how much the arch grows when the skater is at it
};

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uNear;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - vec2(0.5, 0.0)) * vec2(2.0, 1.0); // 0 at the base centre, 1 at the arch
    float r = length(p);
    if (r > 1.0) discard;
    // rings drifting in toward the centre, stronger near the rim
    float rings = 0.5 + 0.5 * sin(r * 22.0 + uTime * 5.0);
    float a = (0.12 + 0.3 * uNear) * smoothstep(0.15, 1.0, r) * (0.55 + 0.45 * rings) + 0.1 * uNear * (1.0 - r);
    gl_FragColor = vec4(uColor * a, 1.0);
    #include <colorspace_fragment>
  }
`;

interface Gate {
  arch: THREE.Mesh;
  portal: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  x: number;
  base: number;
}

export class GateFx {
  readonly group = new THREE.Group();
  private gates: Gate[] = [];
  private t = 0;

  // find the gates in a fresh kit (meshes tagged userData.gate) and fill each arch with a portal
  build(kit: THREE.Object3D): void {
    for (const g of this.gates) {
      g.portal.geometry.dispose();
      g.mat.dispose();
    }
    this.group.clear();
    this.gates = [];
    kit.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.userData.gate) return;
      const color = (o.material as THREE.MeshBasicMaterial).color.clone();
      const mat = new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uColor: { value: color }, uTime: { value: 0 }, uNear: { value: 0 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const r = 1.6 * o.scale.x;
      const portal = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r).translate(0, r / 2, 0), mat);
      portal.position.copy(o.position).add(new THREE.Vector3(0, 0, 0.01));
      portal.renderOrder = 3;
      this.group.add(portal);
      this.gates.push({ arch: o, portal, mat, x: o.position.x, base: o.scale.x });
    });
  }

  // skaterX in world units; dt in seconds
  update(dt: number, skaterX: number): void {
    this.t += dt;
    for (const g of this.gates) {
      const d = g.x - skaterX;
      const near = d < -1 ? 0 : 1 - THREE.MathUtils.clamp(d / GATE_FX.near, 0, 1);
      g.mat.uniforms.uTime.value = this.t;
      g.mat.uniforms.uNear.value = near * near;
      g.arch.scale.setScalar(g.base * (1 + GATE_FX.swell * near * near * (0.8 + 0.2 * Math.sin(this.t * 6))));
    }
  }
}
