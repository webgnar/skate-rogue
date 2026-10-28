// The bay (zack, 2026-10-28: "a nice light blue water shader on the ground from the background to the far background
// sprite buildings", "light blue not much different from the sky box", "a comic book water shader, very minimal, only
// for when the player is super high up and sees it"). One flat plane at the skyline cards' feet, from behind the
// back streets out past the skyline, so from up high the far city stands on the water's edge. Comic and minimal: a
// flat light blue a shade off the sky's horizon, short white ink dashes for the chop that drift and fade in and out
// slowly (never blink), and a pale line along the far edge. One draw, no lights, no fog, no textures; from the street
// the rooftops hide it.
import * as THREE from 'three';

export const BAY = {
  near: -26, // z the water starts at, just behind the back street (hillside crossFar)
  far: -110, // and runs out to, past the skyline cards (z -64 to -76)
  wide: 700, // across, world units: it follows the camera, so this only has to fill a wide lens
  below: 0.5, // under the skyline cards' feet, so they stand in it
  blue: 0x8fcdf2, // the water, mixed with the sky's horizon colour
  mixSky: 0.55, // how much of the sky's horizon colour it takes
  deeper: 0.9, // and a touch darker than it, so the shoreline reads against the sky
  dash: [3.2, 1.1], // ripple cells, world units across and deep
  drift: 0.35, // world units a second the chop drifts
};

const vertex = /* glsl */ `
  uniform float uX; // the camera's x, wrapped, so the ripples stay put in the world as the plane follows
  varying vec2 vXZ;
  varying float vV;
  void main() {
    vXZ = vec2(position.x + uX, position.z);
    vV = 1.0 - uv.y; // 1 at the near edge, 0 at the far
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uInk;
  uniform float uT;
  uniform vec2 uCell;
  varying vec2 vXZ;
  varying float vV;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    vec3 c = uColor;
    //the chop: in each cell maybe one short dash, drifting and fading in and out on its own slow clock
    vec2 p = vXZ / uCell;
    p.x += uT * 0.12;
    vec2 cell = floor(p);
    vec2 f = fract(p);
    float h = hash(cell);
    float h2 = hash(cell + 17.3);
    float on = step(0.45, h) * smoothstep(0.2, 0.8, sin(uT * (0.6 + h2 * 0.5) + h * 6.283) * 0.5 + 0.5);
    float len = 0.25 + 0.35 * h2;
    float x0 = 0.1 + (0.8 - len) * h;
    float along = step(x0, f.x) * step(f.x, x0 + len);
    //thin across, thicker toward you; fwidth keeps it a clean line at any distance
    float w = fwidth(p.y) * 1.6 + 0.05;
    float dash = along * (1.0 - smoothstep(0.0, w, abs(f.y - 0.5)));
    //fewer dashes far off, so the distance stays calm
    dash *= on * smoothstep(0.0, 0.6, vV);
    c = mix(c, uInk, dash);
    //a pale line along the far edge, where it meets the sky
    c = mix(c, uInk, smoothstep(0.035, 0.0, vV) * 0.5);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

// the water's colour for a sky horizon colour: the light blue, taking on the sky's tint (so dusk and night carry
// through), a touch deeper so the shoreline reads
export function bayColor(skyBottom: number, out = new THREE.Color()): THREE.Color {
  out.setHex(BAY.blue).lerp(new THREE.Color(skyBottom), BAY.mixSky);
  return out.multiplyScalar(BAY.deeper);
}

export class Bay {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private t = 0;

  constructor() {
    const depth = BAY.near - BAY.far;
    //laid flat, facing up, from the near edge back to the far
    const geo = new THREE.PlaneGeometry(BAY.wide, depth).rotateX(-Math.PI / 2).translate(0, 0, (BAY.near + BAY.far) / 2);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uColor: { value: bayColor(0xbfe4ff) },
        uInk: { value: new THREE.Color(0xffffff) },
        uT: { value: 0 },
        uX: { value: 0 },
        uCell: { value: new THREE.Vector2(...BAY.dash) },
      },
      depthWrite: true,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -50; // after the sky, before everything standing in it
  }

  setSky(skyBottom: number, neon: number): void {
    bayColor(skyBottom, this.mat.uniforms.uColor.value);
    //the chop goes from white by day to a soft pale blue at night, so it doesn't glare
    this.mat.uniforms.uInk.value.setHex(0xffffff).lerp(new THREE.Color(0x8aa8d8), Math.min(1, neon));
  }

  // x: the camera's x; y: the skyline cards' feet
  update(dt: number, x: number, y: number): void {
    this.t += dt;
    this.mat.uniforms.uT.value = this.t % 1000;
    this.mesh.position.set(x, y - BAY.below, 0);
    //the ripples hold still in the world: wrap the offset by a whole number of cells so it never loses precision
    const wrap = BAY.dash[0] * 1000;
    this.mat.uniforms.uX.value = THREE.MathUtils.euclideanModulo(x, wrap);
  }
}
