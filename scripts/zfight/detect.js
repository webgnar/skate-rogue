// Runs in the game page (scripts/zfight/run.mjs injects it): finds pairs of front-facing triangles that lie in the
// same plane and cover the same patch, which is what z-fights. Works on raw geometry in world space, so batching
// and merging don't hide anything. Returns overlap clusters with where they are and what materials meet there.
(function detect(opts) {
  const EPS_D = opts.epsD ?? 0.004; // world units apart along the normal that still fight (24-bit depth at ~22 away)
  const MIN_AREA = opts.minArea ?? 0.0004; // ignore slivers smaller than this (world units squared)
  const scene = opts.scene;
  const tris = []; // {p:[[x,y,z]x3], n:[x,y,z], d, mat, mesh}
  const mats = [];
  const matId = new Map();
  const idOf = (m) => {
    if (!matId.has(m)) {
      matId.set(m, mats.length);
      const c = m.color ? m.color.getHexString() : '';
      mats.push({ type: m.type, name: m.name, color: c, map: m.map?.name || m.map?.image?.src?.split('/').pop() || (m.map ? 'tex' : ''), surface: m.userData?.surface ?? '', transparent: m.transparent, side: m.side, offset: m.polygonOffset, depthWrite: m.depthWrite, depthTest: m.depthTest, opacity: m.opacity });
    }
    return matId.get(m);
  };
  const visible = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  const clip3 = (poly, planes) => {
    for (const pl of planes) {
      const n = pl.normal, c = pl.constant;
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const da = n.x * a[0] + n.y * a[1] + n.z * a[2] + c, db = n.x * b[0] + n.y * b[1] + n.z * b[2] + c;
        if (da >= 0) out.push(a);
        if ((da >= 0) !== (db >= 0)) {
          const t = da / (da - db);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
        }
      }
      poly = out;
      if (poly.length < 3) return null;
    }
    return poly;
  };
  scene.updateMatrixWorld(true);
  let meshes = 0;
  const meshNames = [''];
  scene.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.ink || !visible(o)) return; // (ink hulls: pushed out on screen)
    const geo = o.geometry;
    const pos = geo.attributes.position;
    if (!pos || geo.attributes.position.itemSize !== 3) return;
    const matList = Array.isArray(o.material) ? o.material : [o.material];
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: geo.index ? geo.index.count : pos.count, materialIndex: 0 }];
    const index = geo.index;
    const insts = o.isInstancedMesh ? o.count : 1;
    meshes++;
    const path = [];
    for (let p = o; p && p !== scene; p = p.parent) path.push(p.name || p.type + (Object.keys(p.userData || {}).length ? '{' + Object.keys(p.userData).join(',') + '}' : ''));
    meshNames.push(path.reverse().join('/'));
    for (let k = 0; k < insts; k++) {
      const m = o.matrixWorld.clone();
      if (o.isInstancedMesh) {
        const im = new m.constructor();
        o.getMatrixAt(k, im);
        m.multiply(im);
      }
      const e = m.elements;
      const tx = (i) => {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
      };
      for (const g of groups) {
        const mat = matList[g.materialIndex ?? 0];
        if (!mat || !mat.visible || mat.side === 1 /* BackSide: ink hulls */ || mat.colorWrite === false) continue;
        if (mat.opacity === 0) continue;
        const id = idOf(mat);
        const planes = mat.clippingPlanes || [];
        const end = Math.min(g.start + g.count, index ? index.count : pos.count);
        for (let t = g.start; t + 2 < end; t += 3) {
          const ia = index ? index.getX(t) : t, ib = index ? index.getX(t + 1) : t + 1, ic = index ? index.getX(t + 2) : t + 2;
          const a = tx(ia), b = tx(ib), c = tx(ic);
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const len = Math.hypot(nx, ny, nz);
          if (len < 1e-7) continue;
          nx /= len; ny /= len; nz /= len;
          if (nz < -0.2 && mat.side !== 2) continue; // faces away from the side-on camera: never seen
          let poly = [a, b, c];
          if (planes.length) {
            poly = clip3(poly, planes);
            if (!poly) continue;
          }
          tris.push({ p: poly, n: [nx, ny, nz], d: nx * a[0] + ny * a[1] + nz * a[2], mat: id, mesh: meshes, two: mat.side === 2 });
        }
      }
    }
  });
  // group by orientation (the opposite way too, folded in, when a side is double-sided)
  const groups = new Map();
  for (const t of tris) {
    let n = t.n, d = t.d;
    const key = (v) => `${Math.round(v[0] * 200)},${Math.round(v[1] * 200)},${Math.round(v[2] * 200)}`;
    t.key = key(n);
    if (!groups.has(t.key)) groups.set(t.key, []);
    groups.get(t.key).push(t);
  }
  // projection basis per normal
  const basis = (n) => {
    const a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
    const ul = Math.hypot(...u);
    u = u.map((x) => x / ul);
    const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    return [u, v];
  };
  const area2 = (P) => {
    let s = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return s / 2;
  };
  const ccw = (P) => (area2(P) < 0 ? P.slice().reverse() : P);
  const clip2 = (subject, clipper) => {
    let out = subject;
    for (let i = 0; i < clipper.length && out.length; i++) {
      const A = clipper[i], B = clipper[(i + 1) % clipper.length];
      const inside = (p) => (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]) >= -1e-9;
      const inp = out;
      out = [];
      for (let j = 0; j < inp.length; j++) {
        const P = inp[j], Q = inp[(j + 1) % inp.length];
        const pi = inside(P), qi = inside(Q);
        if (pi) out.push(P);
        if (pi !== qi) {
          const dx = Q[0] - P[0], dy = Q[1] - P[1], ex = B[0] - A[0], ey = B[1] - A[1];
          const den = dx * ey - dy * ex;
          const t = ((A[0] - P[0]) * ey - (A[1] - P[1]) * ex) / den;
          out.push([P[0] + dx * t, P[1] + dy * t]);
        }
      }
    }
    return out;
  };
  // one material over itself looks the same either way, unless its texture isn't laid in world space (an atlas:
  // each piece shows its own part of it, and two pieces in one plane flicker between them)
  const atlas = (i) => !!mats[i].map && !mats[i].surface;
  const hits = [];
  const CELL = 1.5;
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const [u, v] = basis(list[0].n);
    list.sort((a, b) => a.d - b.d);
    for (const t of list) {
      t.q = ccw(t.p.map((p) => [p[0] * u[0] + p[1] * u[1] + p[2] * u[2], p[0] * v[0] + p[1] * v[1] + p[2] * v[2]]));
      t.box = [Math.min(...t.q.map((p) => p[0])), Math.min(...t.q.map((p) => p[1])), Math.max(...t.q.map((p) => p[0])), Math.max(...t.q.map((p) => p[1]))];
    }
    // sweep d in windows of EPS_D, with a 2D grid inside each window
    let i0 = 0;
    while (i0 < list.length) {
      let i1 = i0;
      while (i1 + 1 < list.length && list[i1 + 1].d - list[i0].d < EPS_D) i1++;
      if (i1 > i0) {
        const grid = new Map();
        for (let i = i0; i <= i1; i++) {
          const t = list[i];
          for (let gx = Math.floor(t.box[0] / CELL); gx <= Math.floor(t.box[2] / CELL); gx++)
            for (let gy = Math.floor(t.box[1] / CELL); gy <= Math.floor(t.box[3] / CELL); gy++) {
              const k = gx + ',' + gy;
              if (!grid.has(k)) grid.set(k, []);
              grid.get(k).push(i);
            }
        }
        const seen = new Set();
        for (const cell of grid.values()) {
          for (let x = 0; x < cell.length; x++)
            for (let y = x + 1; y < cell.length; y++) {
              const ia = cell[x], ib = cell[y];
              const pk = ia * 1e7 + ib;
              if (seen.has(pk)) continue;
              seen.add(pk);
              const A = list[ia], B = list[ib];
              if (Math.abs(A.d - B.d) >= EPS_D) continue;
              if (A.box[0] >= B.box[2] || B.box[0] >= A.box[2] || A.box[1] >= B.box[3] || B.box[1] >= A.box[3]) continue;
              const I = clip2(A.q, B.q);
              if (I.length < 3) continue;
              const ar = Math.abs(area2(I));
              if (ar < MIN_AREA) continue;
              // where: the centroid of the overlap, back in 3D
              let cu = 0, cv = 0;
              for (const p of I) { cu += p[0]; cv += p[1]; }
              cu /= I.length; cv /= I.length;
              const n = A.n, dd = A.d;
              const w = [cu * u[0] + cv * v[0] + dd * n[0], cu * u[1] + cv * v[1] + dd * n[1], cu * u[2] + cv * v[2] + dd * n[2]];
              hits.push({ at: w, area: ar, n, gap: Math.abs(A.d - B.d), mats: [A.mat, B.mat].sort((a, b) => a - b), same: A.mat === B.mat && !atlas(A.mat), meshes: [A.mesh, B.mesh] });
            }
        }
      }
      i0 = i1 + 1;
    }
  }
  // cluster hits by material pair, normal and place (within 1.5 units)
  const clusters = [];
  for (const h of hits) {
    const key = h.mats.join('/') + '|' + h.n.map((x) => Math.round(x * 20)).join(',');
    let c = clusters.find((c) => c.key === key && Math.hypot(c.at[0] - h.at[0], c.at[1] - h.at[1], c.at[2] - h.at[2]) < 2.5);
    if (!c) clusters.push((c = { key, at: h.at.slice(), min: h.at.slice(), max: h.at.slice(), area: 0, count: 0, n: h.n, mats: h.mats, same: h.same, gap: h.gap, meshIds: [], pts: [] }));
    c.area += h.area;
    c.meshIds.push(...h.meshes);
    if (c.pts.length < 6) c.pts.push(h.at);
    c.count++;
    for (let k = 0; k < 3; k++) { c.min[k] = Math.min(c.min[k], h.at[k]); c.max[k] = Math.max(c.max[k], h.at[k]); }
  }
  clusters.sort((a, b) => b.area - a.area);
  for (const c of clusters) c.names = [...new Set(c.meshIds)].slice(0, 4).map((i) => meshNames[i]);
  // seen from the game's camera? A ray from the camera to each of a cluster's points, against every triangle
  const blocked = (o, p) => {
    const dx = p[0] - o[0], dy = p[1] - o[1], dz = p[2] - o[2];
    for (const t of tris) {
      const P = t.p;
      for (let k = 1; k + 1 < P.length; k++) {
        const a = P[0], b = P[k], c = P[k + 1];
        const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det;
        const sx = o[0] - a[0], sy = o[1] - a[1], sz = o[2] - a[2];
        const u = (sx * px + sy * py + sz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (tt > 1e-4 && tt < 0.995) return true; // something solid in between (stops short of the spot itself)
      }
    }
    return false;
  };
  if (opts.cams) {
    // only clusters with different materials are worth the rays (one material over itself looks the same)
    for (const c of clusters) {
      if (c.same) continue;
      c.seen = 0;
      // (a face is only seen from its front side; a polygon offset on either side settles who wins)
      const facing = (cam, p) => (cam[0] - p[0]) * c.n[0] + (cam[1] - p[1]) * c.n[1] + (cam[2] - p[2]) * c.n[2] > 0;
      if (c.mats.some((m) => mats[m].offset)) continue;
      for (const p of c.pts) for (const cam of opts.cams(p)) if (cam && facing(cam, p) && !blocked(cam, p)) { c.seen++; break; }
    }
  }
  return { tris: tris.length, meshes, mats, clusters };
});
