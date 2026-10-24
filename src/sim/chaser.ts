// Act 3's escape (GDD: How a run ends): the district's chaser runs you down a long street. Logged overnight
// (2026-10-24, recommended on a card to zack): one chase with a look per district: a tidal wave in Atlantis, a
// chariot in Greece, a pack of guards in the museum. It's always right behind you, on screen. Clean skating holds
// it off and slowly opens the gap; every slam lets it close in. Three slams close together and it has you.
// It tracks slams rather than speed, so a slow uphill rail or a climb never counts against you. Pure, 60 Hz.
import { TILE } from '../physics/constants';
import type { Skater, SkaterEvent } from '../physics/skater';

export const CHASER = {
  startGap: 7 * TILE, // how far behind it comes in
  maxGap: 8 * TILE, // the most it drops back
  slam: 2.5 * TILE, // a slam (or a tuck) lets it close this much
  recover: 0.6 * TILE, // per second of skating without a slam
  catchAt: TILE, // this close: caught
  warnAt: 3.5 * TILE, // the HUD warns from this close
};

export class Chaser {
  gap: number = CHASER.startGap; // px behind the skater
  x: number;
  caught = false;

  constructor(
    readonly from: number, // it joins the chase when the skater passes this x
    startX: number,
  ) {
    this.x = startX - CHASER.startGap;
  }

  step(sk: Skater, events: readonly SkaterEvent[]): void {
    if (sk.x >= this.from && !this.caught) {
      const hits = events.filter((e) => e.type === 'slam' || e.type === 'tuck').length;
      this.gap = hits ? this.gap - hits * CHASER.slam : Math.min(CHASER.maxGap, this.gap + CHASER.recover / 60);
      if (this.gap <= CHASER.catchAt) this.caught = true;
    }
    this.x = sk.x - this.gap;
  }
}
