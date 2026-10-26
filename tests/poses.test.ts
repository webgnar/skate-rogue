import { describe, expect, it } from 'vitest';
import { BASE, BOARD, CLIPS, clipLength, deckPoint, footTarget, kneePoint, mix, sample, type Pose } from '../src/render/poses';
import { mirrorPose, onNose, switchName } from '../src/render/poses';

const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// the lowest point of the board's wheels, for a pose (wheel bottoms sit BOARD.deckTop below the deck at the bolts)
function wheelBottom(p: Pose, x: number): number {
  const d = deckPoint(p, x);
  return d.y - BOARD.deckTop * Math.cos(p.boardPitch);
}

describe('rig poses', () => {
  it('stands regular: left (front) foot toward the nose at +x, both on the deck over the bolts', () => {
    const f = footTarget(BASE, true);
    const b = footTarget(BASE, false);
    expect(f.x).toBeCloseTo(BOARD.bolts);
    expect(b.x).toBeCloseTo(-BOARD.bolts);
    expect(f.y).toBeCloseTo(BOARD.deckTop);
    expect(BASE.yaw).toBeGreaterThan(0); // chest open toward the way they skate, still facing the camera
    expect(BASE.yaw).toBeLessThan(Math.PI / 2);
  });

  it('ollie pop: the tail strikes the ground while the back wheels stay on it, and the board rises nose first', () => {
    const t = CLIPS.ollie.keys.find((k) => k.pose.boardPitch === 0.58)!.t;
    const p = sample(CLIPS.ollie, t);
    const tail = deckPoint(p, -BOARD.tail);
    expect(tail.y).toBeLessThan(0.02);
    expect(tail.y).toBeGreaterThan(-0.02);
    expect(wheelBottom(p, -BOARD.bolts)).toBeGreaterThan(-0.02);
    expect(deckPoint(p, BOARD.tail).y).toBeGreaterThan(0.4); // nose up
    // the back foot rides the tail down, the front foot is still on the board
    expect(dist(footTarget(p, false), deckPoint(p, p.footBX))).toBeLessThan(1e-6);
    expect(p.footFOn).toBe(1);
  });

  it('ollie: the front foot drags up toward the nose and levels the board at the top', () => {
    const peak = CLIPS.ollie.keys.reduce((a, k) => ((k.pose.boardY ?? 0) > (a.pose.boardY ?? 0) ? k : a));
    const p = sample(CLIPS.ollie, peak.t);
    expect(p.footFX).toBeGreaterThan(BOARD.bolts + 0.05);
    expect(Math.abs(p.boardPitch)).toBeLessThan(0.05);
    expect(p.hipY - footTarget(p, true).y).toBeLessThan(0.6); // knees tucked
  });

  it('kickflip rolls toe edge over toward the heels; heelflip the other way; both feet are off while it turns', () => {
    const kf = sample(CLIPS.kickflip, 0.17);
    const hf = sample(CLIPS.heelflip, 0.17);
    expect(kf.boardRoll).toBeLessThan(-0.5);
    expect(hf.boardRoll).toBeGreaterThan(0.5);
    expect(kf.footFOn + kf.footBOn).toBe(0);
    expect(hf.footFOn + hf.footBOn).toBe(0);
    expect(CLIPS.kickflip.keys[1].pose.footFZ!).toBeLessThan(0); // flicked off the heel side
    expect(CLIPS.heelflip.keys[1].pose.footFZ!).toBeGreaterThan(0); // kicked off the toe side
    // mid-flip the legs split wide over the board: front foot out past the nose, both feet well above the deck
    const mid = sample(CLIPS.kickflip, 0.2);
    expect(mid.footFX).toBeGreaterThan(BOARD.tail);
    expect(mid.footFX - mid.footBX).toBeGreaterThan(1.0);
    expect(Math.min(mid.footFY, mid.footBY) - (mid.boardY + BOARD.deckTop)).toBeGreaterThan(0.25);
    expect(mid.armRRaise).toBeGreaterThan(2.3); // back arm up overhead
    // the back foot catches first
    const catchKey = CLIPS.kickflip.keys.find((k) => k.pose.footBOn === 1)!;
    expect(catchKey.pose.footFOn).toBe(0);
  });

  it('shove-its spin flat backside: the tail swings round behind the heels', () => {
    const p = sample(CLIPS.shuv1, 0.12);
    expect(p.boardYaw).toBeLessThan(0);
    expect(deckPoint(p, -BOARD.tail).z).toBeLessThan(0);
    expect(sample(CLIPS.shuv1, clipLength(CLIPS.shuv1)).boardYaw).toBeCloseTo(-Math.PI);
    expect(sample(CLIPS.shuv2, clipLength(CLIPS.shuv2)).boardYaw).toBeCloseTo(-2 * Math.PI);
  });

  it('after a shove-it the feet land where they were, on the other ends of the board', () => {
    for (const name of ['shuv1', 'fsShuv', 'hardflip', 'varial', 'varialHeel']) {
      const p = sample(CLIPS[name], clipLength(CLIPS[name]));
      expect(Math.abs(Math.abs(p.boardYaw) - Math.PI), name).toBeLessThan(1e-6);
      expect(footTarget(p, true).x, name).toBeGreaterThan(0.2);
      expect(footTarget(p, false).x, name).toBeLessThan(-0.2);
    }
  });

  it('180s turn the skater with the board: they land fakie, front foot trailing, back foot leading', () => {
    for (const name of ['bs180', 'fs180']) {
      const p = sample(CLIPS[name], clipLength(CLIPS[name]));
      expect(Math.abs(p.yaw - BASE.yaw), name).toBeCloseTo(Math.PI);
      expect(footTarget(p, true).x, name).toBeLessThan(-0.2);
      expect(footTarget(p, false).x, name).toBeGreaterThan(0.2);
      expect(p.footFOn + p.footBOn).toBe(2); // feet stay on, it's not a shove-it
    }
    expect(sample(CLIPS.bs180, 0.2).boardYaw).toBeLessThan(0); // backside: the tail swings behind the heels
    expect(sample(CLIPS.fs180, 0.2).boardYaw).toBeGreaterThan(0);
  });

  it('360 flip: a full backside spin and a full kickflip roll together; hardflip: frontside half spin and kickflip roll', () => {
    const tre = sample(CLIPS.tre, clipLength(CLIPS.tre));
    expect(tre.boardYaw).toBeCloseTo(-2 * Math.PI);
    expect(tre.boardRoll).toBeCloseTo(-2 * Math.PI);
    const mid = sample(CLIPS.tre, 0.15);
    expect(mid.boardYaw).toBeLessThan(-1);
    expect(mid.boardRoll).toBeLessThan(-1);
    expect(CLIPS.tre.keys[1].pose.footBZ!).toBeLessThan(0); // scooped behind
    const hard = sample(CLIPS.hardflip, clipLength(CLIPS.hardflip));
    expect(hard.boardYaw).toBeCloseTo(Math.PI);
    expect(hard.boardRoll).toBeCloseTo(-2 * Math.PI);
    expect(sample(CLIPS.hardflip, 0.15).boardPitch).toBeGreaterThan(1); // up on end between the legs
  });

  it('smith: the nose dips toward the camera (the side skated from); feeble: over the far side of the rail', () => {
    const smith = sample(CLIPS.smith, 0);
    expect(deckPoint(smith, BOARD.tail).z).toBeGreaterThan(0.1);
    expect(deckPoint(smith, BOARD.tail).y).toBeLessThan(deckPoint(smith, -BOARD.bolts).y);
    expect(Math.abs(deckPoint(smith, -BOARD.bolts).z)).toBeLessThan(1e-6); // back truck on the rail
    const feeble = sample(CLIPS.feeble, 0);
    expect(deckPoint(feeble, BOARD.tail).z).toBeLessThan(-0.1);
    expect(Math.abs(deckPoint(feeble, -BOARD.bolts).z)).toBeLessThan(1e-6);
    const fiveO = sample(CLIPS.fiveO, 0);
    expect(deckPoint(fiveO, BOARD.tail).y).toBeGreaterThan(deckPoint(fiveO, -BOARD.bolts).y); // nose up
  });

  it('boardslide: board across the rail on its middle, feet either side, chest down the rail', () => {
    const p = sample(CLIPS.grind2, 0);
    expect(p.boardYaw).toBeCloseTo(Math.PI / 2);
    expect(footTarget(p, true).z).toBeLessThan(-0.2);
    expect(footTarget(p, false).z).toBeGreaterThan(0.2);
    expect(p.boardY + BOARD.deckTop - 0.03).toBeCloseTo(0); // deck bottom on the rail
    expect(p.yaw).toBeGreaterThan(1);
  });

  it('frontside boardslide: board across the other way, back leading down the rail', () => {
    const p = sample(CLIPS.fsBoardslide, 0);
    expect(p.boardYaw).toBeCloseTo(-Math.PI / 2);
    expect(footTarget(p, true).z).toBeGreaterThan(0.2); // nose toward the camera
    expect(footTarget(p, false).z).toBeLessThan(-0.2);
    expect(p.boardY + BOARD.deckTop - 0.03).toBeCloseTo(0);
    expect(p.yaw).toBeLessThan(-1); // chest turned away from the way he slides
    expect(p.head).toBeGreaterThan(0.5); // looking back down the rail
  });

  it('boneless (car hops): front foot steps off the board onto the roof, then back on, with a switch twin', () => {
    expect(CLIPS.boneless.loop).toBe(false);
    expect(sample(CLIPS.boneless, 0.12).footFOn).toBe(0);
    expect(sample(CLIPS.boneless, 0.36).footFOn).toBe(1);
    expect(CLIPS.switchBoneless).toBeTruthy();
  });

  it('nollie: the ollie popped off the nose, with a fakie ollie twin; nose clips pop out with it', () => {
    const o = sample(CLIPS.ollie, 0.27);
    const n = sample(CLIPS.nollie, 0.27);
    expect(n.boardPitch).toBeCloseTo(-o.boardPitch, 5);
    expect(n.boardPivot).toBeCloseTo(-o.boardPivot, 5);
    expect(n.footFX).toBeCloseTo(-o.footBX, 5);
    expect(CLIPS.switchNollie).toBeTruthy();
    expect(['crooked', 'noseGrind', 'noseManual', 'switchCrooked', 'switchNoseManual'].every(onNose)).toBe(true);
    expect(['fiveO', 'manual', 'grind1', 'switchFiveO'].some(onNose)).toBe(false);
  });

  it('switch twins: every clip but the held poses has one, mirrored along the board', () => {
    for (const name of ['push', 'ride', 'ollie', 'kickflip', 'grind1', 'grind2', 'fiveO', 'manual', 'land', 'bs180']) {
      expect(CLIPS[switchName(name)], name).toBeTruthy();
    }
    expect(CLIPS.switchIdle).toBeUndefined();
    const p = sample(CLIPS.ride, 0);
    expect(mirrorPose(mirrorPose(p))).toEqual(p);
    // the left foot stays on the left (+x) of the board, so the legs never cross
    const sw = sample(CLIPS.switchRide, 0);
    expect(footTarget(sw, true).x).toBeGreaterThan(footTarget(sw, false).x);
    expect(sw.yaw).toBeCloseTo(-p.yaw);
    // the pushing foot strokes the other way: toward +x, behind you when the rig is turned round
    const a = sample(CLIPS.switchPush, 0.21);
    const b = sample(CLIPS.switchPush, 0.56);
    expect(a.footFOn).toBeLessThan(0.5);
    expect(b.footFX).toBeGreaterThan(a.footFX);
  });

  it('blends between clips take the short way round for spun boards', () => {
    const landed = { ...BASE, boardRoll: -2 * Math.PI, boardYaw: -Math.PI };
    const half = mix(landed, BASE, 0.5);
    expect(half.boardRoll).toBeCloseTo(0);
    expect(half.boardYaw).toBeCloseTo(0);
  });

  it('loops wrap and one-shots hold their last key', () => {
    expect(sample(CLIPS.push, clipLength(CLIPS.push) + 0.1).footBX).toBeCloseTo(sample(CLIPS.push, 0.1).footBX);
    expect(sample(CLIPS.ollie, 99).boardY).toBeCloseTo(CLIPS.ollie.keys.at(-1)!.pose.boardY!);
  });
});

