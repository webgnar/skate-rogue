## Why

zack (Oct 24, 2026): the legs should be IK rigged so they absorb slopes as the skater rides up them, with the torso
staying centred. Until now the whole skater tilted with a bank or rail, like a sprite turned on its side. The GDD's
deck shop also unlocks the QFS skaters (Webster, Keanu, Roxy, Goldie), who had no models.

## What Changes

- **Slope legs.** On the skinned model, the ground angle tilts only the board, about the wheels' contact under the
  rig. The feet stay planted on the deck, and each leg re-aims with two-bone IK from the hip, on top of whatever
  clip is playing (Blender action or code clip). The hips sink a little with the slope so the downhill leg still
  reaches, and the torso stays upright over the board. Crossfades start from the clip's own pose, before the slope.
- **Physics feel hook.** When the sim has `skater.feel` (the physics feel thread), `squash` sinks the hips (the
  knees bend through the IK), and `lean` and `wobble` rock the body over the planted feet. The game passes
  `feel.pitch` as the board angle.
- **QFS skaters.** `art/skaters.py` builds Webster, Keanu, Roxy and Goldie on Lou's armature and bind pose, so they
  play his clips from `lou-gnar.glb`. `?skater=<name>` picks one until the deck shop unlocks them.

## Impact

- `src/render/skater-rig.ts` (absorb, aim, setInRig; `SkaterRig.create(base, skater)`), `src/main.ts`
- `art/skaters.py`, `public/models/{webster,keanu,roxy,goldie}.glb`
- The built-in fallback skater (no GLB) still tilts as a whole.
