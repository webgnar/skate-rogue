// The 30 fps setting (FX.fps; perf thread, zack 2026-11-03: Low Power Mode held the game to 30 and it "runs
// smoother"). The page still asks for every frame the screen gives, and the game runs only on those a 30th of a
// second after the last one it ran: every second frame of a 60 Hz screen, every fourth of a 120 Hz one. The slack
// lets a frame that turns up a few ms early count (the screen's timestamps wobble), so the steps stay even.
export const FRAME_SLACK_MS = 4;

// should the game run a frame at `now` (ms), its last one at `last`, held to `fps`?
export function frameDue(now: number, last: number, fps: number): boolean {
  if (fps >= 60) return true;
  return now - last >= 1000 / fps - FRAME_SLACK_MS;
}
