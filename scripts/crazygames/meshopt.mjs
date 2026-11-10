// Compresses the meshes of every .glb under a folder in place with EXT_meshopt_compression (lossless: the decoded
// vertices are byte for byte the originals, and every triangle keeps its corners and winding, though the codec may
// start it from another corner). Only the vertex attributes and index lists of the meshes
// are compressed; the node tree, names, materials, images and animations are left exactly as they were, because the
// game finds model parts by name and merges a node's child meshes (src/render/models.ts asMesh). The game loads them
// through src/render/gltf.ts, which sets the decoder. Used by pack.mjs for the CrazyGames build.
//   node scripts/crazygames/meshopt.mjs <folder>
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MeshoptEncoder } from 'meshoptimizer';

const EXT = 'EXT_meshopt_compression';
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const pad4 = (n) => (n + 3) & ~3;

function packGlb(json, bin) {
  const js = Buffer.from(JSON.stringify(json));
  const jsPad = Buffer.concat([js, Buffer.alloc(pad4(js.length) - js.length, 0x20)]);
  const binPad = Buffer.concat([bin, Buffer.alloc(pad4(bin.length) - bin.length)]);
  const total = 12 + 8 + jsPad.length + 8 + binPad.length;
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsPad.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(binPad.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, jsPad, bh, binPad]);
}

export function compressGlb(file) {
  const glb = readFileSync(file);
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
  if ((json.extensionsUsed ?? []).includes(EXT) || !json.buffers || json.buffers.length !== 1) return null;
  const binStart = 20 + jsonLen + 8;
  const bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLen));
  const views = json.bufferViews ?? [];
  const accessors = json.accessors ?? [];

  // which bufferViews hold exactly one mesh attribute or one triangle index list, starting at the view's start
  const usedBy = new Map(); // view -> accessors reading it
  accessors.forEach((a, i) => a.bufferView !== undefined && usedBy.set(a.bufferView, [...(usedBy.get(a.bufferView) ?? []), i]));
  const plan = new Map(); // view -> { mode, count, stride }
  const indexModes = new Map(); // accessor -> every primitive mode using it as indices
  for (const m of json.meshes ?? []) {
    for (const p of m.primitives) {
      for (const a of Object.values(p.attributes)) plan.set(`a${a}`, 'ATTRIBUTES');
      for (const t of p.targets ?? []) for (const a of Object.values(t)) plan.set(`a${a}`, 'ATTRIBUTES');
      if (p.indices !== undefined) indexModes.set(p.indices, [...(indexModes.get(p.indices) ?? []), p.mode ?? 4]);
    }
  }
  const viewPlan = new Map();
  views.forEach((v, vi) => {
    const accs = usedBy.get(vi) ?? [];
    if (accs.length !== 1 || v.buffer !== 0) return;
    const a = accessors[accs[0]];
    if (a.sparse || (a.byteOffset ?? 0) !== 0) return;
    const elem = SIZE[a.type] * BYTES[a.componentType];
    if (plan.get(`a${accs[0]}`) === 'ATTRIBUTES') {
      const stride = v.byteStride ?? elem;
      if (stride % 4 !== 0 || stride > 256 || v.byteLength !== stride * a.count) return;
      viewPlan.set(vi, { mode: 'ATTRIBUTES', count: a.count, stride });
    } else if (indexModes.has(accs[0])) {
      const modes = indexModes.get(accs[0]);
      if (a.type !== 'SCALAR' || (elem !== 2 && elem !== 4) || v.byteLength !== elem * a.count) return;
      const tri = modes.every((md) => md === 4) && a.count % 3 === 0;
      viewPlan.set(vi, { mode: tri ? 'TRIANGLES' : 'INDICES', count: a.count, stride: elem });
    }
  });
  if (!viewPlan.size) return null;

  // buffer 0 (the GLB's own) gets the compressed views and every view left as it was; buffer 1 is the fallback,
  // the size of the decoded data, which nothing reads (the extension is required)
  const chunks = [];
  let at = 0;
  let fallback = 0;
  const put = (bytes) => {
    const off = at;
    chunks.push(bytes, Buffer.alloc(pad4(bytes.length) - bytes.length));
    at += pad4(bytes.length);
    return off;
  };
  views.forEach((v, vi) => {
    const src = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const p = viewPlan.get(vi);
    if (!p) {
      v.byteOffset = put(Buffer.from(src));
      v.buffer = 0;
      return;
    }
    const raw = new Uint8Array(src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength));
    const enc =
      p.mode === 'ATTRIBUTES'
        ? MeshoptEncoder.encodeVertexBufferLevel(raw, p.count, p.stride, 2, 0)
        : p.mode === 'TRIANGLES'
          ? MeshoptEncoder.encodeIndexBuffer(raw, p.count, p.stride)
          : MeshoptEncoder.encodeIndexSequence(raw, p.count, p.stride);
    const off = put(Buffer.from(enc));
    v.extensions = { ...(v.extensions ?? {}), [EXT]: { buffer: 0, byteOffset: off, byteLength: enc.length, byteStride: p.stride, count: p.count, mode: p.mode } };
    v.buffer = 1;
    v.byteOffset = fallback;
    if (p.mode === 'ATTRIBUTES') v.byteStride = p.stride;
    fallback += pad4(v.byteLength);
  });
  const out = Buffer.concat(chunks);
  json.buffers = [{ byteLength: out.length }, { byteLength: fallback, extensions: { [EXT]: { fallback: true } } }];
  json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), EXT])];
  json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), EXT])];
  const packed = packGlb(json, out);
  writeFileSync(file, packed);
  return { before: glb.length, after: packed.length, views: viewPlan.size };
}

export async function compressAll(dir) {
  await MeshoptEncoder.ready;
  let before = 0;
  let after = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.glb')) {
        const r = compressGlb(p);
        if (r) {
          before += r.before;
          after += r.after;
        }
      }
    }
  };
  walk(dir);
  return { before, after };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await compressAll(process.argv[2]);
  console.log(`meshes compressed: ${(r.before / 1048576).toFixed(1)} MB -> ${(r.after / 1048576).toFixed(1)} MB`);
}
