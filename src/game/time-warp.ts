// Hit-stop and slow motion: a freeze, then a slow start that eases back to full speed. The game multiplies its
// frame time by `scale`, so physics still steps at a fixed 60 Hz, just fewer steps per real second.
export class TimeWarp {
  private freeze = 0;
  private slowT = 0;
  private slowLen = 0;
  private slowFrom = 1;

  // freeze for `freeze` s, then start at `slow` x speed, hold it for `hold` s and ease to 1x over `ease` s
  hit(freeze: number, slow: number, ease: number, hold = 0): void {
    this.freeze = Math.max(this.freeze, freeze);
    this.slowFrom = Math.min(slow, this.scaleAfterFreeze());
    this.slowLen = ease;
    this.slowT = ease + hold;
  }

  get scale(): number {
    return this.freeze > 0 ? 0 : this.scaleAfterFreeze();
  }

  get frozen(): boolean {
    return this.freeze > 0;
  }

  private scaleAfterFreeze(): number {
    if (this.slowT <= 0) return 1;
    if (this.slowT > this.slowLen) return this.slowFrom; // still holding
    const k = 1 - this.slowT / this.slowLen; // 0 at the start of the slow-mo, 1 at the end
    return this.slowFrom + (1 - this.slowFrom) * k * k;
  }

  // advance by real seconds
  update(dt: number): void {
    if (this.freeze > 0) {
      const spill = dt - this.freeze;
      this.freeze = Math.max(0, this.freeze - dt);
      if (spill > 0) this.slowT = Math.max(0, this.slowT - spill);
    } else {
      this.slowT = Math.max(0, this.slowT - dt);
    }
  }

  reset(): void {
    this.freeze = 0;
    this.slowT = 0;
  }
}
