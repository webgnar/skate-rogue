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

## Effects thread: fx8 device polish

- **Settings live in the URL until there is a settings menu.** `?calm` turns on reduce motion and reduce
  flashing, `?fx=low` forces the low tier and `?heatcue` adds the Heat stripes. They are saved, so you only need to
  set them once, and `=0` turns one off. The phone's own "reduce motion" setting turns reduce motion on. A pause
  menu toggle belongs with the gameplay thread's UI.
- **Reduce motion** removes the camera punch and shake, hit-stop, focus lines and speed lines. The burst, debris and
  sound word still land, so a slam still reads.
- **Reduce flashing** removes the focus-line flash and lightning, makes the police flares glow steady, stops the
  billboard pulse, and holds the red edge vignette steady at high Heat.
- **The Heat cue that isn't colour** is black and white hazard stripes on the screen edges. They thicken with Heat
  and breathe about once a second. It is off by default, because the red edge already works for most players.
- **The low tier comes before the resolution drops below 1.** It keeps outlines on Lou, cars and pickups and drops
  them from the street. It also drops the lamp and headlight cones (the pools stay), halves rain and sparks, and
  turns off the Heat point light. Auto unless forced.
- **The street kit is batched by look.** Draw calls were the real cost on a night floor: about 280 counted over both
  passes. Merging kit meshes that share a material took the kit from 354 meshes to 60, and the floor to about 170
  to 200 draws. Facades stay separate because each has its own window map. Lou's rig (36 draws with outlines) is
  the next biggest item, and belongs to the models thread.

## Effects thread: fx9 trick effects

- **Sketchy means the trick was caught late**: the board landed within 0.3 s of the flip being thrown. It is visual
  only, with no score change; gameplay could hook into it later if you want a sketchy penalty.
- **Trail colours by trick**: kickflip cyan, heelflip magenta, shove-its yellow, 180s white, so tricks read apart.
- **Two grind spark styles**: hot white for metal rails, orange with concrete chips for ledges and roof edges.
- **Lamps and headlights come on from golden hour**, not faintly in the afternoon (a fix to fx7).

## Effects thread: fx10 boon and board mod looks

- **Boon looks use the card colours** (POP yellow, GRIND orange), so a look says which kind of boon made it. Board
  mods each get their own colour (cash green, slow-mo pale blue, gravity violet, kick cyan).
- **Everything is a short particle effect**, with no new meshes, sprites or HUD. The full table is in
  `openspec/changes/fx10-boon-looks/proposal.md`.
- **Ghost Rail gets nothing new**, because the ghost rail it draws is already its look.

## Effects thread: fx11 Heat searchlight and drone scan

- **The searchlight comes on at Heat 45 and locks on by 85.** Below the lock it wanders up to 2 tiles round Lou,
  so it reads as searching rather than finding.
- **The drone scan is red and sweeps steadily**, never blinking, so it stays clear of the photosensitivity rule.
- **Both show in daylight at 45% strength**, because Heat can rise in the afternoon too.

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
- **Act 3** reuses the roadblock until its biome set pieces exist (the flood / chariots / guards). Act 4 has the
  drone swarm (below). **The finale** is two roadblocks with the
  helicopter hunting the whole way.

- **Drone swarm (act 4).** The GDD line is "drones dive in patterns; car-hop them to stay ahead", so a drone is a
  car roof in the air. The street run (5 pieces) is followed by 5 pieces of flat street with a wave of drones every
  10-14 tiles. Each drone waits 6 tiles up and dives in when you're 11 tiles away, swooping back toward you, then
  hovers across the skate lane (a 1.5-tile box). Land on one: it's a car hop (jumps refilled, -8 Heat) and it goes
  down spinning, "DRONE DOWN!" +250 style. Ride into one: a slam. Patterns: single (car-roof height, one ollie),
  pair (chain two hops), step (low, high, low) and wall (head high at 56 px, past a plain ollie, so ollie and
  flip, or hop onto it off the drone before). The first two waves are always a single then a pair, to teach it.
  The act 3 escape stays the roadblock until the act 3 biomes exist.

- **Buses and box trucks in traffic (from floor 4).** 30% of the vehicles going your way are big: a CTA bus
  (6 tiles, 72 px roof: ollie and flip up the back, or hop on off a car; slow, 0.3x cruising) or a box truck
  (4 tiles, 64 px box) with its tailgate down. Roll up the tailgate and it's a kicker: a bigger pop than an ollie
  (about 87 px of air, no jump cut since the ramp did the popping) and a **bomb**, my light version of the GDD's
  bomb: a burst to 6.5 px/frame that bleeds off like rail speed. "TAILGATE BOMB!", +150 style. Hitting the side
  of either is a slam as usual. The truck is code-built for now; the models thread can swap in a Blender one.
- **Close calls.** Clear a vehicle (parked, roadblock or moving, including an oncoming car passing under you)
  with your wheels within 10 px of its roof the whole way over, without touching it: "CLOSE CALL!", +200 into the
  combo, -5 Heat (the GDD's number), and a short slow-mo beat. Landing on the roof is a car hop instead.
- **Not yet:** cross traffic at intersections, parked car doors, and the bus stop pulling into the lane are next.

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
- **Smith fixed, old pose kept as the feeble.** A backside smith's nose dips down on the side you skated from, so in
  our view it comes toward the camera (as in zack's photo). The old pose had it over the far side, which is a feeble.
- **Trick roll** (in `src/physics/tricks.ts`): 16 steps that bring round every air trick, 360 flip twice, 180s 4
  times. The GDD's QFS list (kickflip, 360 flip, hardflip) are all in it.
- **Lou and the board draw in 6 calls, not 18** (12 with outlines, not 36). Plain-coloured parts merge into one
  mesh with vertex colours when they load; the visor, flag patch, deck ply and wheel swirl stay separate.
- **Clips get into Blender by baking them from the game.** `art/bake_clips.cjs` runs the game headless and records
  every bone and the board at 30 fps; `art/lou_gnar.py` keys them as one action per clip in `art/lou-gnar.blend`,
  with the board on a new `Board` bone. The legs come in as baked FK keys (the game's IK result), not IK controls.
  Easy to edit a pose in Blender, but not yet a full animator's rig with foot controls.
