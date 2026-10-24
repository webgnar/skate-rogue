import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { wearBoard, wearShoes } from '../src/render/wear';
import { freshGear } from '../src/run/gear';

const deckMesh = () => {
  const g = new THREE.BufferGeometry();
  // a nose tip, the middle of the deck, a tail tip
  g.setAttribute('position', new THREE.Float32BufferAttribute([0.47, 0.05, 0.02, 0, 0, 0, -0.47, 0.05, -0.03], 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial());
};

describe('gear wear looks', () => {
  it('chips the nose and tail of a worn deck, never the middle, and heals with a new deck', () => {
    const board = new THREE.Group();
    const deck = deckMesh();
    board.add(deck);
    const pos = deck.geometry.attributes.position;
    wearBoard(board, { ...freshGear(), deck: 0 });
    expect(pos.getX(0)).toBeLessThan(0.47);
    expect(pos.getX(2)).toBeGreaterThan(-0.47);
    expect(pos.getX(1)).toBe(0);
    wearBoard(board, freshGear());
    expect(pos.getX(0)).toBeCloseTo(0.47);
  });

  it('flat-spots worn wheels', () => {
    const g = new THREE.BufferGeometry();
    const r = (27 * 0.95) / 32 / 25.4;
    g.setAttribute('position', new THREE.Float32BufferAttribute([0.27, r - 0.12 - r, 0.105], 3)); // a wheel's bottom
    const wheel = new THREE.Mesh(g, new THREE.MeshToonMaterial());
    wheel.userData.mat = 'wheel';
    const board = new THREE.Group().add(wheel);
    wearBoard(board, { ...freshGear(), wheels: 0 });
    expect(g.attributes.position.getY(0)).toBeGreaterThan(-0.12 + 0.001);
  });

  it('shows the shoe scuff when worn and the hole when nearly busted', () => {
    const root = new THREE.Group();
    const scuff = new THREE.Object3D();
    scuff.userData.mat = 'WearScuff';
    const hole = new THREE.Object3D();
    hole.userData.mat = 'WearHole';
    root.add(scuff, hole);
    wearShoes(root, 100);
    expect([scuff.visible, hole.visible]).toEqual([false, false]);
    wearShoes(root, 50);
    expect([scuff.visible, hole.visible]).toEqual([true, false]);
    wearShoes(root, 10);
    expect([scuff.visible, hole.visible]).toEqual([true, true]);
  });
});
