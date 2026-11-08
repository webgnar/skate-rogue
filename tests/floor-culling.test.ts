// Act 3 lag on a small iPhone (2026-11-08): a floor's heavy merged meshes split along it so the camera can cull
// what's off screen, and only the pickups in view are posed and drawn.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BATCH_CHUNK, BATCH_SPLIT_TRIS, batchStatic } from '../src/render/batch';
import { mergeInk } from '../src/render/kit-merge';
import { inkify } from '../src/render/toon';
import { PickupView } from '../src/render/pickups';
import type { Level } from '../src/physics/level';

// a floor's worth of the same box, every 2 units for `len` units
function street(len: number, segs = 8): THREE.Group {
  const root = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x884422 });
  for (let x = 0; x < len; x += 2) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.8, segs, segs), mat);
    m.position.set(x, 0, -2);
    root.add(m);
  }
  root.updateMatrixWorld(true);
  return root;
}

const batches = (root: THREE.Object3D) => root.children.filter((c) => c.name === 'batch') as THREE.Mesh[];

describe('floor culling', () => {
  it('splits a heavy batch along the floor, one chunk per BATCH_CHUNK', () => {
    const root = street(640, 16);
    batchStatic(root);
    const list = batches(root);
    expect(list.length).toBe(Math.ceil(640 / BATCH_CHUNK));
    for (const b of list) {
      b.geometry.computeBoundingBox();
      expect(b.geometry.boundingBox!.max.x - b.geometry.boundingBox!.min.x).toBeLessThanOrEqual(BATCH_CHUNK + 2);
      expect(b.frustumCulled).toBe(true);
    }
  });

  it('keeps a light batch whole (a draw costs more than its triangles)', () => {
    const root = street(40, 4);
    const tris = root.children.reduce((n, m) => n + (m as THREE.Mesh).geometry.index!.count / 3, 0);
    expect(tris).toBeLessThanOrEqual(BATCH_SPLIT_TRIS);
    batchStatic(root);
    expect(batches(root)).toHaveLength(1);
  });

  it('merges the outlines a chunk at a time, each culled by its own bounds', () => {
    const root = street(640, 16);
    batchStatic(root);
    inkify(root);
    const inks = mergeInk(root);
    expect(inks.length).toBe(batches(root).length);
    for (const ink of inks) {
      expect(ink.frustumCulled).toBe(true);
      expect(ink.geometry.boundingSphere!.radius).toBeLessThan(BATCH_CHUNK);
    }
  });

  it('draws only the coins the camera sees', () => {
    const pickups = Array.from({ length: 300 }, (_, i) => ({ kind: 'cash', x: i * 64, y: 0 }));
    const level = { pickups, height: 10 * 32, streetY: 0 } as unknown as Level;
    const view = new PickupView();
    view.setLevel(level);
    const coins = view.group.children.find((c) => c instanceof THREE.InstancedMesh && c.children.length) as THREE.InstancedMesh;
    expect(coins.count).toBe(300); // no camera: all of them
    const camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 400);
    camera.position.set(20, 0, 10);
    camera.updateMatrixWorld();
    view.update(1 / 60, camera);
    expect(coins.count).toBeGreaterThan(0);
    expect(coins.count).toBeLessThan(30);
    //the outline goes with them
    expect((coins.children[0] as THREE.InstancedMesh).count).toBe(coins.count);
  });
});
