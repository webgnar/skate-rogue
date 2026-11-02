// The sewer's runoff (zack, 2026-11-02: "slime texture source imagery to make a shader for ... the directional sewer
// water on the ground"). Three refs, layered:
//  - polluted water marbling: swirls of navy and blue-grey, domain-warped noise stretched along the current, with thin
//    cream contour lines where the swirl folds, and a cream foam rim along the stream's edges;
//  - bubble scum: packed round bubbles, blue-violet in the middle with pale rims, in rafts drifting downstream and
//    piled up along the edges, flecked lime with algae;
//  - mossy slime: green and yellow-tan mottling with dark clumps, creeping in from the banks.
// The current runs +x (downstream, your way): the swirls and rafts drift with it and V ripples point along it, so a
// still frame still says which way it goes. A sheet falling off a drop runs down instead. World space throughout,
// so streams line up across boxes and floors. One program for every stream; slimeClock is shared, so SewerView's
// update moves them all at once.
import * as THREE from 'three';

export const slimeClock = { value: 0 };

const vertex = /* glsl */ `
  attribute vec2 aSize;
  varying vec3 vWorld;
  varying vec3 vN;
  varying vec2 vEdge;
  varying vec2 vSize;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vEdge = uv;
    vSize = aSize;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vN;
  varying vec2 vEdge;
  varying vec2 vSize;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    return 0.55 * noise(p) + 0.3 * noise(p * 2.03 + 7.1) + 0.15 * noise(p * 4.1 + 3.7);
  }
  // round bubbles packed in cells: x the rim (1 on it), y inside (1 in the middle)
  vec2 bubbles(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float best = 8.0;
    float r = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = hash2(i + g);
        float d = length(g + 0.2 + 0.6 * o - f);
        float rr = 0.28 + 0.2 * o.x;
        if (d - rr < best) { best = d - rr; r = rr; }
      }
    }
    float rim = smoothstep(0.09, 0.0, abs(best + 0.04));
    float inside = smoothstep(0.0, -0.06, best);
    return vec2(rim, inside);
  }
  void main() {
    // along the current (s) and across it (c): the floor runs +x, a falling sheet runs down
    bool level = abs(vN.y) > 0.5;
    float s = level ? vWorld.x : -vWorld.y;
    float c = vWorld.z;
    float t = uTime;
    // how far in from the stream's edge (tiles)
    float edge = min(min(vEdge.x, vSize.x - vEdge.x), min(vEdge.y, vSize.y - vEdge.y));
    float bank = 1.0 - smoothstep(0.0, 0.9, edge);
    // the marbling: warped noise stretched along the current, drifting with it, bent into Vs pointing downstream
    float vee = abs(fract(c * 0.22 + 0.5) - 0.5) * 2.2;
    vec2 q = vec2((s + vee) * 0.45 - t * 0.9, c * 1.35);
    vec2 w = vec2(fbm(q * 0.9 + vec2(0.0, t * 0.12)), fbm(q * 0.9 + vec2(5.2, 1.3 - t * 0.1)));
    float m = fbm(q + 2.4 * w);
    vec3 navy = vec3(0.05, 0.08, 0.11);
    vec3 grey = vec3(0.24, 0.31, 0.33);
    vec3 murk = vec3(0.11, 0.17, 0.09);
    vec3 col = mix(navy, murk, smoothstep(0.3, 0.55, w.x));
    col = mix(col, grey, smoothstep(0.5, 0.75, m));
    // cream lines where the swirl folds, fainter out in the middle
    float lines = smoothstep(0.43, 0.48, abs(fract(m * 4.0) - 0.5));
    vec3 cream = vec3(0.82, 0.77, 0.55);
    col = mix(col, cream, lines * (0.15 + 0.6 * smoothstep(0.55, 0.8, m)));
    // V ripples running downstream
    float rip = fract((s + vee * 1.4) * 0.7 - t * 1.1);
    col = mix(col, cream, smoothstep(0.05, 0.0, abs(rip - 0.5)) * 0.6 * smoothstep(0.4, 0.65, w.y));
    // rafts of bubble scum, drifting with the current, heaped along the banks
    float raft = smoothstep(0.58, 0.7, fbm(vec2(s * 0.5 - t * 0.75, c * 0.8) + 11.0)) + bank;
    vec2 b = bubbles(vec2((s - t * 1.5) * 3.2, c * 3.2));
    float scum = clamp(raft, 0.0, 1.0);
    vec3 violet = vec3(0.36, 0.36, 0.55);
    vec3 pale = vec3(0.84, 0.86, 0.86);
    col = mix(col, violet * (0.75 + 0.35 * noise(vec2(s, c) * 6.0)), b.y * scum * 0.85);
    col = mix(col, pale, b.x * scum);
    // lime algae and moss creeping in from the banks: green and tan mottling, dark clumps
    float moss = fbm(vec2(s, c) * 1.6 + 3.0);
    float creep = smoothstep(0.25, 0.0, edge - moss * 0.55);
    vec3 green = mix(vec3(0.3, 0.45, 0.1), vec3(0.58, 0.55, 0.25), smoothstep(0.4, 0.7, fbm(vec2(s, c) * 3.3)));
    col = mix(col, green, creep * 0.9);
    col = mix(col, vec3(0.07, 0.06, 0.03), creep * smoothstep(0.62, 0.72, fbm(vec2(s, c) * 4.5 + 9.0)));
    col = mix(col, vec3(0.52, 0.85, 0.22), scum * (1.0 - creep) * smoothstep(0.72, 0.8, noise(vec2(s - t * 1.5, c) * 2.4)) * 0.8);
    // a cream foam rim right at the edge
    col = mix(col, cream, smoothstep(0.14, 0.04, edge) * 0.7);
    // the light: a falling sheet a touch brighter, a sheen where the swirl's smooth
    col *= level ? 1.0 : 1.15;
    col += vec3(0.05, 0.06, 0.04) * smoothstep(0.62, 0.8, m) * (1.0 - scum);
    // (the colours above are as they show on screen: the frame goes out through an sRGB pass, so into linear)
    gl_FragColor = vec4(pow(col, vec3(2.2)), 0.94);
  }
`;

// the runoff's material: each one shares the clock
export function slimeMaterial(): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { uTime: slimeClock },
    transparent: true,
  });
  m.userData.slime = true;
  return m;
}

// a box of runoff: its UVs in tiles across each face, and each face's size, so the shader knows how far in from the
// stream's edge it is (merged meshes keep both)
export function slimeBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const size = new Float32Array(uv.count * 2);
  //(BoxGeometry's faces, 4 corners each: +x, -x (u along z, v along y), +y, -y (x, z), +z, -z (x, y))
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = dims[Math.floor(i / 4)];
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    size[i * 2] = su;
    size[i * 2 + 1] = sv;
  }
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 2));
  return geo;
}
