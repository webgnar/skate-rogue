// The sky's set pieces (src/sim/sky.ts SkyPieceSim, src/gen/sky-beats.ts), drawn from the sim each frame: an ad
// blimp moored over the hill, its back the deck you ride; a window washer's rig hung on its ropes, dropping once
// you're on it; a tower crane whose jib slews out of the lane and back round its mast; and the paper billboards
// standing across the gaps, torn away when you burst through. Greybox: plain shapes in the kit's colours, inked.
import * as THREE from 'three';
import { at } from '../game/interp';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import type { Sky, SkyPieceSim } from '../sim/sky';
import { groundAt } from '../gen/top-route';
import { toX, toY } from './kit';
import { adTexture, adUv } from './sky-kit';
import { inkify } from './toon';

const T = (px: number) => px / TILE;

export class SkyPiecesView {
  readonly group = new THREE.Group();
  private pieces: { sim: SkyPieceSim; g: THREE.Group; moving: THREE.Object3D }[] = [];
  private busts: THREE.Object3D[] = [];
  private readonly steel = new THREE.MeshLambertMaterial({ color: 0x55596a });
  private readonly yellow = new THREE.MeshLambertMaterial({ color: 0xe8b020 });
  private readonly hull = new THREE.MeshLambertMaterial({ color: 0xb8c8e0 });
  private readonly fin = new THREE.MeshLambertMaterial({ color: 0xe83a5a });
  private readonly plank = new THREE.MeshLambertMaterial({ color: 0x9a6a40 });
  private readonly rope = new THREE.MeshBasicMaterial({ color: 0x1a1424 });
  private readonly paper = new THREE.MeshLambertMaterial({ map: adTexture(), side: THREE.DoubleSide });

