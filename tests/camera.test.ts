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
