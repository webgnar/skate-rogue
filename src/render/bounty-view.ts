// The wanted poster (src/run/bounty.ts): a board on legs at the back of the sidewalk, the AI's red-and-black poster
// with the skater's silhouette, "WANTED" and the terms, so the bounty reads before the callout does.
import * as THREE from 'three';
import type { Level } from '../physics/level';
import { BOUNTY } from '../run/bounty';
import { toX, toY } from './kit';
import { inkify } from './toon';

let posterTex: THREE.CanvasTexture | null = null;

function poster(): THREE.CanvasTexture {
  if (posterTex) return posterTex;
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2e6c8';
  g.fillRect(0, 0, 192, 256);
  g.fillStyle = '#c0201c';
  g.fillRect(0, 0, 192, 52);
  g.fillStyle = '#fff4d8';
  g.font = 'bold 40px Bangers, Impact, sans-serif';
  g.textAlign = 'center';
  g.fillText('WANTED', 96, 42);
  //the skater's silhouette on a board
  g.fillStyle = '#1a1028';
  g.beginPath();
  g.arc(96, 86, 18, 0, Math.PI * 2);
  g.fill();
  g.fillRect(80, 104, 32, 52);
  g.fillRect(66, 162, 60, 8);
  g.fillStyle = '#c0201c';
  g.font = 'bold 24px Bangers, Impact, sans-serif';
  g.fillText(`HEAT ${BOUNTY.heat}+ AT THE GATE`, 96, 200);
  g.fillStyle = '#7a3cc8';
  g.font = 'bold 30px Bangers, Impact, sans-serif';
  g.fillText('STOKEN x2', 96, 236);
  posterTex = new THREE.CanvasTexture(c);
  posterTex.colorSpace = THREE.SRGBColorSpace;
  return posterTex;
}

export class BountyView {
  readonly group = new THREE.Group();

  set(level: Level): void {
    this.group.clear();
    if (!level.bounty) return;
    const board = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
    for (const x of [-0.5, 0.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), wood);
      leg.position.set(x, 0.6, 0);
      board.add(leg);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 0.08), wood);
    back.position.y = 1.95;
    board.add(back);
    inkify(board);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshBasicMaterial({ map: poster() }));
    face.position.set(0, 1.95, 0.05);
    board.add(face);
    board.position.set(toX(level.bounty.x), toY(level, level.streetY), -2.1);
    this.group.add(board);
  }
}
