import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Springs } from '../src/render/springs';

// a head bone with a 3-bone chain hanging 0.3 down from it, like a hair clump
function rig() {
  const root = new THREE.Group();
  const head = new THREE.Bone();
  head.name = 'Head';
  root.add(head);
  let parent: THREE.Bone = head;
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Bone();
    b.name = `SpringHair0_${i}`;
    b.position.set(0, i ? -0.1 : 0, 0);
    parent.add(b);
    parent = b;
  }
  root.updateMatrixWorld(true);
  return { root, head, tip: parent };
}

const tipOf = (s: Springs) => (s as unknown as { chains: { p: THREE.Vector3 }[][] }).chains[0][2].p;

describe('springs (hair that trails the motion)', () => {
  it('hangs at rest, trails behind a move and keeps its length', () => {
    const { root } = rig();
    const s = new Springs(root, []);
    expect(s.count).toBe(1);
    s.update(1 / 60, 1);
    expect(tipOf(s).y).toBeCloseTo(-0.3, 3);
    for (let i = 0; i < 30; i++) {
      root.position.x += 0.1; // 6 units a second to +x
      root.updateMatrixWorld(true);
      s.update(1 / 60, 1);
    }
    const rel = tipOf(s).clone().sub(root.position);
    expect(rel.x).toBeLessThan(-0.05); // streams out behind
    expect(rel.length()).toBeLessThan(0.3 + 1e-6);
    expect(rel.length()).toBeGreaterThan(0.2);
  });

  it('a teleport snaps it back to rest instead of flinging it', () => {
    const { root } = rig();
    const s = new Springs(root, []);
    s.update(1 / 60, 1);
    root.position.x += 50;
    root.updateMatrixWorld(true);
    s.update(1 / 60, 1);
    expect(tipOf(s).x).toBeCloseTo(50, 3);
  });
});
