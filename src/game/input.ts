// The one button: a touch anywhere, the primary mouse button, Space or Up. Acts on press (not click) for low latency,
// and blocks scrolling, zooming, text selection and the long-press menu. Two fingers pinch the camera instead.
import type { StepInput } from '../physics/skater';

export class OneButton {
  private down = 0; // pointers and keys currently holding the button
  private presses = 0; // presses not yet handed to a physics step
  lastTarget: Element | null = null; // what the last pointer press landed on (boon cards)

  // two fingers on the street pinch the camera: called with how much the gap between them grew since the last call
  // (over 1: spreading, zoom in), and done when a finger lifts. A trackpad pinch (ctrl + wheel) does the same
  onPinch: ((scale: number, done: boolean) => void) | null = null;
  private readonly touches = new Map<number, { x: number; y: number; held: boolean }>();
  private gap = 0; // px between the two pinching fingers, 0 when not pinching

  constructor(target: HTMLElement) {
    const press = () => {
      this.down++;
      this.presses++;
    };
    const release = () => {
      this.down = Math.max(0, this.down - 1);
    };
    const spread = () => {
      const [a, b] = [...this.touches.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    target.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      this.lastTarget = e.target instanceof Element ? e.target : null;
      target.setPointerCapture?.(e.pointerId);
      if (e.pointerType === 'touch') {
        //a second finger starts a pinch, not a press, and lets go of the first finger's hold
        if (this.touches.size === 1 && this.onPinch) {
          for (const t of this.touches.values()) if (t.held) (t.held = false), release();
          this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, held: false });
          this.gap = Math.max(1, spread());
          return;
        }
        this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, held: this.gap === 0 });
        if (this.gap) return;
      }
      press();
    });
    target.addEventListener('pointermove', (e) => {
      const t = this.touches.get(e.pointerId);
      if (!t) return;
      t.x = e.clientX;
      t.y = e.clientY;
      if (!this.gap || this.touches.size !== 2) return;
      const gap = Math.max(1, spread());
      this.onPinch?.(gap / this.gap, false);
      this.gap = gap;
    });
    for (const type of ['pointerup', 'pointercancel'] as const) {
      target.addEventListener(type, (e) => {
        e.preventDefault();
        const t = this.touches.get(e.pointerId);
        this.touches.delete(e.pointerId);
        if (t && !t.held) {
          //a pinching finger lifted: the pinch is over (the other finger holds nothing until it lifts too)
          if (this.gap && this.touches.size < 2) {
            this.gap = this.touches.size ? -1 : 0;
            this.onPinch?.(1, true);
          }
          if (!this.touches.size) this.gap = 0;
          return;
        }
        release();
      });
    }
    target.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey || !this.onPinch) return;
        e.preventDefault();
        this.onPinch(Math.exp(-e.deltaY * 0.01), true);
      },
      { passive: false },
    );
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
      e.preventDefault();
      this.lastTarget = null;
      if (!e.repeat) press();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') release();
    });
    window.addEventListener('blur', () => {
      this.down = 0;
      this.touches.clear();
      this.gap = 0;
    });
  }

  // the input for one physics step: a press is handed out once
  sample(): StepInput {
    const pressed = this.presses > 0;
    if (pressed) this.presses--;
    return { pressed, held: this.down > 0 || pressed };
  }

  // drop presses made while the street was paused
  clear(): void {
    this.presses = 0;
  }

  // a press the game used outside physics (menus and restarting)
  takePress(): boolean {
    if (this.presses === 0) return false;
    this.presses = 0;
    return true;
  }
}
