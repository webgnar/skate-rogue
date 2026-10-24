# Design

## Time warp

`TimeWarp` is pure: `hit(freeze, slow, ease)` sets a freeze (scale 0) and then a slow-motion start scale that
eases back to 1. `Game.frame` multiplies its frame time by `warp.scale` before the fixed step, so physics stays a
fixed 60 Hz and only the rate changes. A slam uses 0.09 s of freeze, then 0.3x easing to 1x over 0.5 s.
Effects (particles, burst, camera) run on the warped time too, so the whole moment slows down together, except
the camera punch, which uses real time so the punch still reads during the freeze.

## Particles

One `THREE.Points` with a fixed pool of 256 and CPU-side velocity, life and drag. Attributes: position, colour,
size, alpha. A small shader draws square pixels (matching the QFS pixel art) with size attenuation. Spawning when
the pool is full overwrites the oldest particle. Kinds: spark (bright, gravity, short), dust (grows, slows, fades),
debris (chunky, gravity, a bounce on the ground height it was spawned at).

## Focus lines

A camera-facing quad in the front pass centred on the skater, drawn with a shader: radial black wedges whose
inner radius jitters each frame, transparent near the skater. Drawn only while active (about 0.3 s).

## Sound words

A canvas texture per word (chunky letters, yellow fill, red drop shadow, thick black outline) on a sprite in the
front pass. It pops (scale 0 to 1.3 to 1), tilts, drifts up and fades. Textures are built once and cached.

## Camera punch

`StreetView.punch(amount)` pulls the camera closer and rolls it a few degrees, decaying with real time.
