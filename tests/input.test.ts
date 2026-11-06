// The one button hands each press to one physics step, and only while it's fresh: taps made while the street didn't
// step (a slam's hit-stop, a long frame) fired afterwards as a run of flips with no click (zack, 2026-11-06)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OneButton, PRESS_QUEUE, PRESS_TTL_MS } from '../src/game/input';

const g = globalThis as Record<string, unknown>;
let win: EventTarget;
beforeAll(() => {
  win = new EventTarget();
  g.window = win;
});
afterAll(() => {
  delete g.window;
});

function space(): void {
  win.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code: 'Space', repeat: false }));
  win.dispatchEvent(Object.assign(new Event('keyup'), { code: 'Space' }));
}

describe('the one button', () => {
  it('hands a fresh press to the next step, once', () => {
    const b = new OneButton(new EventTarget() as unknown as HTMLElement);
    space();
    const now = performance.now();
    expect(b.sample(now).pressed).toBe(true);
    expect(b.sample(now).pressed).toBe(false);
  });

  it('drops a press no step took in time', () => {
    const b = new OneButton(new EventTarget() as unknown as HTMLElement);
    space();
    expect(b.sample(performance.now() + PRESS_TTL_MS + 50).pressed).toBe(false);
  });

  it('mashing while the street is held keeps only the last few presses', () => {
    const b = new OneButton(new EventTarget() as unknown as HTMLElement);
    for (let i = 0; i < 6; i++) space();
    const now = performance.now();
    let n = 0;
    for (let i = 0; i < 10; i++) if (b.sample(now).pressed) n++;
    expect(n).toBe(PRESS_QUEUE);
  });
});
