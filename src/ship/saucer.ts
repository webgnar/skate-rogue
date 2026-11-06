// The Pleiadian ship from outside: a pearl saucer, a violet glass dome with the flame-lit core the Stoken carries,
// a ring of lights round its rim. Centred on its own origin, 9 tiles across. Act 5's finale hangs it over the gate
// (buildShip in src/render/sky-kit.ts), and the Chapter 1 ending (src/ship/ending-scene.ts) flies up into it.
import * as THREE from 'three';

export const SAUCER_R = 4.5; // the hull's radius, tiles

export function saucer(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'saucer';
  const pearl = new THREE.MeshLambertMaterial({ color: 0xe8e4f4, emissive: 0x2a2440 });
  const rim = new THREE.MeshLambertMaterial({ color: 0x9a94b8 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9a5cff, emissive: 0x3a1680, transparent: true, opacity: 0.8 });
  const core = new THREE.MeshBasicMaterial({ color: 0xffb040 });
  const light = new THREE.MeshBasicMaterial({ color: 0xbfe8ff });
  const hull = new THREE.Mesh(new THREE.SphereGeometry(SAUCER_R, 32, 12), pearl);
  hull.scale.y = 0.22;
  g.add(hull);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(SAUCER_R + 0.1, SAUCER_R + 0.1, 0.25, 40), rim));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  dome.position.y = 0.6;
  g.add(dome);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), core);
  flame.position.y = 1.0;
  g.add(flame);
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), light, 16);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    lights.setMatrixAt(i, m.makeTranslation(Math.cos(a) * (SAUCER_R + 0.12), 0, Math.sin(a) * (SAUCER_R + 0.12)));
  }
  lights.name = 'rimLights';
  g.add(lights);
  return g;
}
