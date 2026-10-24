// Fixed-step accumulator: physics always advances in 1/60 s steps, whatever the screen's refresh rate.
import { STEP } from '../physics/constants';

export class FixedStep {
  private acc = 0;
  alpha = 0; // how far between the last two steps the screen is, for interpolation

  advance(dt: number, step: () => void, maxSteps = 5): number {
    //count in microseconds so 1/120 + 1/120 lands exactly on 1/60
    this.acc += Math.round(dt * 1e6);
    const stepUs = Math.round(STEP * 1e6);
    let n = 0;
    while (this.acc >= stepUs - 1 && n < maxSteps) {
      step();
      this.acc -= stepUs;
      n++;
    }
    if (n === maxSteps) this.acc = Math.min(this.acc, stepUs);
    this.acc = Math.max(this.acc, 0);
    this.alpha = this.acc / stepUs;
    return n;
  }
}
