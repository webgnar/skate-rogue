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
  carryBleed: 0.15, // QFS rail_carry bleeds this much per frame on the ground
  grindSpeed: 5, // flat rails pull you up to this (QFS max_speed_grind is 2x walking)
  grindAccel: 0.08,
  grindMin: 3.5,
  railGravMult: 1.6, // QFS player_rail_state
  railMax: 9, // QFS clamp
  railMin: 1.5, // QFS "always keep rolling"
  railIgnoreFrames: 30, // QFS rail_ignore_t
  carHop: -4.2, // Lou Gnar UFO bounce ratio: -750 / -900 of an ollie
  slamSpeed: 0.5, // speed drops to half of base
  slamFrames: 36, // ~0.6 s to get back to full speed
  bufferFrames: 6, // 100 ms input buffer
  coyoteFrames: 5,
  width: 16,
  height: 48,
  // boons
  floatyFrames: 24, // Floaty Flip
  frenzyStep: 0.1, // Feeble Frenzy
  pressureFrames: 15, // Pressure Flip kicks in after holding this long
  ghostTiles: 4, // Ghost Rail
  ghostFrames: 120,
  bailDepth: 24, // this far below the street surface and you're in the canal
} as const;
