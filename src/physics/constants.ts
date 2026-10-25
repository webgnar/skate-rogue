// Every tunable physics number in one place. Units are Quest For Stoken's: pixels and frames at 60 Hz, 32 px tiles.
// Where a value comes from QFS or Lou Gnar, the source is named.
export const TILE = 32;
export const STEP = 1 / 60;

export const PHYS = {
  grav: 0.25, // QFS global.grav
  maxFall: 10,
  ollie: -5, // QFS jump_spd
  trick: -5, // QFS: the second jump is as strong as the first
  jumpCut: 2.5, // QFS jump_dampner: let go while rising -> vsp = max(vsp, ollie / 2.5)
  jumps: 2, // QFS jumps_initial
  baseSpeed: 3.5, // auto-run (QFS walks at 2; a runner needs more)
  accel: 0.15,
  // speed from rails fades on the ground: this share of the extra speed per frame (about half gone in 1 s,
  // mostly gone in 4 s), never slower than carryBleedMin. QFS bled a flat 0.15/frame, which felt abrupt.
  carryDecay: 0.012,
  carryBleedMin: 0.01,
  grindSpeed: 5, // flat rails pull you up to this (QFS max_speed_grind is 2x walking)
  grindAccel: 0.08,
  grindMin: 3.5,
  railGravMult: 1.6, // QFS player_rail_state
  railMax: 9, // QFS clamp
  railMin: 1.5, // QFS "always keep rolling"
  railIgnoreFrames: 30, // QFS rail_ignore_t
  carHop: -4.2, // Lou Gnar UFO bounce ratio: -750 / -900 of an ollie
  // kickers (a box truck's tailgate): a bigger pop than an ollie, and a bomb, QFS's dash as a burst of speed that
  // bleeds off like rail speed
  kickerPop: -6.6, // about 87 px of air, over a 64 px truck box
  bombSpeed: 6.5,
  tailgateLip: 14, // the tailgate's top edge, where you leave it
  tuckBounce: -8, // Tuck and Roll: out of a gap, about 2 tiles over the street
  slingshotMax: 12, // px/frame: the most a Slingshot launch reaches
  slamSpeed: 0.5, // speed drops to half of base
  slamFrames: 36, // ~0.6 s to get back to full speed
  bufferFrames: 6, // 100 ms input buffer
  coyoteFrames: 5,
  width: 30, // the board's length, nose to tail (zack, 2026-10-25): what cars, drones and props hit
  height: 48,
  // boons
  floatyFrames: 24, // Floaty Flip
  frenzyStep: 0.1, // Feeble Frenzy
  pressureFrames: 15, // Pressure Flip kicks in after holding this long
  ghostTiles: 4, // Ghost Rail
  ghostFrames: 120,
  wobbleOver: 1.3, // Speed Wobbles: land faster than this times cruising speed and you slam
  rocketPop: 1.5, // Rocket Grind: an ollie off a fast grind pops this much harder
  skyLineDrop: 6, // Sky Line: the ghost rail sits this far under your feet
  skyLineTiles: 7, // and runs this far ahead, past where a flip comes back down
  crumbleFrames: 24, // Greece's ruins: a ledge you're on falls this long after you land (0.4 s, about 2.6 tiles of rolling)
  bailDepth: 24, // this far below the street surface and you're in the canal
} as const;
