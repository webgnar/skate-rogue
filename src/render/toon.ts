// The comic ink look (decided by zack, Oct 24 2026): toon shading in three flat bands, and thick black outlines
// drawn per mesh as an inverted hull (the back faces pushed out along smoothed normals, a constant width in
// screen pixels). No full-screen pass, so it stays cheap on older phones.
import * as THREE from 'three';

export const INK = {
  color: 0x120a16,
  width: 2.2, // outline width in CSS pixels
  bands: [0.42, 0.72, 1], // light levels of the toon ramp, darkest first
};

let ramp: THREE.DataTexture | null = null;

// the toon ramp: a few flat bands, sampled with nearest filtering so the steps stay hard
export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  const data = new Uint8Array(INK.bands.length * 4);
  INK.bands.forEach((v, i) => data.set([v * 255, v * 255, v * 255, 255], i * 4));
  ramp = new THREE.DataTexture(data, INK.bands.length, 1, THREE.RGBAFormat);
  ramp.magFilter = ramp.minFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

export function toon(params: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ gradientMap: toonRamp(), ...params });
}

// a toon copy of a Lambert or Phong material: same colour, texture, glow and transparency
function toToon(m: THREE.Material): THREE.Material {
  if (!(m instanceof THREE.MeshLambertMaterial || m instanceof THREE.MeshPhongMaterial)) return m;
  const t = toon({
    color: m.color,
    map: m.map,
    emissive: m.emissive,
    transparent: m.transparent,
    opacity: m.opacity,
    alphaTest: m.alphaTest,
    side: m.side,
    fog: m.fog,
    vertexColors: m.vertexColors,
  });
  t.name = m.name;
  t.userData = { ...m.userData };
  return t;
}

const outlineVertex = /* glsl */ `
  attribute vec3 inkNormal;
  uniform float uWidth; // pixels
  uniform vec2 uRes; // drawing buffer size
  uniform float uDepth; // push back in depth, so a wider glow sits behind the ink
  #include <skinning_pars_vertex>
  #include <fog_pars_vertex>
  #include <clipping_planes_pars_vertex>
  void main() {
    vec3 transformed = position;
    vec3 objectNormal = inkNormal;
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <skinning_vertex>
    vec4 local = vec4(transformed, 1.0);
    vec3 n = objectNormal;
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
      n = mat3(instanceMatrix) * n;
    #endif
    vec4 mvPosition = modelViewMatrix * local;
    vec4 clip = projectionMatrix * mvPosition;
    vec3 vn = normalize(normalMatrix * n);
    vec2 dir = (projectionMatrix * vec4(vn, 0.0)).xy;
    float len = length(dir);
    if (len > 1e-5) clip.xy += dir / len * uWidth * 2.0 / uRes * clip.w;
    clip.z += uDepth * clip.w;
    gl_Position = clip;
    #include <clipping_planes_vertex>
    #include <fog_vertex>
  }
`;

const outlineFragment = /* glsl */ `
  uniform vec3 uColor;
  #include <fog_pars_fragment>
  #include <clipping_planes_pars_fragment>
  void main() {
    #include <clipping_planes_fragment>
    gl_FragColor = vec4(uColor, 1.0);
    #include <fog_fragment>
  }
`;

// one outline material for everything, so every outline shares a program and the width uniform
const inkUniforms = {
  uWidth: { value: INK.width },
  uRes: { value: new THREE.Vector2(1, 1) },
  uColor: { value: new THREE.Color(INK.color) },
  uDepth: { value: 0 },
};
let inkMat: THREE.ShaderMaterial | null = null;

export function outlineMaterial(): THREE.ShaderMaterial {
  inkMat ??= new THREE.ShaderMaterial({
    vertexShader: outlineVertex,
    fragmentShader: outlineFragment,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    side: THREE.BackSide,
    fog: true,
    clipping: true, // a floor's kit is cut where the next floor joins on (StreetView's clipping planes)
  });
  Object.assign(inkMat.uniforms, inkUniforms);
  return inkMat;
}

// keep the outline width in pixels as the canvas resizes; pixelRatio scales CSS px to buffer px
export function setInkResolution(width: number, height: number, pixelRatio: number): void {
  inkUniforms.uRes.value.set(width, height);
  inkUniforms.uWidth.value = Math.max(1, INK.width * pixelRatio); // at least a whole pixel in the chunky look
}

// smoothed normals: every vertex at the same spot gets the average of their normals, so the hull of a box has no
// gaps at its corners
export function inkNormals(geo: THREE.BufferGeometry): void {
  if (geo.getAttribute('inkNormal')) return;
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  //vertices are matched on their position rounded to 1e-4, in an open-addressed hash table (a Map of string keys
  //took most of a floor's build time on the hillside's big meshes)
  const n = pos.count;
  let size = 1;
  while (size < n * 2) size <<= 1;
  const mask = size - 1;
  const keys = new Int32Array(size * 3);
  const used = new Uint8Array(size);
  const sums = new Float32Array(size * 3);
  const slotOf = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const x = Math.round(pos.getX(i) * 1e4);
    const y = Math.round(pos.getY(i) * 1e4);
    const z = Math.round(pos.getZ(i) * 1e4);
    //rounded positions are often multiples of a power of two: scramble the bits so the low ones vary too
    let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = (h ^ (h >>> 16)) & mask;
    while (used[h] && (keys[h * 3] !== x || keys[h * 3 + 1] !== y || keys[h * 3 + 2] !== z)) h = (h + 1) & mask;
    if (!used[h]) {
      used[h] = 1;
      keys[h * 3] = x;
      keys[h * 3 + 1] = y;
      keys[h * 3 + 2] = z;
    }
    sums[h * 3] += nor.getX(i);
    sums[h * 3 + 1] += nor.getY(i);
    sums[h * 3 + 2] += nor.getZ(i);
    slotOf[i] = h;
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const h = slotOf[i] * 3;
    const sx = sums[h];
    const sy = sums[h + 1];
    const sz = sums[h + 2];
    const len = Math.hypot(sx, sy, sz) || 1;
    out[i * 3] = sx / len;
    out[i * 3 + 1] = sy / len;
    out[i * 3 + 2] = sz / len;
  }
  geo.setAttribute('inkNormal', new THREE.BufferAttribute(out, 3));
}

