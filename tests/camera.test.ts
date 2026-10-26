import { describe, expect, it } from 'vitest';
import { CamDrift, LOU_CAM, LouZoom, PHONE_CAM, framing, viewHeight } from '../src/render/camera';

const run = (z: LouZoom, secs: number, mode: 'roll' | 'grind' | 'air' = 'roll') => {
  for (let i = 0; i < Math.round(secs * 60); i++) z.update(1 / 60, mode);
};

describe("Lou Gnar's camera", () => {
  it('punches in on a trick, holds for 0.7 s, then eases back out', () => {
    const z = new LouZoom();
    z.trick();
    run(z, 0.69, 'air');
    expect(z.zoom).toBeGreaterThan(1.33); // eased in fast (rate 3/s)
    run(z, 2.5, 'roll');
    expect(z.zoom).toBeGreaterThan(1.0);
    expect(z.zoom).toBeLessThan(1.04); // and out slower (rate 1.5/s)
  });

  it('eases in faster than it eases out', () => {
    const a = new LouZoom();
    a.trick();
    run(a, 0.3, 'air');
    const inBy = a.zoom - 1;
    const b = new LouZoom();
    b.trick();
    run(b, 1.5, 'air');
    const top = b.zoom;
    run(b, 0.3, 'roll');
    expect(inBy).toBeGreaterThan(top - b.zoom);
  });

  it('holds 1.3x while grinding, and a trick off the end still punches to 1.4x', () => {
    const z = new LouZoom();
    run(z, 3, 'grind');
    expect(z.zoom).toBeCloseTo(LOU_CAM.grindZoom, 2);
    z.trick();
    run(z, 0.6, 'air');
    expect(z.zoom).toBeGreaterThan(LOU_CAM.grindZoom + 0.05);
    run(z, 4, 'roll');
    expect(z.zoom).toBeCloseTo(1, 2);
  });

  it('a trick that lands on a grind settles to the grind zoom', () => {
    const z = new LouZoom();
    z.trick();
    run(z, 0.3, 'air');
    run(z, 4, 'grind');
    expect(z.zoom).toBeCloseTo(LOU_CAM.grindZoom, 2);
  });

  it('never shows less than the 800 x 600 box', () => {
    expect(viewHeight(16 / 9)).toBe(LOU_CAM.viewH); // wide: full height, more street to the sides
    expect(viewHeight(4 / 3)).toBe(LOU_CAM.viewH);
    expect(viewHeight(1) * 1).toBeCloseTo(LOU_CAM.viewH * LOU_CAM.viewAspect); // narrow: full width
  });
});

describe('phone framing', () => {
  it('frames phones much tighter than desktop, both ways round', () => {
    expect(framing(1280, 720).viewH).toBe(LOU_CAM.viewH);
    expect(framing(812, 375).viewH).toBe(PHONE_CAM.landscapeH);
    const up = framing(375, 812);
    expect(up.viewH * (375 / 812)).toBeCloseTo(PHONE_CAM.portraitW); // shows portraitW tiles across
    expect(up.viewH).toBeLessThan(viewHeight(375 / 812) * 0.6); // the old frame showed ~46 tiles of height
    expect(up.fov).toBeGreaterThan(framing(1280, 720).fov); // and a wider lens
  });

  it('backs off in big air and at speed, and comes back in on the ground', () => {
    const d = new CamDrift();
    for (let i = 0; i < 90; i++) d.update(1 / 60, 'air', 0);
    expect(d.pull).toBeLessThan(0.95);
    for (let i = 0; i < 180; i++) d.update(1 / 60, 'roll', 0);
    expect(d.pull).toBeGreaterThan(0.99);
    for (let i = 0; i < 180; i++) d.update(1 / 60, 'roll', 1);
    expect(d.pull).toBeLessThan(0.9);
    expect(d.fovAdd).toBeGreaterThan(5);
  });

  it('a landing kick dies off in well under a second', () => {
    const d = new CamDrift();
    d.land(1);
    for (let i = 0; i < 30; i++) d.update(1 / 60, 'roll', 0);
    expect(d.kick).toBeLessThan(0.02);
  });
});

describe('fisheye lens', () => {
  it('k 0 is flat; the corners stay put and the middle swells as k rises', async () => {
    const { lensSource, lensSwell, lensWiden } = await import('../src/render/lens');
    expect(lensSource(0, 1.2, 0.6, 0.5, 0.3)).toEqual([0.6, 0.18]);
    const [cx, cy] = lensSource(1, 1.2, 0.6, 1, 1);
    expect(cx).toBeCloseTo(1.2);
    expect(cy).toBeCloseTo(0.6);
    expect(lensSwell(0, 1.2, 0.6)).toBe(1);
    expect(lensSwell(1, 1.2, 0.6)).toBeGreaterThan(1.2);
    expect(lensWiden(1, 0.5, 2)).toBeGreaterThan(0.5); // drawn wider so the middle keeps its size
  });
});

describe('camera springs', () => {
  it('glide to a jumped target with no snap, settle, and stay stable on a slow frame', async () => {
    const { Spring } = await import('../src/render/camera');
    const s = new Spring(1);
    let last = 1;
    let maxStep = 0;
    for (let i = 0; i < 60; i++) {
      const x = s.step(1.5, 9, 1 / 60);
      maxStep = Math.max(maxStep, Math.abs(x - last));
      last = x;
    }
    expect(maxStep).toBeLessThan(0.05); // a 0.5 jump spread over many frames
    expect(s.x).toBeGreaterThan(1.48);
    expect(s.x).toBeLessThanOrEqual(1.5 + 1e-3); // critically damped: no overshoot
    s.step(1, 9, 0.25);
    expect(Number.isFinite(s.x) && s.x > 0.9 && s.x < 1.5).toBe(true);
  });
});
