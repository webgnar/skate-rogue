# Design

## Context

The repo has only docs and OpenSpec so far. Source material: QFSHIVE (GameMaker; physics in
`scripts/calc_movement`, `jumped`, `check_grind`, `player_grinding_state`, `player_rail_state`; pieces and
generator in `scripts/survivor`; Chicago tiles in `sprites/s_tile_city_textures`) and excaliburSkate (Lou Gnar
sprite sheets in `public/images`, 66 x 75 px frames). See proposal.md for why.

## Goals / Non-Goals

**Goals:** feel. The physics must be easy to tune (all numbers in one constants file) and testable headless.

**Non-Goals:** final art, the rigged skater, audio, the traffic director, Heat, boons, forks. No reachability
validator yet (the QFS pieces were already designed to be clearable at walking speed; auto-run is faster, so
gaps get easier, not harder).

## Decisions

- **QFS units for physics.** Simulation runs in pixels and pixels per frame at 60 Hz with 32 px tiles, exactly
  QFS's units, so QFS numbers (gravity 0.25, ollie -5, release cut /2.5, rail clamp 9, rail minimum 1.5, carry
  bleed 0.15) port without conversion. Render divides by 32 (1 world unit = 1 tile) and flips y.
  Alternative: SI units. Rejected: every QFS number would need converting and re-tuning.
- **Own kinematic controller, no physics engine.** Gameplay is 2D; one-way tiles, rails and car roofs are
  simple sweeps against the grid. Matches QFS and Lou Gnar, keeps it deterministic.
- **Pure modules.** `src/physics` and `src/gen` import nothing from Three.js or the DOM, so vitest can run them.
  `src/render` reads simulation state and draws; `src/game` wires the fixed-step loop and input.
- **Fixed step with interpolation.** An accumulator steps physics at 1/60 s (at most 5 steps per frame); the
  renderer interpolates between the last two states.
- **Auto-run speed.** Base speed 3.5 px/frame (QFS walks at 2; a runner needs more). Grind cap 6, curved rail
  cap 9. Extra speed from rails is "carry" that lifts the cap and bleeds 0.15/frame on the ground (QFS `rail_carry`).
- **Curved rails.** Quadratic curve between the two `r` points, control point at the midpoint pushed down by the
  piece's `rail_curve` (positive sags, negative arches; default 32), as QFS's `o_grind_rail`. Sampled into a
  polyline with arc length so position and angle at distance `d` are cheap.
- **Cars.** New piece char `c` = a parked car, 2 tiles wide: roof is a car-hop surface, side contact while
  grounded or low is a slam. They are static in M0.
- **New skate pieces.** A few pieces with `=` flat rails and `c` cars join the QFS library so M0 exercises grinds
  and car-hops on every floor. `E`, `F`, `C` and `^` from QFS are ignored in M0 (no enemies or chests) except `^`,
  drawn as broken glass and treated as a slam.
- **Textures at runtime.** The 480 x 480 Chicago tileset is copied to `public/` and surfaces are composed into
  canvases per floor (road strip, facade, roof cap, ledge, water), then used as `CanvasTexture` with nearest
  filtering. No offline atlas tooling yet.
- **Skater as a camera-facing sprite plane** with Lou Gnar's sheets. Swapped for the rigged model in M3.
- **Hosting for testing:** a static Vite build (`base: './'`) that can be opened from any static host.

## Risks / Trade-offs

- [QFS pieces assume walking speed and free movement] → Pieces were all one-way with no walls, so auto-run works;
  floors that feel bad get new pieces in M1 with the validator.
- [Sprite plane looks flat in 3D] → Acceptable for a feel test; the rig replaces it.
- [Mobile browser input latency] → Act on `pointerdown` (not click), plus a 100 ms press buffer.

## Open Questions

- Exact base speed and gravity feel on a phone: tune after the first playtest.
