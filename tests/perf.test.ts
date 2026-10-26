// The performance pass (2026-10-26): the faster kit merges must build exactly what the old clone-and-merge did,
// and a sliced build must come out the same as one built in one go.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import { bakeMerge, batchSteps } from '../src/render/batch';
import { mergeInk } from '../src/render/kit-merge';
import { inkNormals } from '../src/render/toon';
import { run, sliceEnd, sliceStart } from '../src/render/slice';

function scatter(indexed: boolean): { root: THREE.Group; meshes: THREE.Mesh[] } {
  const root = new THREE.Group();
  root.position.set(3, -2, 1);
  const mat = new THREE.MeshLambertMaterial({ color: 0x884422 });
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    let g: THREE.BufferGeometry = new THREE.BoxGeometry(1 + i * 0.3, 0.5, 2);
    if (!indexed) g = g.toNonIndexed();
    const m = new THREE.Mesh(g, mat);
    m.position.set(i * 2.1, i * 0.4, -i);
    m.rotation.set(i * 0.3, i * 0.7, -i * 0.2);
    m.scale.set(1, 1 + i * 0.1, i % 2 ? -1 : 1);
    root.add(m);
    meshes.push(m);
  }
  root.updateMatrixWorld(true);
  return { root, meshes };
}

function close(a: ArrayLike<number>, b: ArrayLike<number>): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i], 5);
}

describe('kit merges', () => {
  for (const indexed of [true, false]) {
    it(`bakeMerge matches clone + applyMatrix4 + mergeGeometries (${indexed ? 'indexed' : 'non-indexed'})`, () => {
      const { root, meshes } = scatter(indexed);
      const inv = root.matrixWorld.clone().invert();
      const old = mergeGeometries(meshes.map((m) => m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))))!;
      const now = bakeMerge(meshes, inv)!;
      expect(Object.keys(now.attributes).sort()).toEqual(Object.keys(old.attributes).sort());
      for (const n of Object.keys(old.attributes)) close(now.getAttribute(n).array, old.getAttribute(n).array);
      if (indexed) expect([...now.index!.array]).toEqual([...old.index!.array]);
      else expect(now.index).toBeNull();
    });
  }

  it('mergeInk outlines every static hull, baked into the kit', () => {
    const { root, meshes } = scatter(true);
    for (const m of meshes) {
      inkNormals(m.geometry);
      const hull = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial());
      hull.userData.ink = true;
      m.add(hull);
    }
    const ink = mergeInk(root)!;
    const verts = meshes.reduce((n, m) => n + m.geometry.getAttribute('position').count, 0);
    expect(ink.geometry.getAttribute('position').count).toBe(verts);
    expect(ink.geometry.index!.count).toBe(meshes.reduce((n, m) => n + m.geometry.index!.count, 0));
    //the last box's first vertex, where the old merge put it
    const last = meshes[5];
    const want = new THREE.Vector3().fromBufferAttribute(last.geometry.getAttribute('position') as THREE.BufferAttribute, 0).applyMatrix4(new THREE.Matrix4().multiplyMatrices(root.matrixWorld.clone().invert(), last.matrixWorld));
    const at = verts - last.geometry.getAttribute('position').count;
    const got = new THREE.Vector3().fromBufferAttribute(ink.geometry.getAttribute('position') as THREE.BufferAttribute, at);
    expect(got.distanceTo(want)).toBeLessThan(1e-5);
    expect(root.children.filter((c) => c.userData.inkMerged)).toHaveLength(1);
  });

  it('a sliced batch builds what one in one go does', () => {
    const a = scatter(true);
    const b = scatter(true);
    run(batchSteps(a.root));
    sliceStart(0); // a slice already spent: it yields at every chance
    const job = batchSteps(b.root);
    let steps = 0;
    while (!job.next().done) steps++;
    sliceEnd();
    expect(steps).toBeGreaterThan(0);
    const pa = (a.root.children[0] as THREE.Mesh).geometry.getAttribute('position').array;
    const pb = (b.root.children[0] as THREE.Mesh).geometry.getAttribute('position').array;
    close(pa, pb);
  });
});
