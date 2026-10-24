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
  });
  t.name = m.name;
  return t;
}

const outlineVertex = /* glsl */ `
  attribute vec3 inkNormal;
  uniform float uWidth; // pixels
  uniform vec2 uRes; // drawing buffer size
  uniform float uDepth; // push back in depth, so a wider glow sits behind the ink
  #include <skinning_pars_vertex>
  #include <fog_pars_vertex>
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
    #include <fog_vertex>
  }
`;

const outlineFragment = /* glsl */ `
  uniform vec3 uColor;
  #include <fog_pars_fragment>
  void main() {
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

function outlineMaterial(): THREE.ShaderMaterial {
  inkMat ??= new THREE.ShaderMaterial({
    vertexShader: outlineVertex,
    fragmentShader: outlineFragment,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    side: THREE.BackSide,
    fog: true,
  });
  Object.assign(inkMat.uniforms, inkUniforms);
  return inkMat;
}

// keep the outline width in pixels as the canvas resizes; pixelRatio scales CSS px to buffer px
export function setInkResolution(width: number, height: number, pixelRatio: number): void {
  inkUniforms.uRes.value.set(width, height);
  inkUniforms.uWidth.value = INK.width * pixelRatio;
}

// smoothed normals: every vertex at the same spot gets the average of their normals, so the hull of a box has no
// gaps at its corners
function inkNormals(geo: THREE.BufferGeometry): void {
  if (geo.getAttribute('inkNormal')) return;
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const sums = new Map<string, THREE.Vector3>();
  const key = (i: number) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const s = sums.get(k) ?? sums.set(k, new THREE.Vector3()).get(k)!;
    s.x += nor.getX(i);
    s.y += nor.getY(i);
    s.z += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const s = sums.get(key(i))!.clone().normalize();
    out.set([s.x, s.y, s.z], i * 3);
  }
  geo.setAttribute('inkNormal', new THREE.BufferAttribute(out, 3));
}

export interface InkOptions {
  toon?: boolean; // swap Lambert and Phong materials for toon ones (default true)
  outline?: (mesh: THREE.Mesh) => boolean; // which meshes get an outline (default: all solid ones)
}

//hidden meshes (the rig's bone drivers) and see-through ones get no outline
const solid = (mesh: THREE.Mesh) =>
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

  constructor(root: THREE.Object3D, width = 7) {
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
}
