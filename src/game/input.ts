// The one button: a touch anywhere, the primary mouse button, Space or Up. Acts on press (not click) for low latency,
// and blocks scrolling, zooming, text selection and the long-press menu.
import type { StepInput } from '../physics/skater';

export class OneButton {
  private down = 0; // pointers and keys currently holding the button
  private presses = 0; // presses not yet handed to a physics step
  lastTarget: Element | null = null; // what the last pointer press landed on (boon cards)

  constructor(target: HTMLElement) {
    const press = () => {
      this.down++;
      this.presses++;
    };
    const release = () => {
      this.down = Math.max(0, this.down - 1);
    };
    target.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      this.lastTarget = e.target instanceof Element ? e.target : null;
      target.setPointerCapture?.(e.pointerId);
      press();
    });
    for (const type of ['pointerup', 'pointercancel'] as const) {
      target.addEventListener(type, (e) => {
        e.preventDefault();
        release();
      });
    }
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
    window.addEventListener('blur', () => (this.down = 0));
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