export interface InkOptions {
  toon?: boolean; // swap Lambert and Phong materials for toon ones (default true)
  outline?: (mesh: THREE.Mesh) => boolean; // which meshes get an outline (default: all solid ones)
}

//hidden meshes (the rig's bone drivers) and see-through ones get no outline
export const solid = (mesh: THREE.Mesh) =>
  mesh.visible &&
  [mesh.material].flat().some((m) => !m.transparent || (m as THREE.MeshLambertMaterial).alphaTest > 0);

// give a model the ink look: toon materials and outlines. Safe to call again; meshes are only done once.
export function inkify(root: THREE.Object3D, opts: InkOptions = {}): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.ink && !o.userData.inked) meshes.push(o);
  });
  for (const mesh of meshes) {
    mesh.userData.inked = true;
    if (opts.toon !== false) {
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(toToon) : toToon(mesh.material);
    }
    if (!(opts.outline ?? solid)(mesh)) continue;
    inkNormals(mesh.geometry);
    let hull: THREE.Mesh;
    if (mesh instanceof THREE.InstancedMesh) {
      const inst = new THREE.InstancedMesh(mesh.geometry, outlineMaterial(), mesh.count);
      inst.instanceMatrix = mesh.instanceMatrix; // shared: moves and hides with its instances
      inst.frustumCulled = false;
      hull = inst;
    } else if (mesh instanceof THREE.SkinnedMesh) {
      //same skeleton and bind, so the outline bends with the body
      const skinned = new THREE.SkinnedMesh(mesh.geometry, outlineMaterial());
      skinned.bind(mesh.skeleton, mesh.bindMatrix);
      skinned.frustumCulled = false;
      hull = skinned;
    } else {
      hull = new THREE.Mesh(mesh.geometry, outlineMaterial());
    }
    hull.userData.ink = true;
    hull.renderOrder = mesh.renderOrder;
    if (!(mesh instanceof THREE.InstancedMesh || mesh instanceof THREE.SkinnedMesh)) hull.frustumCulled = mesh.frustumCulled;
    mesh.add(hull);
  }
}

// a glowing second outline round a model (the gnar state): wider than the ink and drawn behind it, with its own
// colour and width. Hidden until switched on.
export class Aura {
  private readonly mat: THREE.ShaderMaterial;
  private readonly hulls: THREE.Mesh[] = [];
  private readonly ink = new THREE.Color(INK.color);

  constructor(root: THREE.Object3D, width = 2.5) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: outlineVertex,
      fragmentShader: outlineFragment,
      uniforms: {
        uWidth: { value: width },
        uRes: inkUniforms.uRes, // shared, so resizes reach it
        uColor: { value: new THREE.Color(0xffd23f) },
        uDepth: { value: 0.002 },
      },
      side: THREE.BackSide,
    });
    this.baseWidth = width;
    //skip the hulls the ink already added
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.userData.ink && solid(o)) meshes.push(o);
    });
    for (const mesh of meshes) {
      inkNormals(mesh.geometry);
      let hull: THREE.Mesh;
      if (mesh instanceof THREE.SkinnedMesh) {
        const skinned = new THREE.SkinnedMesh(mesh.geometry, this.mat);
        skinned.bind(mesh.skeleton, mesh.bindMatrix);
        hull = skinned;
      } else {
        hull = new THREE.Mesh(mesh.geometry, this.mat);
      }
      hull.userData.ink = true;
      hull.frustumCulled = false;
      hull.visible = false;
      hull.renderOrder = -1;
      mesh.add(hull);
      this.hulls.push(hull);
    }
  }

  private baseWidth: number;

  // amount 0..1 fades it in by width; t (seconds) cycles the colour gold, magenta, cyan
  set(amount: number, t: number, pixelRatio: number): void {
    const on = amount > 0.01;
    for (const h of this.hulls) h.visible = on;
    if (!on) return;
    this.mat.uniforms.uWidth.value = (INK.width + this.baseWidth * amount * (0.85 + 0.15 * Math.sin(t * 12))) * pixelRatio;
    const c = this.mat.uniforms.uColor.value as THREE.Color;
    c.setHSL((0.13 + t * 0.35) % 1, 1, 0.6);
    c.lerp(this.ink, 1 - amount);
  }

  // a steady outline: amount 0..1 fades it in, `width` CSS px past the ink at full (the night rim, skater-light.ts)
  steady(amount: number, width: number, color: THREE.Color, pixelRatio: number): void {
    const on = amount > 0.01;
    for (const h of this.hulls) h.visible = on;
    if (!on) return;
    this.mat.uniforms.uWidth.value = (INK.width + width * amount) * pixelRatio;
    (this.mat.uniforms.uColor.value as THREE.Color).copy(color).lerp(this.ink, 1 - amount);
  }
}