describe('leg IK', () => {
  const hip = { x: 0, y: 0.9, z: 0 };
  it('keeps the bone lengths and bends toward the pole', () => {
    const ankle = { x: 0.1, y: 0.3, z: 0 };
    const k = kneePoint(hip, ankle, 0.4, 0.4, { x: 0, y: 0, z: 1 });
    expect(dist(k, hip)).toBeCloseTo(0.4);
    expect(dist(k, ankle)).toBeCloseTo(0.4);
    expect(k.z).toBeGreaterThan(0.1);
  });
  it('straightens when the foot is out of reach', () => {
    const k = kneePoint(hip, { x: 0, y: -1, z: 0 }, 0.4, 0.4, { x: 0, y: 0, z: 1 });
    expect(k.x).toBeCloseTo(0);
    expect(k.z).toBeCloseTo(0, 1);
    expect(k.y).toBeCloseTo(0.5);
  });
  it('reaches every foot target the clips use without over-stretching much', () => {
    for (const [name, clip] of Object.entries(CLIPS)) {
      if (name === 'slam' || name === 'freefall') continue;
      for (let t = 0; t <= clipLength(clip); t += 0.02) {
        const p = sample(clip, t);
        for (const front of [true, false]) {
          const f = footTarget(p, front);
          const dx = f.x - p.hipX - (front ? 0.11 : -0.11) * Math.cos(p.yaw);
          const reach = Math.hypot(dx, p.hipY - 0.04 - (f.y + 0.075), f.z);
          expect(reach, `${name} t=${t.toFixed(2)} ${front ? 'front' : 'back'}`).toBeLessThan(0.84);
        }
      }
    }
  });
});
