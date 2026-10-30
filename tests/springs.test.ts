import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Springs, feelOf, SPRING } from '../src/render/springs';

// a head bone with a 3-bone chain hanging 0.3 down from it, like a hair clump (or standing 0.3 up, `up`)
function rig(name = 'SpringHair0', up = false) {
  const root = new THREE.Group();
  const head = new THREE.Bone();
  head.name = 'Head';
  root.add(head);
  let parent: THREE.Bone = head;
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Bone();
    b.name = `${name}_${i}`;
    b.position.set(i && up ? 0.03 : 0, i ? (up ? 0.1 : -0.1) : 0, 0); // a spike leans a little
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

  it('gelled anime spikes stand up against gravity but still bob on a pop', () => {
    expect(feelOf('SpringSpike3_0').stiffness).toBeGreaterThan(SPRING.stiffness);
    expect(feelOf('SpringHair1_0').stiffness).toBe(SPRING.stiffness);
    const settle = (name: string) => {
      const { root } = rig(name, true);
      const s = new Springs(root, []);
      for (let i = 0; i < 120; i++) s.update(1 / 60, 1);
      return { s, root, y: tipOf(s).y };
    };
    expect(settle('SpringSpike0').y).toBeGreaterThan(0.27); // still standing
    // pop the head up: both tips dip and lag, the gelled spike less, and it springs back sooner
    const pop = (name: string) => {
      const { s, root } = settle(name);
      let lowest = Infinity;
      for (let i = 0; i < 10; i++) {
        root.position.y += 0.08;
        root.updateMatrixWorld(true);
        s.update(1 / 60, 1);
        lowest = Math.min(lowest, tipOf(s).y - root.position.y);
      }
      return lowest;
    };
    expect(pop('SpringSpike0')).toBeLessThan(0.29);
    expect(pop('SpringSpike0')).toBeGreaterThan(pop('SpringHair0') + 0.02);
  });
});
