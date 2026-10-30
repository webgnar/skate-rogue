// Where the board is in the air (zack, 2026-10-25: "where the board is visually, should match the collision"). The
// clips lift the board off the street with the knees tucked (an ollie's peak about 18 px, a flip about 11), so in the
// air the board, not the feet under it, is what lands on a ledge, a roof or a rail. Read from the same clips the rig
// plays (src/render/poses.ts, animation editor edits included), on the same events, at 60 Hz.
import { CLIPS, clipLength, sample, type Clip } from '../render/poses';
import { TILE } from './constants';

const FADE_FRAMES = 5; // the rig's 0.08 s crossfade
export const RIG_SCALE = 1.38; // the rig's scale on the poses (skater-rig.ts SCALE): a pose unit is this many tiles

export class Tuck {
  lift = 0; // px the board is above the feet now
  prev = 0; // ...and a step ago
  private table: number[] | null = null; // the playing clip's lift, a frame at a time
  private f = 0; // frames into it
  private fade = 0; // px a frame the lift eases out by once its clip is over (the rig crossfades to the air clip)
  private from = 0; // the lift a new clip crossfades from
  private blend = 0; // frames into that crossfade

  // a pop, hop, kicker or flip: the rig starts that clip, crossfading from where the board is. The lift only moves
  // in step(), before the skater does, so a landing always sees the board where it is drawn
  start(name: string): void {
    this.table = liftTable(CLIPS[name] ?? CLIPS.ollie);
    this.f = -1;
    this.from = this.lift;
    this.blend = 0;
  }

  // one step, before the skater moves: in the air the clip plays on; on the ground the board is under the feet
  step(air: boolean): void {
    this.prev = this.lift;
    if (!air) {
      this.table = null;
      this.lift = 0;
      return;
    }
    const t = this.table;
    if (t && ++this.f < t.length) {
      const k = Math.min(1, ++this.blend / FADE_FRAMES);
      this.lift = this.from + (t[this.f] - this.from) * k;
      this.fade = this.lift / FADE_FRAMES;
    } else this.lift = Math.max(0, this.lift - this.fade);
  }

  // a copy to step ahead in the air, with no more presses or with a flip thrown now (the bots look ahead with it:
  // what lands is the board)
  ahead(flip = false): Tuck {
    const t = Object.assign(new Tuck(), this);
    if (flip) t.start('kickflip');
    return t;
  }
}

// a clip's board lift a frame at a time, px (sampled once per clip: the sim steps it thousands of times a run)
const tables = new WeakMap<Clip, number[]>();
function liftTable(c: Clip): number[] {
  let t = tables.get(c);
  if (!t) {
    t = Array.from({ length: Math.floor(clipLength(c) * 60) + 1 }, (_, f) => Math.max(0, sample(c, f / 60).boardY) * RIG_SCALE * TILE);
    tables.set(c, t);
  }
  return t;
}