  reset(sky: Sky): void {
    for (const p of this.pieces) this.group.remove(p.g);
    for (const b of this.busts) this.group.remove(b);
    this.pieces = [];
    this.busts = [];
    const level = sky.level;
    const Y = (py: number) => toY(level, py);
    const foot = (px: number) => Y(groundAt(level, px) ?? level.streetY);
    for (const sim of sky.pieces) {
      const s = sim.site;
      const g = new THREE.Group();
      const moving = new THREE.Group();
      g.add(moving);
      const w = T(s.x1 - s.x0);
      if (s.kind === 'blimp') {
        //the envelope: a long capsule whose top is the deck, fins at the back, the gondola under it, an ad on its side
        const r = 1.8;
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(r, w, 6, 16).rotateZ(Math.PI / 2), this.hull);
        body.position.set(w / 2, -r, 0);
        const ad = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 1.4), new THREE.MeshLambertMaterial({ map: adTexture() }));
        adUv(ad, 0);
        ad.position.set(w / 2, -r, r + 0.02);
        const gondola = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 1.2), this.steel);
        gondola.position.set(w / 2, -2 * r - 0.35, 0);
        moving.add(body, ad, gondola);
        //red bands round the envelope, so it reads as a balloon
        for (let bx = 1.5; bx < w; bx += 3.5) {
          const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.35, 16).rotateZ(Math.PI / 2), this.fin);
          band.position.set(bx, -r, 0);
          moving.add(band);
        }
        const tall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.14), this.fin);
        tall.position.set(-r * 0.6, -r * 0.3, 0);
        const wide = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 2.6), this.fin);
        wide.position.set(-r * 0.6, -r, 0);
        moving.add(tall, wide);
        //moored: a line down to the hill
        const fx = s.x0 + 2 * TILE;
        const top = Y(s.y) - 2 * r;
        const bottom = foot(fx);
        if (top > bottom) {
          const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, top - bottom, 0.05), this.rope);
          line.position.set(2, -2 * r - (top - bottom) / 2, -0.4);
          moving.add(line);
        }
      } else if (s.kind === 'rig') {
        //the deck with its guard rail, hung on two ropes from a davit far up
        const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, 1.4), this.plank);
        deck.position.set(w / 2, -0.12, -0.3);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.06), this.steel);
        rail.position.set(w / 2, 0.9, -0.95);
        moving.add(deck, rail);
        for (const rx of [0.2, w - 0.2]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.06), this.steel);
          post.position.set(rx, 0.45, -0.95);
          moving.add(post);
        }
        //the ropes stay hung from the davit: drawn each frame from it down to the deck
        const davit = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.3, 0.3), this.steel);
        davit.position.set(w / 2, 7, -0.8);
        g.add(davit);
        for (const rx of [0.3, w - 0.3]) {
          const ropeLine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.05), this.rope);
          ropeLine.position.set(rx, 0, -0.8);
          ropeLine.userData.rope = true;
          g.add(ropeLine);
        }
      } else {
        //a tower crane: its mast up from the hill, the jib slewing round the top of it
        const mx = T(s.mast! - s.x0);
        const top = Y(s.y);
        const bottom = foot(s.mast!);
        const mast = new THREE.Mesh(new THREE.BoxGeometry(0.6, Math.max(0.1, top - bottom + 1.2), 0.6), this.yellow);
        mast.position.set(mx, -(top - bottom) / 2 + 0.6, -1.2);
        g.add(mast);
        const pivot = new THREE.Group();
        pivot.position.set(mx, 0, -1.2);
        const jib = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 0.35), this.yellow);
        jib.position.set(w / 2 - mx, -0.18, 1.2);
        const tie = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.05, 0.05), this.steel);
        tie.position.set(w / 2 - mx, 1.1, 1.2);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 0.9), this.yellow);
        cab.position.set(0.6, -0.8, 1.2);
        const weight = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.9), this.steel);
        weight.position.set(0.5 - mx, -0.6, 1.2);
        const peak = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.3), this.yellow);
        peak.position.set(0, 0.5, 1.2);
        pivot.add(jib, tie, cab, weight, peak);
        g.add(pivot);
        g.userData.pivot = pivot;
      }
      g.position.set(toX(s.x0), Y(s.y), 0);
      inkify(g);
      this.pieces.push({ sim, g, moving });
      this.group.add(g);
    }
    //the paper billboards: a sheet across the lane on two poles, turned so you see its face
    sky.busts.forEach((b, i) => {
      const h = T(b.y1 - b.y0);
      const sheet = new THREE.Group();
      const face = new THREE.Mesh(new THREE.PlaneGeometry(3, h * 0.8), this.paper);
      adUv(face, (i + 2) % 5);
      face.position.y = h * 0.1;
      sheet.add(face);
      for (const z of [-1.5, 1.5]) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.12), this.steel);
        pole.position.set(z, 0, 0);
        sheet.add(pole);
      }
      sheet.rotation.y = -1.0;
      sheet.position.set(toX(b.x), Y((b.y0 + b.y1) / 2), 0);
      inkify(sheet);
      this.busts.push(sheet);
      this.group.add(sheet);
    });
  }

  update(level: Level, skaterX: number): void {
    for (const { sim, g, moving } of this.pieces) {
      g.visible = Math.abs(sim.site.x0 - skaterX) < 1400 || Math.abs(sim.site.x1 - skaterX) < 1400;
      if (!g.visible) continue;
      const dy = toY(level, at(sim, 'y')) - toY(level, sim.site.y);
      moving.position.y = dy;
      if (sim.site.kind === 'swing') (g.userData.pivot as THREE.Object3D).rotation.y = at(sim, 'angle');
      if (sim.site.kind === 'rig') {
        //the ropes from the davit down to the deck, wherever it's dropped to
        for (const c of g.children) {
          if (!c.userData.rope) continue;
          const len = 7 - dy;
          c.scale.y = len;
          c.position.y = 7 - len / 2;
        }
      }
    }
  }

  // a billboard burst through: the sheet is gone
  bust(i: number): void {
    const b = this.busts[i];
    if (b) b.visible = false;
  }
}
