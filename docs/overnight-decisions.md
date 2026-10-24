# Overnight decisions (2026-10-24)

zack asked for work to keep going overnight. Where a design question came up, I went with my recommendation
and listed it here for review. Any of these can be flipped in the morning.

## Effects thread: fx6 rain puddles

- **Rain intensity:** a rainy floor is a drizzle 30% of the time, rain 45%, a downpour 25%. Drizzle has fewer
  streaks and half-size puddles; a downpour has bigger puddles and a soft lightning glow every 9 to 17 s (one
  slow fade, never a strobe).
- **Where puddles go:** the street, flat roofs and the overpass, about one per 9 tiles, kept 1.2 tiles clear of
  surface ends, parked cars and glass. Never on rails, ledges, stairs or banks.
- **Puddles are visual only.** No slide or grip change: that is gameplay and belongs to the gameplay thread
  (the GDD's "rain slightly lowers grip" is still open there).
- **SPLSH!** only on a big drop into a puddle; normal landings in water get a smaller crown of drops.
- **Deferred:** the wet toon look (glinting ledge tops), drips off ledges and splashes on the helmet. They need a
  shader patch to every toon material. Left for after the night city work, and still listed in fx6's tasks.

## Effects thread: fx7 night city

- **Lit windows come from the facade tiles themselves.** Each QFS window tile gets a seeded mask; about 42% of
  window cells light, in warm lamp tones with the odd blue TV. They glow with the mood's neon level, so they fade in
  at golden hour and are full at night. One emissive map per facade, no extra draws.
- **Street lamps every 8 tiles on the sidewalk and every 7 on wide roofs.** The cone and the ground pool are additive
  fakes (no real lights), instanced: four draws for every lamp on the floor.
- **Every third lamp carries a Flock camera** with a red eye that turns to follow Lou when he is within 10 tiles.
  This is the "surveillance city" from the GDD, purely visual.
- **Three AI billboards a floor**, with slogans like "COMPLIANCE IS FREEDOM" and "REPORT ALL SKATERS". They turn
  slightly toward Lou and brighten and pulse with Heat (a slow pulse, not a strobe).
- **Car headlights** are an additive cone and pool on each car, shown from dusk. Oncoming cars light the road ahead of
  Lou, which telegraphs them at night. Brake light trails, neon signs and a visor highlight on Lou are left for later.

## Gameplay thread (acts, escapes, GDD build-out)

- **Acts and escapes (PR: acts, escapes and a win).** A run is 5 acts of 3 floors. After each act's third floor
  (after its boon pick) comes the act's escape, then the road picked at that floor's fork (so a shop comes after
  the escape). The escape is not a floor: the floor number stays, the HUD says `ACT n ESCAPE`.
- **Escape floor shape.** 5 street pieces at the act's depth with rush-hour traffic and Heat starting at 30, then
  the set piece on flat street, then the act gate. No fork, no pickups beyond the street's own.
- **Roadblock set piece (act 1).** Parked car, CTA bus (72 px roof: more than a plain ollie, less than an ollie
  plus flip), a line of 3 + act cruisers bumper to bumper, then a second bus. Clear it by car-hopping the roofs
  (every hop refills your jumps, so flip off the car to reach the bus). Every vehicle you hit is a slam (+35 Heat),
  so hitting two or three ends the run. Acts 2-4 also use the roadblock until their own set pieces exist.
- **Finale (act 5).** Two roadblocks back to back; its gate wins the run: `YOU ESCAPED!`, wins counted on the phone.
- **Act clear pays** $30 + 15 x act, 3 x act Stoken and 3x the floor-clear score.
- **Helicopter (act 2), from the card I sent:** going with my recommendation, "outrun it, hide under the L".
  Built: the light hunts from behind at 1.4x cruising speed, then locks on and follows at up to 1.04x. Rail speed
  and Speed Kicks pull out of it, and a slam lets it sit on you. Being lit adds 14 Heat a second. L-train tracks
  overhead (3.5 tiles up, 5-8 tiles long, every 16-24 tiles) block it: duck under one and it loses you,
  overshoots and turns back. "SPOTTED!" / "LOST 'EM" callouts. The street run is 8 pieces with no roadblock.
- **Acts 3 and 4** reuse the roadblock and the helicopter (3 = roadblock, 4 = helicopter) until their biome set
  pieces exist (the flood / chariots / guards, and the drone swarm). **The finale** is two roadblocks with the
  helicopter hunting the whole way.

- **Stance and 180s (sim side, with the models thread).** zack noted a 180 leaves you riding the other foot
  forward. In one-button play the air tap throws the next trick in a fixed roll: kickflip, heelflip, BS 180,
  shuvit, kickflip, FS 180, heelflip, 360 shuvit (a quarter are 180s). A 180 flips `Skater.fakie`; shove-its spin
  only the board so they don't. Tricks thrown fakie are called "FAKIE KICKFLIP" and score 1.5x; a 180 adds +25.
  A slam puts you back regular. The stance resets each floor. Trick events now carry `name`, `spin` and `fakie`.

## Models thread: animation

- **Reference photos stay out of the repo.** The repo is public, so photos and video frames (zack's and the web's)
  live in the project's shared files under `reference/`. `art/reference/README.md` describes each move and links
  to them by name.
- **Animations are keyed in Blender on the skinned Lou Gnar, exported in `lou-gnar.glb`.** The game plays them and
  falls back to the code clips in `src/render/poses.ts` for any move without one. This follows the "code clips now,
  Blender later" choice.
- **Fakie is a flip of the rig, not a second set of clips.** After a 180 Lou rides fakie. The rig turns Lou and the
  board half a turn about vertical, so a regular clip pops the leading end. Switch tricks (opposite stance, forward)
  would need mirrored clips and wait until gameplay adds them.
- **The 360 flip is keyed from zack's slow-mo clip, mirrored** (the clip travels left; Lou rolls right).
