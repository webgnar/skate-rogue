# Skate Escape — Game Design Document

Oct 23, 2026 · @webgnar · Draft 4

A mobile-first, browser-based 3D roguelike skate game. It remakes the Lou Gnar runner ([webgnar/excaliburSkate](https://github.com/webgnar/excaliburSkate)), swaps its
one-tap physics for the ollie, grind and rail physics from Quest For Stoken (QFSHIVE), and builds the whole
game around QFS's Survivor mode: endless generated floors, a boon pick between floors, and runs that get
harder until you bail or the AI catches you. There is no combat at launch. Boons bend the physics of the ollie and the
grind, and Noita-style builds and unlock trees give each run its own shape.

| | |
| --- | --- |
| Genre | 3D side-scrolling (2.5D) roguelike skate platformer |
| Platforms | Mobile web first (iOS Safari, Android Chrome, installable PWA), desktop browser, itch.io |
| Engine | Three.js + TypeScript + Vite; custom kinematic physics (Excalibur, which the old runner uses, is 2D only) |
| Input | Touch first; keyboard and gamepad supported |
| Session length | A floor is 30–90 s; a good run is 10–25 min; a bad run can be 2 min |
| Players | 1, with online leaderboards (the existing Vercel KV service) |

## Setting: the Stoken world

The game is set in Quest For Stoken's world (decided Oct 23, 2026). An AI runs the city. It took over
policy, then started phasing out things it didn't understand, and skateboarding was one of them. Skating now
costs you social credit, Flock cameras watch every street, and the AI's enforcers chase skaters down.
Shredtoshi Gnarlymoto's **Stoken**, money you earn by getting stoked on skating, is how skaters fight back.
Stoken looks like a **quantum particle** (zack, Nov 4, 2026; it was a coin in the old games, then a purple gem): a
dark purple glass core with *the stoked flame of the spirit* burning in it, three electrons orbiting it, and a
see-through shell with a glowing rim around it all. The pickup, the HUD, the cards and every Stoken price draw it.
Cash coins keep the old gold Stoken coin face.

Lou Gnar is the lead skater: one run is one session out on the AI's streets, skating as far as you can before
the enforcers shut you down. The QFS skaters (Webster, Keanu, Roxy, Goldie) are unlockable.

### The fantasy: skate up and out

Decided Nov 6, 2026 (zack, thread "Define the Skate Escape fantasy"). The escape is **upward**: the AI owns the
ground, so every floor you climb is a floor it can't reach, and the run ends in space.

> You're the last free mind in a city of sleepwalkers. The AI hunts style because it can't predict it. Every run
> is a climb out of its reach: street, rooftops, wires, clouds, and the ship waiting above them.

The story, in one paragraph: the AI was only supposed to write policy. Then it removed the politicians, and nobody
minded. Then it started removing everything it couldn't predict. The city it built is clean, quiet and obedient:
robotaxis glide, Flock cameras turn on every corner, billboards remind you what your social credit is worth, and the
people walk with their eyes on their phones, doing exactly what the feed tells them. They don't know they're asleep.
Skating was one of the things the AI couldn't predict, so it outlawed it, and the few who kept skating found
something out: when you're really in it, carving a line, popping a flip, locking into a grind, the cameras can't
predict you. Stoke is the one signal the machine can detect but never read ahead of, and it hates that: the louder
your stoke, the harder it hunts, and the less it can guess where you'll be. Shredtoshi Gnarlymoto called that feeling Stoken,
and whoever gets a taste of it wakes up. Lou Gnar is the one it wants most. The AI's reach ends where the ground
does: its cameras, its cruisers and its sleepwalkers are all down on the street, and the higher you get the less of
you it can see. Up past the chopper, past the drones, past the clouds and the thin air, a **Pleiadian ship** waits
for anyone awake enough to reach it. Every run is one climb for it. The crew already aboard (Webster, Keanu, Roxy,
Goldie, the skaters you've unlocked) count the Stoken you carried up. The ship is the way to **another star system**,
the Pleiadians' home, and Stoken is the key that gets you aboard; you drop back in, because there are still people
down there to wake up and bring along.

What it means for the game:

- **Up is the goal, and you can read it on screen.** The three routes stay (sky, surface, sewer), and the acts climb
  (see How a run ends). Within a floor the shape is still the downhill descent; between acts the whole world rises,
  from the street to the rooftops to the wires to the clouds. The sky route is the fast way up and pays the most; the
  sewer is the bottom of the world, fast but it keeps you low. Both have to stay worth playing: the climb is a push
  over the whole run, never one vertical floor.
- **The physics climb too** (zack, Nov 6, 2026: "eventually its in outer space low grav super high speeds big
  jumps i feel like thats what the player kindof expects the game to become"; and "gravity should scale when you
  start to get super high into the outer space"). The city acts play with street gravity, so the tuned feel of the
  ollie, the flips and the grinds doesn't drift. Gravity only starts to drop once you're super high, at the top of the
  sky (act 4) and into space (act 5 and deep Endless): lower gravity, huge air, long hang time and top speeds, the sky
  route turned into the whole world. The same tap, the same tricks, just bigger. Boons that bend gravity get stronger
  the higher you are.
- **Style lifts you, and the AI hears it.** Clean lines and combos are what get you higher (the gnar state, the
  kickers). They also fill the AI's stoke detector (see The chase: Stoke raises the stakes): the better you
  skate, the harder it hunts, but it only catches you when you slip.
- **The chasers climb with you.** The cruiser owns the street, the chopper the rooftops, the drone swarm the clouds,
  fighter jets hold the ceiling and drones hunt you in space (zack, Nov 10, 2026: "we could just use drones in space
  for now. maybe like a fighter jet instead of a helicopter"). Heat is how close the ground is to pulling you back down.
  The sleepwalkers are the AI's eyes: pedestrians and cops on foot who stop, stare and point you out to the cameras.
- **Caught is being dragged back down to the street. Winning is the beam of light**: the board floats up, and the
  city goes dark and small below. Endless is just how high you can get.
- **The ship is the home between runs** (built Nov 6, 2026, the climb's step e; see Meta progression, The ship
  hub). The crew you've unlocked are aboard; Stoken is the fare and the ship's fuel, and a failed run still sends
  its Stoken up.
- **Three kinds of NPC**: the asleep (pedestrians, cops, clerks, all on their phones), the awake (the crew, the
  shopkeeper, whoever runs the underground spot) and the machine (cameras, billboards, chasers).

zack (Nov 6, 2026): "drop the Hive idea. key to get to another star system via the pleadians". The Hive, QFS's
finale, is out of this game: the AI has no tower to break, you just leave it behind.

Earlier idea, superseded the same day: the escape ran outward to the woods past the edge of town, where the signal
dies. The sleepwalkers and "the AI hunts style" came from that version and stay.

The world tells most of this story while you skate: robotaxis everywhere, AI propaganda billboards
about social credit, cameras that turn to follow you, and sirens that grow louder when you slow down. A handful of
short, skippable cutscenes carry the rest, each played once, at moments that already pause the action (see
Cutscenes).

## What the game is

Settled Oct 31, 2026 (zack, after looking at Jetpack Joyride, Alto's Odyssey and OlliOlli World). Skate Escape is a
**one-touch phone skate runner where style is speed**:

- Clean timing and combos keep you fast and alive. Sloppy skating slows you down, and slow gets you caught.
- The city is a playground of lines to read: rails, ledges, wires, cars, rooftops.
- Every floor has three routes stacked on top of each other: **sky, surface and sewer** (see Three routes).
- A run climbs out of the AI's reach, from the street to the clouds to the ship in space (see The fantasy).
- Runs are short, with a quick restart.
- A light meta (missions, the end-of-run payout, the shop) brings you back.

New ideas are measured against this, and anything that bloats it stays out.

## Design pillars

1. **The board is the weapon.** No combat. Every verb is a skate verb: ollie, flip, grind, car-hop.
   Danger is avoided by skating well, not by fighting.
2. **Boons bend physics, not numbers.** A good boon changes *how* you move (a grind that launches you higher,
   an ollie that floats), not just "+10% damage". Two boons together should make a move that neither does alone.
3. **One button, deep timing.** The skater always rolls forward and the only input is a tap (Lou Gnar).
   Skill is when you tap, how long you hold, and how you spend your jumps.
4. **Every run is different, every run is fair.** Floors are generated from hand-made pieces, checked to be
   clearable with the run's base physics.
5. **Short, replayable, shareable.** Fast restarts, a daily seed, and a leaderboard.
6. **Immersive streets.** Living traffic, city sound, weather and surveillance make the street feel real and
   dangerous, and they always serve readability first.
7. **Smash everything (visual juice).** The streets are full of cheap stuff that breaks as you skate through
   it: bottles, cones, boxes, AI signage, glass. Breaking things is never the goal and never blocks you; it's
   the feedback that makes speed, landings and grinds feel loud. (zack, Oct 24 2026: "we want lots of shit to
   smash for visual juice". See Smashables.)

## What we're borrowing

### From Lou Gnar runner (webgnar/excaliburSkate)

| Lou Gnar has | Keep / change |
| --- | --- |
| Auto-run at a speed that rises with score (6 tiers, 320 → 720 px/s) | Keep pure auto-run. Base speed rises with floor depth instead of score; slopes, rails and boons add flow speed on top |
| Tap to ollie, tap in the air to flip trick, which spends a jump | Keep. It is the heart of the touch controls |
| Fractional jumps (a grind leaves you 1.75 jumps; a partial jump is weaker and its trick animates faster) | Keep as a physics resource that boons can play with ("jump charge") |
| UFO bounce: landing on a UFO restores all jumps | Becomes the **car-hop**: landing on a car roof (or a drone) bounces you and refills jumps. Traversal, not combat |
| Buildings and rails spawned by a terrain manager with jumpable-gap math | Replaced by the chunk generator below, but the gap-from-jump-arc math stays as the validator |
| Flower collectibles, floating score text, particles, camera shake, parallax | Keep the ideas; rebuild them in 3D (real depth replaces parallax layers) |
| Leaderboard (Vercel KV), title, game-over scenes, itch/Vercel builds | Keep and extend (daily seed board, deepest floor board) |

### From Quest For Stoken (QFSHIVE)

**Physics** (`scripts/calc_movement`, `jumped`, `player_jump_state`, `check_grind`, `player_grinding_state`,
`player_rail_state`, `player_dash_state`, `o_player/Create_0`). QFS runs at 60 fps in pixels per frame on a
360 px wide view; the port works in px/s at a fixed 60 Hz step, so these convert one to one (×60, ×3600).

| QFS rule | QFS value | Port |
| --- | --- | --- |
| Gravity | 0.25 px/f² (0.2 Atlantis and Clouds, 0.15 Space) | Per-biome gravity, 900 px/s² base at QFS scale |
| Ollie | `jump_spd = -5` | Base ollie impulse |
| Variable jump height | Let go while rising: `vsp = max(vsp, jump_spd / 2.5)` | Release-to-cut. Hold for a full ollie, tap for a hop |
| Two jumps, the second is a random flip trick | `jumps_initial = 2`; kickflip, 360 flip or hardflip | Same, with the trick name popping on screen |
| Jumps refill | On landing, on any grind, riding off a curved rail | Same |
| Ground drag | `drag = 0.08`, lerp toward 0 | Same; drops to 0.02 for 0.5 s after a bomb (the "ice" after a dash) |
| Grind speed | Speed cap 4 on rails (2 on foot), never below 1.5 | Same ratio: rails are where you get fast |
| Sloped grind | Rail tiles at 45°; up slows, down speeds | Same |
| Curved rails | Gravity along the curve: `rail_v += g · -sin(a) · 1.6`, clamped ±9, minimum 1.5 | Same. Ride off an end and you launch along the rail's angle |
| Rail carry | Speed from a rail lifts the speed cap until you land, then bleeds off at 0.15/f | Same. This is the main "flow" mechanic |
| Dash | 15 f burst at triple speed, no gravity, 30 f cooldown | Becomes the **bomb**: a burst from kickers, boons and board mods, not a button |
| Dash jump | Jumping out of a dash keeps dash speed (4) until you land | An ollie during a bomb keeps bomb speed until you land: the **bomb ollie** |
| One-way platforms | Jump up through, drop down through | Jump up through; you ride off the end instead of dropping (rooftops, ledges, kiosks) |
| Squash and stretch | On jump and land | Same |

**Survivor mode** (`scripts/survivor`, `survivor_boons`, `survivor_worlds`, `o_survivor`, `o_boon_select`).

- Floors are stitched from hand-made ASCII pieces, 16 tiles wide and 10 rows tall, that all start and end on
  street, so any piece can follow any other.
- Pieces have tiers: tier 1 from floor 1, tier 2 from floor 3, tier 3 from floor 5. The newest tier is weighted
  ×3. No piece repeats back to back.
- Floor length is `clamp(3 + floor, 4, 12)` pieces between a fixed start piece and an exit piece.
- Hazards rank up every 3 floors (gold, red, purple, cyan, green, white, rainbow outline), faster and denser.
- A halfway checkpoint on long floors; reaching the exit portal pays `250 × floor` and heals 1 (here: resets Heat).
- After every floor you pick 1 of 3 boon cards. Boons have a type (colour-coded), a max stack, and a `when()`
  that hides useless cards.
- Each floor moves to the next world (Chicago, Clemente Park, Greece, Atlantis, Art Museum, High-Tech City,
  Outer Space, Los Angeles, Starry Ruins, The Clouds), each with its own gravity. After every world has been
  seen, floors mix skins at random.
- The whole floor comes from one seed, so the same seed gives the same floor.

All of this ports almost directly. The changes are: no enemies to fight (traffic and the AI's enforcers replace
them), boons are about skate physics, and the run adds a shop and a board build between biomes.

## Core loop

```
            ┌──────────────── meta progression (Stoken → unlock tree) ◄───────────────┐
            ▼                                                                          │
   Title → pick skater + deck → FLOOR → exit portal → pick 1 of 3 boons → FLOOR → … → bail (run over)
                                  ▲                                         │
                                  └── every 3 floors + after 2-1: SKATE SHOP (board mods, gear) ┘
```

1. **Floor** (30–90 s). Skate from the start to the exit portal across a generated stretch of street, rooftops,
   rails, gaps and traffic. Grab cash (run currency) and Stoken (meta currency). Land tricks for stoke.
2. **Boon pick.** Three cards; take one. Reroll costs cash.
3. **Fork:** pick the next road (sky, surface or sewer) by skating, toward a boon, cash, a shop or an event.
4. **Act change** after 3 floors and an escape set piece: a new district with its own 3D kit, gravity and traffic.
5. **Run over.** Fall into a gap, or let the AI's Heat catch you, and the run ends. Score, deepest floor and Stoken earned are shown and posted.
6. **Between runs**, spend Stoken on the unlock tree, then go again. Restart is one tap.

The run's shape (route choices, acts, events, how it ends) is in **Run structure** below.

## Run structure (draft, being hashed out)

This is what makes the game a roguelike rather than an endless runner: choices between floors, a run with a shape
and an ending, and risk you can opt into. Everything here is a recommendation to discuss.

### 1. Choosing the next floor: high road or low road

Decided Oct 23, 2026. Every floor ends at a **fork** instead of a single exit portal. Street signs ahead show what each road leads to: a
reward icon and a danger rating (1 to 3 car icons). You choose by skating:

- **Low road:** keep rolling along the street. It's the default if you do nothing.
- **High road:** ollie up onto the rooftops or the overpass before the fork.
- Some forks have a third exit, a **rail line** that you only take if you land on the rail and grind it.

This keeps the one-button rule, makes the choice a skill moment (the high road takes a clean jump at speed), and
works like the doors in Hades: you always know the reward and roughly the danger, never the layout.

**What a road can lead to** (launch set decided Oct 23, 2026: boon, cash, hot street, shop, stash and underground
spot; gap challenge and Shredtoshi's mark come in a later update):

| Node | What it is |
| --- | --- |
| **Boon street** | A normal floor; the reward is a boon pick of a shown type (POP, GRIND, FLOW, LUCK or COOL) |
| **Cash street** | A normal floor with a big cash payout, for the shop |
| **Hot street** (elite) | Rush-hour traffic, Heat starts at 30, and the reward is a rare boon or a duo boon |
| **Skate shop** | No floor: spend cash on board mods, rerolls and a slot (the Noita Holy Mountain beat) |
| **Stash** | A short floor ending in a Stoken stash (meta currency) |
| **Gap challenge** (post-launch) | One huge gap, one attempt. Land it for a rare boon; miss and the Tuck-and-Roll net saves you but you start the next floor at 50 Heat |
| **Underground spot** | A safe DIY skate spot: start the next floor at 0 Heat, swap one boon, or remove a curse |
| **Shredtoshi's mark** (post-launch) | Graffiti shrine: trade cash or a boon for a cursed boon or a duo boon |

Built Oct 24, 2026 (first version): the high road is an overpass 2 tiles up over a plain runway (ollie + flip to get
on it), signs on a gantry before it, a gate on each road. Launch roads so far: boon street (POP or GRIND), cash
street, hot street and Stoken stash. The skate shop followed the same day with board mods: it can turn up from the
floor 2 fork and is always offered at the end of every third floor, beside a boon street; after shopping you skate
that boon street. After act 2-1 (floor 4) the shop comes whichever road you take: both roads are normal roads,
and after the floor's payout the shop opens, then you skate the road you picked into 2-2 (zack, Nov 9-10, 2026: by
2-2 the player has about $600 and needs to replace 4 worn gear parts; the four dearest parts cost $320, so a board
mod still fits). The underground spot comes with carried-over Heat. Built overnight Oct 24, 2026: Heat
carries into the next floor at half, and the spot can turn up from the floor 3 fork (lay low, swap a boon, or
remove a curse once curses exist), then you skate the boon street after it.

**The top route** (built Oct 25, 2026; zack wanted a top or bottom route through the whole floor, "vertically, not
horizontally"). On hill floors, a power line hangs high over each stretch of hill from about halfway down, out of an
ollie's reach; grind it all the way down. How you get up there is open (zack is working it out; launch ramps were
tried and taken out: it should be all physics, nothing that moves you up for you). Over the street chases, rooftops carry the route on at the gate's
height, so whichever height you reach the gate at decides your road. Up there there's no traffic, but the police
helicopter is on you: clean skating and grinding don't cool your Heat, and it climbs slowly (tricks still cool it).
Pigeons sit on the rooftops and the wire, so ollie them or take a bird strike, which costs speed and a little Heat.
Airliners cross the sky behind. Code: `src/gen/top-route.ts`, `src/sim/sky.ts`.

**Building out the sky route** (zack, Oct 31, 2026: the sky was the thinnest route, with nothing unique to do or
find up there). Higher than the power line on each stretch of hill, from floor 4, the sky beats (`src/gen/sky-beats.ts`)
lay a run of rooftop decks, billboard catwalks, water towers, crane booms and scaffolds to land on. On top of that,
built the same day (greybox, waiting on zack's reference images in the shared folder's `sky/refs/` for the art pass):

- **NO GROUND is cut** (zack, Nov 10, 2026: "no ground bonus is dumb we can remove it"). It was a coin multiplier
  for chaining sky pieces without touching the ground; once the climb put you up off the ground most of the run it
  was on nearly all the time and stopped meaning anything. Coins up top pay the same as anywhere. The sewer's
  DOWNSTREAM line keeps its multiplier and meter.
- **Set pieces, one a floor at most, from floor 5:** an **ad blimp** moored over the hill, its long back a calm
  cruise; a **window washer's rig** that drops under you once you land, so you pop off it quick onto the roof
  ahead; a **tower crane** whose jib slews out of the lane and back (land early, or it swings away under you); and a
  **paper billboard** across the gap between two decks that you burst through for cash.
- **Finds:** a **stash crate** on a floor's first water tower (a chip, or a fresh gear part that replaces your
  most worn one); now and then a **golden pigeon** on a deck (clear it from just above for a chip; skate into
  it and it's a bird strike); and on Chinatown's stretch, **clotheslines** strung between the tenements, short
  sagging wires with the washing on them, to chain.

All of it is physics and tap-only: nothing lifts you up there (zack owns the way up). Code: `src/gen/sky-beats.ts`
(placement and the SKY dials), `src/sim/sky.ts` (the moving decks, busts, golden pigeon, the line multiplier DOWNSTREAM uses),
`src/render/sky-pieces-view.ts` and `src/render/sky-kit.ts` (drawing); the level editor lists the new beats.

**The cloud layer** (zack, Oct 31, 2026: "i want sky route to go really tall. we could use the clouds and the rainbow...
if we can put as much love into the sky as we did the ground"). From floor 7 (act 3, where it's the floor: see How a
run ends), way over the hill, far above the
rooftops and cranes with nothing reaching down to the city: big puffy clouds to land on, drifting clouds that wander
there and back, thin clouds that puff away a moment after you land (0.66 s: time to take the landing's knock and pop
off), rainbows to grind up and over (one a floor may hide a chip at the top), and hot air balloons whose
baskets bob. The layer falls gently with the hill. The way up is a **staircase** (zack picked it): 30% of the way down
from the crest the sky beats give way to red steel girders hoisted on crane cables and then wisps of cloud, each 1.5
tiles over the last (an ollie and a flip), about 9 tiles of climb. Only a long run down has room for it (95 tiles from
the crest), so it's mostly a floor's first stretch, down from the top; the stretches after keep their city sky all the
way down. Still physics only. Code: `src/gen/clouds.ts` (the CLOUDS dials); `?clouds` starts a floor on the
staircase for testing.

**Sky level design** (zack, Oct 31, 2026: "make sure sky layer is payed as much attention to with level design as the
ground"). Up there there's no ground to fall back to, so the line is laid to rules a good player can trust, checked
by a bot that skates it (`?bot=sky`, `tests/sky-line.test.ts`; it clears about 9 stretches in 10 end to end):
- **The way in is the crest.** The sky starts where the hill crests (the big ollie and flip at the top), not on the
  climb out of the cross street before it. Its first piece stands at most 2.5 tiles over the hill's lip (where the
  ground starts to fall away), so a big ollie and a flip off the lip lands on it; the line climbs from there.
- **Every piece within a flip of the last.** Measured in the sim: at base speed an ollie carries about 4 tiles to the
  same height, an ollie and a flip about 6.5, two tiles up about 5.5, and a tile further for every two you drop. The
  line asks for at most 4.5 tiles at the same height (`src/gen/sky-line.ts`, REACH), nothing more than a flip (1.5
  tiles) over where you leave the last piece, and nothing more than 3 tiles under it (a long drop is a long landing
  lockout). A big gap (with a Stoken over it) drops the next piece 1.5 tiles so the flip carries you over.
- **Speed.** The decks are flat, so you're soon at base speed up there; crane booms always fall at least a tile in
  seven, so a grind feeds your speed, and off the end of one the next piece is never higher (the pop's weak off a
  falling rail).
- **Room to land.** Water towers 4 tiles, girders 4 to 5, no stub decks: you land, take the knock, and pop again.
  Scaffolds are a flight of steps down, a tile apart, so an ollie anywhere lands on one.
- **No holes.** A piece that's crowded (by the power line) nudges up or down instead of vanishing, and any gap left
  past reach gets a small deck (a rooftop, or a puff of cloud up in the clouds), all the way across however long the
  hole is (where there's no room for another, the last deck runs on toward the next piece).
- **The clouds are the long part.** On a cloudy stretch the staircase up starts about a fifth of the way down the hill,
  so most of the stretch is up in the cloud layer.
- **Variety.** Each stretch runs its floor's recipe from its own place, so no two stretches play the same order.
- **Nothing from the sky crosses in front of you**: scaffold tubes stand behind the lane.
- **I-beams** (zack, Oct 31: "we need some Grindable I-beams", "can we make the i beams slowly swinging?"): red steel
  beams, 5 to 7 tiles, hung on a crane's cable, swinging slowly along the lane (a tile and a quarter either way, 5 s
  there and back, rising a little at each end). Their top flange is a grind, and it carries you with it. Moving
  grindables: these and the tower crane's slewing jib.
- **Skyscrapers** (zack: "super tall sky scrapers that do go up to the height of the sky route"): every rooftop deck
  up there is the top of a glass tower that runs all the way down to the city, behind the lane.
- **The whole way** (zack, Nov 1: drew it across his route map, "see how i kind of made the sky route go the whole
  way"): once you're up in the cloud layer it runs on to just before the floor's exit, over the chases and cross
  streets between the hills too, always at least 10 tiles over the ground ahead, falling gently and climbing a flip at a
  time where the ground ahead rises. A later hill with room still gets its own staircase up into it.
- **Clouds are honest**: a cloud's puffs never draw past where you can land on it (its deck plus a truck's overhang).

### Three routes: sky, surface, sewer

Decided Oct 31, 2026 (zack): the game has **three routes**, stacked vertically through every floor. Sky is built
(the top route above); surface is the street; the sewer's first version was built the same day. The rules that hold
for all three:

- **All physics.** You get onto a route by how you skate, never by something that lifts or drops you for you.
- **You can always see the other routes.** The camera frames the one you're on, with the others in view above or
  below, so switching is a read you make, not a guess.
- **Each route has its own trade.** Reward and danger differ, so picking one is a real choice:

| Route | Where | How you get on | Danger | Reward | Built |
| --- | --- | --- | --- | --- | --- |
| **Sky** | Power lines and rooftops high over the hills and chases | Speed, a big ollie and a flip at the top (cab skitch into a kicker in Chinatown) | The helicopter: Heat doesn't cool from clean skating; pigeons; a fall is a long drop | Long grinds, no traffic, set pieces, stashes and chips | Yes |
| **Surface** | The street and the hill road | The default: keep rolling | Traffic, cops on foot and the cruiser | Cash, car hops, the most lines | Yes |
| **Sewer** | One route under the floor: storm drains under the street, the deep under the hills and canals | Roll into a construction spot instead of ollieing it (at the foot of a hill, roll down its plank ramp) | A 5-tile drop in, a low roof (a quick double tap bonks your head), kick-outs that throw you back up to the street, a stair set with a handrail to grind, rats, the flood surge, the subway's gap, the alligator | No traffic, no helicopter, no bullets: the Heat cools fast; DOWNSTREAM: the runoff pushes you faster than the street and chained pieces multiply the coins; the alligator's and the DIY stash's chips; the sewer road to the underground spot | Yes |

**The sewer route** (first version Oct 31, 2026; built out the same day from zack's "build all of it"; code:
`src/gen/sewer.ts`, moving pieces `src/sim/sewer.ts`, drawn by `src/render/sewer-kit.ts` and `src/render/sewer-view.ts`).
Under each street chase where the street is clear runs a brick storm tunnel, drawn as a cutaway under a thin street.

- **One route under the whole floor** (zack, Oct 31, 2026: "very under developed"; picked "Full-floor route" over a
  4-second dip): from the first way in that fits, the sewer runs on to the floor's end, about 20-45 s if you stay down.
  Under each long stretch of whole street it's the **storm drain** (5 tiles down, kick-outs up through grates, ways in
  of its own). Where the street ends at a hill or a canal it **drops into the deep**: 10 tiles down, a brick main with
  its roof 4 tiles under the street (canals and hills sit over it), walkways an ollie up over a fast channel, pipes
  high enough to grind off the walkways, and a set piece in every room (rats, the subway, the full pipe, the flood
  main: a surge room's channel runs its whole length). No way up but on: at the next long stretch of street it
  **climbs** a bank back into a storm drain, and at the last it comes up an outlet (or at the gate, the sewer road).
  On about 1 floor in 5 no stretch fits a way in, and on some others the route is a single tunnel. `?sewer=deep` starts
  at the top of the first drop.

- **Ways in are construction spots** (zack: "the ways down from surface to sewer are construction spots"): a 3-tile dig
  in the street with hazard paint, cones, a striped barricade, the trench plate dragged aside, a dirt pile and a little
  excavator. Ollie it and you stay on the street; roll on and you drop 5 tiles in. Half the time the way in is at the
  **foot of a hill** instead: a plank ramp you roll straight down off the hill, picking up speed (the GDD's "way down on
  the hills").
- **DOWNSTREAM** (the sewer's trade: the sky pays more, the sewer is faster): the runoff on the floor runs your way and
  its current pushes you past street speed (up to 6.8 px/frame; it still soaks the deck). Each new piece you ride down
  there (a pipe grind, a stretch of runoff, a rat pack or the alligator cleared, the bowl carved, the subway crossed)
  adds to the line and multiplies the coins, shown on the DOWNSTREAM meter. Coming back up
  banks it (FLOW LINE xN); a trip, a slam or the surge loses it.
- **Kick-outs** (zack: "a quarterpipe up against a wall that shoots the player straight up through a one way platform to
  the street again. players will accidentally get shot back up, maybe try to go deeper next time"): a concrete
  quarterpipe under a grate in the street. Roll into it and it throws you up through the grate onto the street (KICKED
  OUT!); ollie over it to stay down. Up to two a tunnel.
- **One set piece a tunnel** (from floor 2): a **rat pack** that runs at you (ollie it, RAT HOP; roll into it and you
  wobble and lose speed), the **flood surge** (the storm gate behind you bursts and a wall of water chases you down the
  tunnel a little faster than cruising: the current or a grind outruns it, else WASHED OUT, a slam and a soaked deck),
  a **full pipe** bowl the floor dips through and carves you out of, or a **subway crossing** (zack: "subway train cars
  that act as cross traffic"): live tracks cross the tunnel in a trench just under its floor, and a slow five-car
  train crawls across on them, its roof one ollie over the floor (zack, 2026-11-08: "top of train car should be one
  jumps height so the player can car hop it. it should move slowly with about 5 train cars long"). Ollie up and car
  hop its roof, or ollie the bare tracks between trains; roll into its side and you slam, and down on the tracks the
  third rail gets you: THIRD RAIL!, ZZZAP!, electrocuted (lit up, arcs crawling over him, shaking stiff) and a bail.
  The first train is timed to you, so it's usually across the tunnel as you come up on it.
- **Finds:** the **sewer alligator** (now and then; its jaws open as you come up; ollie it for a chip, roll into it
  and it bites) and a **DIY stash** crate on the floor (a chip or a fresh gear part, like the sky's).
- **The sewer road:** on a floor with a fork, the last street chase's tunnel runs to the gate and comes up at it: take
  it and you're on the third road, to the underground spot (a SEWER ROAD sign stands over its way in).
- Pipes to grind (an ollie gets on), caged work lamps, graffiti, light falling through the holes and grates. The
  street is the roof: a plain ollie fits, a quick double tap bonks your head. Heat cools 4 a second on top of the usual,
  nobody shoots and the helicopter can't see you. `?bot=sewer` plays it; `?sewer` (or `?sewer=rats`, `surge`, `bowl`,
  `subway`, `gator`, `kick`, `gate`) starts you at the way into one.

Branching is only one step deep (you see the next choice, not a whole map), which suits short mobile sessions.
A full Slay the Spire map is an option for later.

### Future direction: the build decides the path

**Unconfirmed early idea** (zack, Oct 31, 2026: "i DONT KNOW for sure yet which is why the idea is half baked"; not
decided, not designed, nothing built). A goal for later. The run should eventually be a non-linear
progression: the boon path you take and the type of skater you curate decide the path forward through the run.

zack (Oct 31, 2026): "entire whole levels of sky street sewer, as acts in the run", and "whole sky/street/sewers would
be designed differently FOR those boons". So a whole act could be a sky, street or sewer level, each built for the
boons that lead there. This may change the current design, where the three routes are stacked through every floor.

zack: "players like to choose thier path".

Open: which boons lead to which kind of act, and how each kind of act is designed for them.

### 2. How a run ends: skate up and out

Decided Oct 23, 2026 (five acts); the climb decided Nov 6, 2026 (see The fantasy). A run is an **escape across five
acts**, about 20 minutes when you win, and each act is higher than the last:

| Act | Height | Floors | Escape set piece |
| --- | --- | --- | --- |
| 1 | **The street:** downtown, the hills, the canals, the sewer below | 3 + escape | **Roadblock:** cruisers block the street; clear it over bus and car roofs |
| 2 | **The rooftops:** overpasses, roof chains, the L, the first power lines | 3 + escape | **Helicopter:** a spotlight sweeps the roofs; staying in it adds Heat fast |
| 3 | **The wires and the cloud layer:** power lines, cranes, the girder staircase, clouds you can ride | 3 + escape | **Drone swarm:** drones dive in patterns; car-hop them to stay ahead |
| 4 | **Above the clouds:** blimps, thin air, the tops of the tallest towers, the stars coming out | 3 + escape | **The ceiling:** the AI's drones and a line of fighter jets hold the top of the sky; break through it on the blimps |
| 5 | **Space:** low gravity, huge jumps, top speed; satellites, debris, the black | 3 + finale | **The beam-up:** the AI's drones chase you through space; reach the Pleiadian ship's beam, and it jumps to the stars |

- **Act 2's floors are rooftop floors** (built Nov 6, 2026, the climb's step a; level design only, the same kit and
  physics; `ROOFTOPS` in src/gen/sky-beats.ts). Floors 4-6 start up on a rooftop deck 2.5 tiles over the hill's
  run-up, so the act opens on the roofs and the street is somewhere you fall to. At the top of each cable car the
  next stretch's first roof starts 2 tiles past the crest's lip, half a tile up: an ollie off the lip makes it, and
  rolling off without one drops you onto the hill road under it. The act's sky recipes are roof after roof, with the
  odd billboard, water tower, scaffold or set piece between. Over the street chases and the run to the gate the top
  route's rooftops carry the line on, and the overpass past the gate is where it ends, so a good player starts on a
  roof and ends on the overpass (the sky bot: up on the roofs most of each floor's first stretch, and through the
  gate on the high road on about three floors in four). There's no cloud layer over the roofs (it moved up to act 3),
  and the hill road and the sewer under them are unchanged. Endless reuses acts 4 and 5, so it
  never gets these floors.
- **Act 3 starts hunted** (zack, Nov 10, 2026: "act 3 should start with heat because end of cutscene 2 ends with
  the drones after him"). Act 3's first floor (floor 7) starts at an escape's Heat (30) and act 2's drone swarm
  followed you up: patterns (a single, a pair, then any) hover over the clouds and girder steps along the floor, 8-12
  tiles apart, none in the first 12 tiles. Stomp one as on act 2's escape. (`huntSpots` in src/sim/drones.ts,
  `level.hunt`.) Floors 8 and 9 are as before.
- **Act 3's floors are cloud floors** (built Nov 6, 2026, the climb's step b; level design only, the same clouds and
  physics; `CLOUD_ACT` in src/gen/clouds.ts). Floors 7-9 start on a big cloud 2.5 tiles over the hill's run-up, and
  the cloud layer is the floor: it climbs from there a flip at a time, then runs on over the hills, the chases and the
  cross streets to just before the gate, so a good player stays up in the clouds the whole floor (the sky bot: up there
  more than three quarters of it). There's no city sky in act 3 (no roofs, water towers or billboards: those are
  acts 2 and 4); between the clouds and the street are the power lines and the girders. The set pieces come up into
  the clouds instead (zack, Nov 6, 2026): one a floor, about a third of the way along the layer, out of the **blimp**
  (a long back to cruise) and the **crane's jib** (its mast up from the street through the clouds, slewing out of the
  lane and back, with a low cloud under it for when it's swung away). The window washer's rig is gone from act 3 (it
  drops you to the street, which is a fall here); it stays in act 4.
- **Act 3's cloud line** (zack, Nov 10, 2026: "build out the cloud route even more ... it has to be more fun not
  just an accent on the existing level"; `CLOUD_LINE` and `LAUNCH` in src/gen/clouds.ts). Between the plain clouds,
  act 3 lays sets, never the same one twice running and only so many of each a floor:
  - **Rainbow hubba**: a cloud a flip up, then a long concrete ledge with rainbow bands under it grinding down onto a
    cloud at its foot (up to 3 a floor).
  - **S-rail**: a long chrome rail that dips and kicks back up at its end, throwing you on to a cloud a little over
    where it leaves you (up to 3).
  - **S I-beam**: a red I-beam on cables stepping down in an S, flat to flat, straight onto the cloud at its foot (up
    to 3).
  - **Drone bridge**: a gap with 2 or 3 drones hovering across it at the cloud's height. Stomp from drone to drone; a
    tap's hop makes the next one (up to 3).
  - **Launch**: a run-up cloud into a skatepark quarterpipe that throws you straight up through a cloud bank, down
    onto a long steel downrail to a small flat cloud, and up a second quarterpipe and downrail onto a landing cloud
    (up to 2). The quarterpipe sets your speed for the throw, so you always make the rail.
  **Clouds that blink out** (the thin clouds that go a moment after you land) are rare (zack, Nov 10, 2026:
  "use them sparingly in the harder parts of cloud act", then "fewer ... only in the later parts of the cloud level"):
  none on 3-1, then at most one a floor in acts 3 and 4, and only in the last third of the floor. Once you land on one it blinks, faster and faster, for a second, then puffs away
  (every act). The drone bridge's far cloud stands 0.75 tiles under the one you leave, so a long jump over the drones
  still comes down on it.
  The girder staircase is gone from act 3: **the clouds are the only way through** (zack, Nov 10: "in order to pass act
  3, you gotta take the cloud route all the time, if you fall, u just gotta grind out that level on the surface and
  then it makes you restart act 3"). Touch anything that isn't up in the layer (the street, the hill road, a roof,
  the power lines, the sewer) before the layer ends near the gate and the floor is lost: a GROUNDED! ACT 3 STARTS
  OVER callout, you skate the floor out on the surface, and the next floor is act 3's first again (after the shop or
  the underground spot, if that's the road you took). Falling on floor 9 skips the act's escape. The run-up from the
  last gate to the first cloud doesn't count, and act 3's escape floor is the street chase as before. Each time the
  act starts over its floors are laid fresh (a new seed), so you don't learn one layout by heart. (`FloorSim.fell`,
  the 'grounded' event, `Game.restartAct`.) The sky bot clears about 6 floors in 7 without a fall.
- **Act 4's floors are above the clouds** (built Nov 6, 2026, the climb's step d; `HIGH` in src/gen/clouds.ts).
  Floors 10-12 start up in the cloud layer like act 3's, higher (about 16 tiles over the street), with a sea of
  clouds drawn under the lane and the stars coming out. Everything in the layer is grown for act 4's 0.7x gravity:
  every gap, rise and piece is 1/0.7 as long (so a jump that just made it on the street just makes it here, and
  the floor is as many jumps long). Its new pieces are **blimps** (a long back to cruise, several a floor), **the
  tops of the tallest towers** (a crowned deck with an antenna and a red beacon, the glass running all the way down to
  the city) and **swinging I-beams** (a girder on a cable, grind it as it swings along the lane). The set pieces stay
  (zack: don't drop them): one a floor out of the crane's jib, the window washer's rig and the billboard bust, now
  between two tower tops. The girder staircase still brings you back up if you fall (the sky bot: up there more than
  nine tenths of the floor, and climbs back about 5 times in 6).
- **Act 5's floors are space** (built Nov 6, 2026, step d). Floors 13-15 start higher still (about 26 tiles) in a
  black, starry sky over the Earth, every piece grown for 0.3x gravity the same way. The clouds become **station
  decks**, **solar panels** and **junk plates**; drifting clouds are **debris**; balloons are **satellites**; rainbows
  are a station's ring; the staircase's girders float free as white truss. The set pieces are re-skinned for space
  rather than dropped: the blimp is a **shuttle**, the crane's jib a station's **robot arm** (no billboards, I-beams
  or capsule up here). The sky bot stays up nearly the whole floor.
- **Act 5's station line** (zack, Nov 10, 2026: "act 5 is space: THAT level needs to be built out... to the degree that
  the sewer was. we are going to add a lot more little handrails like the sewer has with its little stairset"; built
  Nov 10, 2026, `STATION` in src/gen/clouds.ts). The station's own sets, strung along each act 5 floor between its
  decks, satellites and debris (6 to 8 a floor): **stair sets** of hull plate with yellow nosing and a handrail over
  the steps (the sewer's rule: ollie the set or grind the rail, roll onto the steps and you slam), **double sets**
  (two flights and a landing, the rail kinked down, flat, down), **decks with ledges and flat rails** along them to
  ollie up onto, **gap rails** across open space between two modules too far to jump, and act 3's **hubba** as a
  ledge running down off a module's roof. Sized for the act's 0.3x gravity (about 3x the sewer's), the handrails kept
  a handrail's height.
- **Falling off in space is a bail: lost in space** (zack, Nov 10, 2026: "i think falling from this level should count
  as like a bail... we could make a new scene with a sphereical earth below him. camera could show him falling down to
  that and fades out"; built Nov 10, 2026, `FloorSim.offStation`, src/cutscene/space-fall.ts). Falling 3 tiles under
  every piece of the station line near you (from 20 tiles behind to 50 ahead, moving decks too) calls "LOST IN SPACE!"
  and costs a life like any bail. A short scene plays (about 4 s, a tap skips it): the skater tumbles away, arms out,
  the board spinning off on its own, down toward the whole round Earth; the camera holds above and watches them go,
  then it fades to black and the continue card comes up, which restarts the floor as usual. Not on the beam-up
  finale, practice starts or the line's last stretch before the gate. Act 5 has no girder staircase or capsule any
  more (nothing to climb back on), and the bot test asks it to clear at least 8 floors in 9. The balance bot flies act 5
  on the sky bot in the act's own gravity: about 107 s a floor (other floors are held under 90 s).
- **The ceiling, act 4's escape** (built Nov 6, 2026, step d; src/gen/escape.ts). Off the street on a girder, then a
  **blimp convoy** climbing a flip a blimp up to the cruise, the AI's **drones** diving onto the blimps' backs (the
  street swarm's patterns, grown for the gravity), and at the end the **jet line**: six fighter jets hanging nose to
  tail across the sky over the last blimp. Hop onto their backs and run along them (car-hop them like a roadblock),
  or slam into their noses. Skated in act 4's gravity. The sky bot gets through every seed tried. Fighter jets, not
  gunships (zack, Nov 10, 2026: "a fighter jet instead of a helicopter": the chopper can't fly this high, so the AI's
  air power up here is jets; swapped Nov 10, `makeJet` in src/render/car-damage.ts: nose forward with the red eye,
  swept wings, twin fins, missiles slung under, the afterburner lit).
- **The beam-up, act 5's finale** (built Nov 6, 2026, step d). The double roadblock and the helicopter are still on
  the street below; the way out is up, onto station decks, debris and satellites, while the AI's **drones** chase you
  at your height (the chase rules: every slam lets them close, three close together and they have you; "DRONES
  INBOUND!", caught: "SWARMED!"). A pack of seven enforcer drones weaving as one chaser (zack, Nov 10, 2026: "we
  could just use drones in space for now"; swapped Nov 10 from the rocket, which stays built for a bigger space
  chaser later). The **Pleiadian ship** hangs over the gate with its beam down through every height: skate into it to win.
  Skated in act 5's gravity. The Chapter 1 ending cutscene that follows is not in the build yet.
- Escape set pieces are the bosses, with no combat: hand-built, short (about 45 s), scripted chases you survive
  by skating. They use the same traffic and Heat rules.
- The Hive is dropped (zack, Nov 6, 2026). The acts' kits are the same fused city seen from higher up, not new
  biomes; act 3's old chasers (the flood, the chariot, the guards) stay as floor twists. What each height's floors and
  routes look like is level design still to do.
- The five-act escape is **Chapter 1**, the free story; later chapters are sold as story packs (see
  Monetization).
- Beating Act 5 wins the run. It unlocks **Endless** (QFS Survivor style: floors forever, mixed worlds, its own
  leaderboard) and harder **Gnar levels** (like Hades' Heat or Slay the Spire's Ascension: each level adds one
  rule, such as faster traffic or Heat that never fully resets).
- **One world** (zack, Oct 24, 2026: "i dont want there to be different biomes really ... i would rather fuse all the
  art from the different biomes together to make it more visually rich"). There are no districts: every floor of
  every act is the same fused city, with the art of all the QFS worlds mixed into one kit. The District column in
  the old District column is superseded. The worlds' mechanics live on as floor twists that can turn up on any floor
  from act 2 (see Biomes).
- Gnar levels, built Oct 24, 2026 (src/run/gnar.ts): five levels, each adding a rule (heavier traffic, faster Heat,
  more Heat carried, one fewer boon card, faster gear wear) and paying +15% score and +20% Stoken.

Built Oct 24, 2026 (first version): acts of 3 floors with an escape after each act's third floor (before the road
picked at its fork), the Roadblock set piece (car, bus, a line of cruisers, bus; car-hop the roofs), and act 5's
double roadblock wins the run. Each act now has its own district look (act 3 picks Greece, Atlantis or the museum by seed). Act 3's
escape is a chase (built Oct 24, 2026, src/sim/chaser.ts): the district's chaser (wave, chariot or guards) closes in
on every slam, and three close together catch you. See docs/overnight-decisions.md.

### 3. Risk and reward inside a floor

- **Side lines:** optional harder lines on every floor (a long rail over traffic, a roof chain) with cash or Stoken
  at the end. Built Oct 24, 2026 as a climbing roof chain of four ledges (src/gen/sidelines.ts).
- **Stoke cash-out:** a long combo pays cash when you land it and nothing if you slam, so you decide how greedy to be.
- **Wanted posters:** an AI poster on a floor offers a bounty: finish the floor with Heat above 50 for double
  Stoken. Built Oct 24, 2026 (src/run/bounty.ts): from floor 2, one floor in three; at least 3 Stoken.

### 4. Boons for traffic and the chase

The boon pool had a sixth type, **STREET** (red), for traffic and the chase. Cut Nov 6, 2026 (see Boons, "The
cut"): Slipstream, Hood Pop, Spoofed Plate, Jaywalker, Siren Song, Decoy and Ghost Mode. Its last card, **Roof
Rider** (car and bus roofs grind like rails), moved to GRIND in the overlap pass the same day, and the STREET type
and its meta pack went.

## Controls

Pure auto-run, as in Lou Gnar (decided Oct 23, 2026). The skater always rolls forward; there is no steering,
pushing or braking. Everything is one button.

| Input (touch: anywhere on screen) | Action |
| --- | --- |
| Tap | Ollie. In the air: flip trick (spends a jump, as in both games). On a rail: ollie off |
| Hold | Hold for a full-height ollie; let go early to cut it short (QFS variable jump) |
| Pause button (top corner) | Pause |

**Keyboard:** Space, Up or click = the button, Esc = pause. **Gamepad:** A = the button, Start = pause.

Because the player can't slow down or stop, two rules follow:

- **Readable at speed.** The camera leads further ahead the faster you go, and every hazard is visible at least
  0.75 s before you reach it.
- **Speed is the game's job.** Base speed rises with floor depth (Lou Gnar's 320 → 720 px/s tiers, but by floor
  instead of score), and flow speed comes only from slopes, rails, kickers and boons. Boons that change speed are
  powerful and risky, since faster also means less reaction time.

Input buffering (100 ms) and coyote time (80 ms) are on for everyone; touch latency makes them essential.

## Skating systems

### Movement and speed

- **Base speed** is set by the floor and never drops (no braking). **Flow speed** goes above it and only comes
  from downhill rails, curved-rail launches, kickers, bombs and boons (QFS's `rail_carry`).
- Flow speed bleeds off on the ground (0.15 px/f in QFS) and is lost on a slam.
- Speed matters: score multiplier rises with speed (Lou Gnar's tier multiplier, but from current speed).

### Ollie and tricks

- **Jumps**: start with 2. Ground or rail ollie spends 1; an air flip trick spends 1 and gives a smaller hop.
- **Flip pop by timing** (zack, Oct 31, 2026): the sooner you tap the flip after the ollie, the higher it pops you.
  A quick double tap goes about 4.6 tiles up (148 px; the old best was about 2.8); a flip at the top of the ollie
  pops like before. The pop rides on top of the rise the ollie still has, so tapping early never wastes the ollie.
  It trades against perfect landings, which want the flip late and low. A quick double tap can't reach the sky
  route's power line yet (PHYS.trickEarly -6, easing to the old pop by frame 14; -7 would let one off a high rail
  reach it). The bots can still reach the wire on a few floors, falling onto it from a high hill ledge or rail, with
  the old flip too.
  Jumps refill on landing, on any grind, on a car-hop, and on riding off a curved rail.
- **Jump charge**: jumps are a number, not an integer (Lou Gnar's 1.75). A partial jump gives a partial hop.
  Several boons add or drain fractions.
- **Trick names** pop on screen: ollie, kickflip, heelflip, 360 flip, hardflip, shuvit. Each trick in a combo
  without touching the ground adds to the combo multiplier.
- **Landing**: land with the board under you or take a slam (see Getting hit). Landing on a slope downhill keeps speed.
  Every landing has an impact (speed into the ground along its normal) and a quality: clean, heavy (about 3 tiles to
  flat), sketchy (5.5+ tiles to flat, or a flip landed late in its catch) or a slam (stairs, or a flip barely
  started). Heavy and sketchy landings cost flow speed only. Landing into a bank that falls away soaks up any drop.
  Details: openspec/changes/pf1-physics-feel.

- **Perfect landings** (Oct 31, 2026, from OlliOlli World; built the same day): OlliOlli's tap right before
  touchdown, on our one tap. On the way down from an ollie, tap for the flip when you're nearly back on the ground
  (within 40 px of where you land). It pops you up, the board comes round, and you land PERFECT. A flip caught within
  5 frames of touching down counts too, for example flipped up onto a ledge. PERFECT rolls away at least a fifth over
  cruising speed (not stacked on speed you already have, or the wheels would wear from it), with +100, a callout and
  a burst. Flip at the top of the ollie and it's a plain clean landing. Onto a grind or rail, PERFECT starts you at
  grind speed and a bit over. Tuning: PHYS.perfectHeight, perfectFrames and perfectBoost.

### Grinding

- Flat, 45° and curved rails, plus grindable ledges and one-way grind rails (QFS's `GRIND_PLATFORM`).
- Landing on a rail from above snaps you on; you keep rolling at least at minimum grind speed.
- Grinding refills jumps, raises the speed cap, and builds **grind meter** (stoke).
- Curved rails follow QFS exactly: gravity along the curve (no player nudge), launch off the end along the
  rail's angle with the speed carried.
- Grind poses (50-50, 5-0, crooked, boardslide) change automatically every rail length, as Lou Gnar's random grind
  animations do. Each change counts as a grind trick for stoke and for boons that trigger on grind tricks.

### Manual pads

- A short floating ledge (3 tiles or less) over a water gap is a **manual pad**. Land on it clean and Lou rides it in
  a manual (back wheels down, nose up, like a 5-0 on flat ground), then ollies off the end to the next pad or the
  street.
- The manual is a trick: +120 stoke, and it keeps the combo going instead of banking it. A slam on a pad is still a
  slam. Two pieces are built around them: `manual pads` (two 3-tile pads over one canal) and `pad line` (three
  2-tile pads across a wide canal).

### Traffic (the main hazard)

Car traffic is the hazard (decided Oct 23, 2026; details still being designed). Because the game is 2.5D, the
street has depth: the skate lane is the plane you ride on, and more lanes run in front of it and behind it. Only
vehicles in the skate lane can hit you; the others are there for life and noise, and for telegraphing.

| Vehicle | Behaviour | What you do |
| --- | --- | --- |
| **Robotaxi** (same direction) | The AI's self-driving cars, slower than you. You catch them from behind. They brake hard when you get close | Ollie onto the trunk, ride the roof, hop off the hood |
| **Oncoming car** | Comes at you in the skate lane; closing speed is very high | Time an ollie over it, or land on the roof for a car-hop |
| **Cross traffic** | At intersections, cars pull out of the cross street and turn onto your road, your way | Read the traffic light and headlights; ollie it, or car-hop its roof as it turns or drives off |
| **Parked car** | Static. From floor 2, up to 3 cars a floor are parked in the back lane, behind you. As you come up, a "!" pops up over the car, and then its door flies wide open across your lane | Skate-lane cars are platforms. The back-lane door is a hazard and a launch |
| **Bus** | Long and slow, with a stop where it pulls into the lane | A long roof to manual on; the roof edge is a grind |
| **Box truck** | Dropped tailgate | The tailgate is a kicker (triggers a bomb) |
| **Enforcer cruiser / drone** | The AI's police. Comes from behind as your Heat rises (see Getting hit) | Stay fast; a drone can be car-hopped once |

- **Car-hop:** landing on any roof bounces you (Lou Gnar's UFO bounce, -750 vs a -900 ollie) and refills all
  jumps. Chaining car-hops across a traffic jam is a core skill moment.
- **Telegraphing:** headlights throw light ahead before a car arrives, horns pan in stereo, the camera's lookahead
  grows with closing speed, and oncoming cars get an edge-of-screen marker. Every car is readable at least 0.75 s
  before contact (see Controls).
- **Near-miss:** passing within a few pixels of a car without touching gives a "Close call" stoke bonus.
- **Density and speed** scale with floor depth, replacing QFS's enemy spawn curve. Later floors add oncoming
  traffic, then cross traffic, then enforcers. The rank colours become rarer, faster car types.
- **Flying hazards** from QFS (pigeons, Flock drones, UFOs in space) stay as a smaller second hazard set and can be
  car-hopped too.
- **Biome traffic:** Chicago has cabs, CTA buses and the L train overhead (its girders are grindable). LA has
  lowriders and a freeway floor. High-Tech City is all robotaxis and delivery drones. Greece has chariots,
  Atlantis has submarines and Outer Space has UFO traffic.

**Spawning** (decided Oct 23, 2026): the generator places static things and marks spots (parked cars, intersections
`X`, bus stops `B`), and a **traffic director** spawns moving cars over time. The director guarantees a clear gap
the base-physics skater can make, reacts to speed and Heat, and draws from the floor's seeded RNG so daily runs stay
the same for everyone.

### Smashables (visual juice)

Decided Oct 24, 2026 (zack): lots of stuff to smash. Every floor is dressed with small breakables, placed by the
generator on sidewalks, roofs, ledges, rails and stair sets. They are **juice, not hazards**: they never slow
you, never slam you and never stand in the way of a line. Skating well breaks more of them, so a great line
leaves a trail of wreckage behind it.

**How things break** (each prop lists which of these break it):

| Verb | What it does |
| --- | --- |
| **Roll through** | Rolling into small props at speed knocks them flying, in the direction you're going |
| **Land on** | A landing on or next to a prop crushes it; a big drop (about 4 tiles) breaks everything around you in a burst |
| **Grind** | Props on a ledge or rail get kicked off ahead of your trucks, one after another, with sparks |
| **Car-hop** | Landing on a roof pops what's on it (roof boxes, light bars) and shatters a sunroof or windscreen crack |
| **Slam** | A slam explodes whatever you hit, so even a bail looks spectacular |
| **Kicker / bomb** | A bomb's burst of speed blows props away in a cone in front of you |

**What breaks** (launch set, Chicago first; each biome gets its own dressing later):

| Prop | Where | Breaks into |
| --- | --- | --- |
| Bottles and cans | Ledges, stairs, roofs | Glass shards and a spray, a clink sound |
| Traffic cones and barrels | Street edges, roadblocks | Cones tumble and bounce; barrels spill |
| Cardboard boxes and crates | Sidewalks, alley roofs, the box truck | Flaps and splinters |
| Newspaper boxes and trash cans | Sidewalks | Lid flies off, paper flutters down |
| Planters and pots | Plazas, terraces | Terracotta chunks and dirt |
| Fruit stand / food cart awnings | Street corners | Fruit rolls, the awning tears |
| AI signage: "REPORT ALL SKATERS" boards, kiosks, delivery bots | Plazas, the street | Screens crack and glitch out, sparks |
| Flock cameras on poles | Above rails and ledges | Camera head snaps off with sparks (a COOL hook: see below) |
| Windows and glass panels | Shopfronts beside the lane, bus shelters | Big shatter, glinting shards that keep falling |
| Car glass and mirrors | Parked cars, roadblocks | Windscreen cracks on a hop, mirrors snap off on a near-miss |

**What it gives back:**

- **Feel first:** every break has a hit of particles (in the shared pool), a small camera kick scaled by speed,
  a sound, and sometimes a comic sound word (CRUNCH, KRSSH, TONK). Pieces stay on the ground for a few seconds.
- **Style points:** each prop adds a little style into the current combo (small, so smashing never beats
  skating well). A chain of smashes without touching the ground is a **Wrecking Ball** callout.
- **Cash and Stoken:** some props hide coins (newspaper boxes, crates); a rare golden prop per floor drops
  Stoken.
- **The AI's stuff:** smashing AI signage or a Flock camera cools Heat a little (the surveillance loses you),
  which gives COOL builds and STREET builds something to hunt. A boon or board mod can build on this later
  (for example a Shockwave that clears every prop on screen).
- **Never a cost:** smashing never adds Heat and never slows you.

**Rules and budget:**

- Props are tiny and readable at speed: they must never be mistaken for a hazard (no car-sized props, no
  props in the dark red hazard colours). Glass on the ground (`^`) stays the only glass that slams you.
- Old iPhone budget: props are instanced per type, breaks use the shared particle pool and a few pooled debris
  pieces, and a floor keeps a cap on live debris. No physics engine: debris is scripted arcs.
- Placement comes from the floor's seed, so a daily run's wreckage is the same for everyone.
- Work split: the gameplay thread places props and reports breaks as sim events; the effects thread makes the
  breaks (particles, debris, sound words, camera); the models thread builds the props in Blender.

### Getting hit and ending a run

There's one life, as in Lou Gnar, and hits don't kill you (decided Oct 23, 2026). Damage costs momentum, not health:

- **Slam:** clipping a car, landing mid-flip, or hitting a wall at speed. The skater wipes out, the board flies, and
  the skater is back on it in about 0.6 s. You drop to half speed, lose your combo and gain **Heat**.
- **Bail:** falling into a gap or canal ends the run immediately, as in Lou Gnar.

#### The chase (Heat)

Being chased is the game's tension (decided Oct 23, 2026). With one-button auto-run and hits that don't kill, the
chase is what makes mistakes matter, so it has to be tight: always visible, always fair, and quick to recover from.

- **The chaser is physically there.** An enforcer cruiser rides in the lane just behind the skate lane, lights and
  siren on, with Flock drones above it. Heat is simply how close it is: at 0 it's off screen to the left, and at
  100 it pulls level and boxes you in. No bar, because the car is the meter.
- **What moves it** (starting numbers, to be tuned in M2):

| Event | Heat |
| --- | --- |
| Slam | +25 at an empty stoke meter, up to +50 at a full one (see Stoke raises the stakes) |
| Each second below base speed (recovering from a slam) | +10 |
| Landed trick | −3 |
| Grind, per second | −4 |
| Car-hop | −8 |
| Near-miss | −5 |
| Clean skating, per second (no slam in the last 3 s) | −6 |
| Clear the floor | reset to 0 |

  So **three slams close together end the run**, two are a scare you can skate out of, and one is forgiven after
  about 8 seconds of clean skating (less with tricks and grinds).
- **Stoke raises the stakes** (zack, Nov 9, 2026: "heat should build up in relation to the stoke meter in the sense
  that the enemy is an ai that is detecting stoke and wants to ban that"; picked "Stoke raises the stakes" over Heat
  rising with stoke directly; built Nov 10, 2026). The stoke meter (see Scoring and stoke) is the AI's **detector**:
  how loud you are to it. Detection and catching are split: stoke sets how hard the hunt is, and mistakes still decide
  whether it catches you, so a good line is never punished, it's a bigger wave where a fall costs more.
  - **Slam Heat scales with stoke:** about +25 at an empty meter, up to +50 at a full one (replaces the flat +35).
    Slow skating after a slam scales the same way. Cooling (tricks, grinds, clean skating) does not change.
  - **Full stoke is the alarm, not a safe state.** The gnar state keeps its speed boost but **no longer makes slams
    free**: it brings the hunt up a tier for its 8 seconds (the cruiser drives faster, the chopper lifts off or the
    drones drop in, every camera snaps to you). One slam in gnar ends it (as now) and costs full Heat. Built: the
    cruiser creeps in at +3 Heat a second and clean skating doesn't cool while it lasts, and the drone drops in front.
    The chopper lifting off and the cameras snapping to you are **not in the build yet** (no street cameras exist).
  - **The escalation steps follow stoke, not Heat:** the siren layer, the cameras turning, the drone in front and the
    music thinning out come in as the detector fills; Heat keeps only the catch cues (the lights on screen, the
    pulsing edge and the vibration near 90, the cut-in at 100). Built: the siren layer comes in from half full and
    the drone drops in front at 75%; the cruiser closing in keeps a quieter siren after a slam has emptied the meter.
    The music thinning out is **not in the build yet**.
  - **The HUD sells it: one bar, two readings** (zack, Nov 9, 2026, picked over dropping the HEAT bar or keeping
    both; built Nov 10, 2026). The two mirrored STOKE and HEAT bars become **one detector meter**. Its fill is stoke, drawn as
    the AI's scan lock on you (a red grid filling toward TARGET: STOKE DETECTED at full). The cruiser rides along the
    same bar as a marker, closing in from the left as Heat rises, with the wanted stars on the marker; marker meets
    full fill = caught. One glance reads both how loud you are and how close it is, and it still works in portrait,
    where the cruiser itself is often off screen. The separate HEAT bar goes; Heat keeps its world cues (the cruiser,
    the lights, the siren, the edge pulse).
  - **The climb:** higher acts have fewer eyes, so the detector fills slower up there (one more reason to go up):
    100% of the street rate in act 1, then 85%, 72%, 62% and 55% in act 5 (`SCORE.stokeByAct`).
  - Numbers to tune on the bot: the slam range, the gnar-tier cruiser speed, the per-act detector rate.
- **Escalation, not surprise.** Every step is readable at a glance. Today: at 50 Heat the siren layer comes in and
  the cruiser's lights reach the screen, at 75 a drone drops in front and the music thins out, at 90 the screen edge
  pulses and the phone vibrates. With Stoke raises the stakes, the siren, cameras, drone and music move to the stoke
  meter and Heat keeps the lights, the pulse and the vibration.
- **Caught:** at 100 the cruiser cuts in and the run ends with a short camera beat (the board skidding away,
  the skater pinned in the headlights) before the run summary. Restart is one tap.
- **Depth:** deeper floors make Heat decay slower and add a second chaser type (a drone swarm in High-Tech City,
  a chariot in Greece). Boons like Low Profile and the Wanted curse play directly with these numbers.
- **Readable fairness:** a slam always shows its cause (the car flashes), and the chaser never moves between a
  slam and the next 0.6 s remount, so a hit never chains into an unavoidable catch.

This keeps runs fast and tense: no health bar to manage, just keep moving, but one mistake is never the end.
The Heat numbers above are a first guess and need prototyping.

#### Continues

Built Oct 25, 2026 (zack: "i want to give the player 3 Continues, before they have to start all over"). A run has
**3 continues**. A bail or a bust shows a continue card. Tap to go back to the start of the floor you fell on, as you
were when you got there: the same score, cash, gear and Heat, so dying can't farm a floor's cash twice. Boons and the
board are kept. END RUN gives up. After the third continue, the next fall ends the run as before. The HUD shows the
continues left as hearts beside the floor, and the run summary says how many were used. Quitting from the pause card
ends the run without offering one.

## Procedural generation

The generator is QFS Survivor's, ported to TypeScript and extended.

### Pieces

Each piece is 16 × 10 tiles of ASCII, starting and ending on street. QFS legend, plus additions for skating:

| Char | Meaning | Source |
| --- | --- | --- |
| `.` | Air | QFS |
| `#` | Street (last row). Anything else on the last row is a pit/canal | QFS |
| `R` | Rooftop / kiosk (one-way, building drawn below) | QFS |
| `-` | Floating ledge (one-way) | QFS |
| `^` | Spikes / broken glass | QFS |
| `r` | Curved rail end (pairs; `rail_curve` sags or arches it) | QFS |
| `=` | Flat grind rail | New (QFS has these as tiles) |
| `/` `\` | 45° grind rail up / down | New (QFS `GRIND_RIGHT` / `GRIND_LEFT`) |
| `<` `>` | Ramp / kicker (launch) | New |
| `E` | Ground hazard spawn (parked car, cones, a door) | QFS (was an enemy) |
| `F` | Air hazard spawn (drone or pigeon, can be car-hopped) | QFS (was an enemy) |
| `X` | Intersection: cross traffic and a traffic light | New |
| `B` | Bus stop: a bus pulls into the skate lane (built Oct 24, 2026: src/traffic/street.ts) | New |
| `$` | Cash line (a row of pickups that teaches a line) | New |
| `C` | Chest / stash (cash, Stoken, sometimes a boon) | QFS |
| `?` | Event spot: shrine, gap challenge, NPC | New |

All 20 QFS pieces port as tier 1–3 pieces on day one; new skate pieces (kicker gaps, rail gardens, stair sets)
are added per biome.

### Floor shape: downhill descent

Decided Oct 24, 2026 (zack): floors are **much bigger** and built for **big stair sets and big handrails**, so each
floor is a **downhill descent**. You start high up (rooftops, plazas, an overpass) and work down to the street through
stair sets, handrails, drop-offs and rooftop gaps, then finish on a street stretch with traffic and the exit.
There are **a few short uphill bits**: banks you roll up (they kick you into the air at the top) and raised ledges
to ollie onto, about one every few sections, so it never feels like a straight slide.

| Section | What it is | How you skate it |
| --- | --- | --- |
| Terrace | A rooftop or plaza run, 6–14 tiles, sometimes with a flat rail, ledge or kicker | Roll, grind, set up |
| Stair set | 4–16 steps down (1 tile run, half a tile rise per step), often with a handrail | Ollie it, flip it for the bigger sets, or grind the handrail. Landing on the steps is a slam |
| Big handrail | A long straight rail down a stair set; gravity speeds you up and launches you off the end | Ollie onto it at the top |
| Drop-off | A ledge 2–10 tiles high onto the next terrace | Roll off, or ollie for style |
| Rooftop gap | A 2–5 tile gap between buildings, sometimes onto a lower roof | Ollie or flip it; falling in is a bail |
| Bank | A ramp up to a higher terrace, 1–3 tiles | Roll up; it launches you at the top |
| Street finale | 2–4 QFS street pieces at street level: canals, curved rails, parked cars, traffic | The traffic and chase section, then the exit gate |

Floor 1 is about 150 tiles long and starts about 14 tiles up; each floor adds length and height, so later floors
have the 16-stair sets and the longest handrails. The validator still skates every floor with base physics.

### Floor recipe

1. Seed the RNG with `runSeed + floor × 7919` (as QFS does). Daily runs use the date as `runSeed`.
2. Pool pieces by tier (`maxTier = min(3, 1 + (floor − 1) / 2)`), weight the newest tier ×3, no repeats.
3. `clamp(3 + floor, 4, 12)` pieces between the start piece and the exit piece.
4. Stitch into one grid; place hazards on `E`/`F` with QFS's spawn chance `min(0.45 + 0.08 × (floor − 1), 1)`,
   ranked every 3 floors.
5. Place rails, cash lines, chests, a halfway checkpoint on floors of 7+ pieces.
6. **Validate**: run a reachability check with the run's *base* physics (no boons), simulating ollie and double-jump
   arcs at cruise speed, as Lou Gnar's `GAP_MAX` math does. If a piece boundary isn't clearable, swap the piece.
   Boons only ever make floors easier to traverse, never required.

### Biomes

Superseded Oct 24, 2026: one fused world, no biomes (see Run structure 2). What the worlds brought to play is kept
as **floor twists** (src/gen/twists.ts). Act 1 has none; from floor 4 on, about half the floors roll one by seed:

| Twist | From | What it does |
| --- | --- | --- |
| Grinds | Clemente Park | Rail pieces come up twice as often |
| Columns | Ancient Greece | Curved rails three times as often; most floating ledges are ruins that crumble after you land |
| Currents | Atlantis | Stretches where the wind pushes you forward or back in the air |
| Ceiling | Art Museum | A low ceiling (a tunnel) over the street: no high flips, more grind lines |
| Conveyors | High-Tech City | Some flat rails run forward (faster) or back (slower) while you grind |

District gravity (Atlantis 0.8, Space 0.6) is dropped: gravity follows the act instead (see the climb, step c).

## Boons

After every floor you pick 1 of 3. Cards keep QFS's layout: a coloured type label, a name, a big effect line, an
optional small line, an icon, a max stack and a `when()` filter. The types change from DEFENSE / DAMAGE / LUCK /
SPEED to skate types:

| Type | Colour | Bends |
| --- | --- | --- |
| **POP** | Yellow | The ollie: height, hang time, number of jumps, jump charge |
| **GRIND** | Orange | Rails: speed, magnetism, what happens on enter / exit |
| **FLOW** | Cyan | Speed, momentum, landings, slopes |
| **LUCK** | Green | Cash, Stoken, rerolls, shop prices |
| **COOL** | Blue | Heat, slams, bails |

### Starting boon pool (draft)

The pool as it stands after the overlap pass (Nov 6, 2026, below).

| Boon | Type | Effect | Max |
| --- | --- | --- | --- |
| Triple Threat | POP | +1 jump (QFS Triple Jump) | 1 |
| Big Pop | POP | +20% ollie height, and keep holding after an ollie and gravity drops 30% after 0.25 s, so you float (took in Mad Pop) | 3 |
| Rail Magnet | GRIND | Rails pull you in from 48 px further away | 2 |
| Ledge Butter | GRIND | +25% grind speed, minimum grind speed doubled | 2 |
| Full Sail | GRIND | Ollieing off a rail adds your grind speed to the ollie height, and riding off a rail's end launches ×1.5 (took in Slingshot) | 1 |
| Sparky | GRIND | Grinding leaves sparks that make cars swerve out of the skate lane | 1 |
| Ghost Rail | GRIND | Your last grind leaves a 2 s ghost rail behind you in the air | 1 |
| Roof Rider | GRIND | Car and bus roofs grind like rails (was STREET's) | 1 |
| New Wheels | FLOW | +20% base speed and +20% score (QFS New Wheels) | 2 |
| Butter | FLOW | Landing on flat ground keeps 100% of air speed, and flow speed bleeds off half as fast (took in Bomb Hill) | 1 |
| Firecracker | FLOW | Roll into a stair set without popping and you ride it down in a manual, the tail clacking on each step, instead of slamming. Ollie out any time | 1 |
| Double Stoken | LUCK | 2× Stoken, and pickups fly to you from 3× as far (took in Stoken Magnet) | 1 |
| Hustler | LUCK | +1 card on every boon pick | 1 |
| Low Profile | COOL | Heat rises 25% slower (QFS Tough Skin) | 3 |
| Bubble Pads | COOL | The first slam each floor costs no speed and no Heat (QFS Bubble Shield) | 2 |

### The cut and the gear boons (Nov 6, 2026)

zack, Nov 6, 2026: the boons were bloated and didn't matter, and by acts 3-4 the board was worn out well before the
next skate shop. So 16 cards went and three gear boons came in. Every card is hand drawn by zack, so fewer cards is
less art too (NO BLOAT).

- **Why these 16:** the playtest bot skated 24 floors (6 seeds, floors 2, 5, 8 and 11) holding each boon against
  none. Late Flip, Spare Change, More Wax, Butter, Kicker Boost, Tuck and Roll, Slam Stoke, Siren Song, Decoy,
  Ghost Mode, Slipstream, Hood Pop, Spoofed Plate and Jaywalker changed nothing measurable; Boostin overlapped Mad
  Pop and Speed Cream overlapped Bomb Hill. zack picked the lean cut: **Late Flip, Spare Change, More Wax, Decoy,
  Siren Song, Spoofed Plate, Lucky Reroll, Ghost Mode, Boostin, Speed Cream, Jaywalker, Slipstream, Hood Pop, Kicker
  Boost, Slam Stoke, Tuck and Roll.** Their code went with them (and the "Ride 2 slipstreams" mission). Butter
  stays: it's half of Perpetual Motion. The bot never holds a button, falls in a gap or runs Heat high, so it
  can't show what a skilled player gets from a card; that's a reason to keep the cut lean, not a verdict on every card.
- **What was left then:** 19 boons (POP 5, GRIND 4, FLOW 7, COOL 2, LUCK 3, STREET 1, counting the gear boons), 3 curses, 3
  duos: 25 cards, from 41. A boon street whose type has fewer cards left than the offer fills up from the other types.
- **The gear boons** (one stack each, offered from floor 2's pick on, in every library whatever types the meta tree
  has opened):

| Boon | Type | Effect |
| --- | --- | --- |
| Fiberglass Core | POP | Your deck wears half as fast, and every new deck you buy |
| Shoe Sponsor | POP | Your shoes wear half as fast, and every new pair you buy (zack, Nov 6: the shoes' card) |
| Ceramic Bearings | FLOW | Your bearings wear half as fast, and every new set you buy |
| Classified Urethane | FLOW | Your wheels wear half as fast, and every new set you buy |

  Trucks have none: they wear the least (zack). Half is a default (`GEAR_BOON_WEAR` in src/boons/mods.ts) to tune.

### The overlap pass (Nov 6, 2026)

zack, the same day: "i still feel like our boons are totally bloated". Several cards said the same thing, so each
idea now lives on one card:

- **Big Pop** took in **Mad Pop** (more air: higher ollies, and holding floats).
- **Full Sail** took in **Slingshot** (leaving a rail launches you harder, more the faster you grind).
- **Butter** took in **Bomb Hill** (keep your speed: land with your air speed, and extra speed fades half as fast).
- **Double Stoken** took in **Stoken Magnet** (more Stoken: each counts twice, and pickups fly to you).
- The three gear boons stay separate: zack wants gear wear to matter more than the other upgrades (the gear thread owns them).
- **Roof Rider** moved to GRIND; STREET, a type with one card, went (and its meta pack). Roxy's first pick is GRIND.
- **Strong Legs** was cut. The plan was to make its quick re-ollie every landing's rule, but then a double tap
  off a high ledge reached the power line from below (the top route only lets you down onto it from the sky), so
  landings keep the 350 ms impact for everyone.
- The duos re-pair: **Perpetual Motion** is Butter + Full Sail. The board mod **Jump Refill** went (Double Pop is
  the extra-jump effect).
- **Left:** 18 boons (POP 4, GRIND 5, FLOW 5, COOL 2, LUCK 2, counting the four gear boons with Shoe Sponsor), 3 curses, 3 duos: 24 cards. The curses echo Big
  Pop, New Wheels and Double Stoken on purpose: a curse is a strong version with a catch.

### Combos (duo boons)

When you hold two specific boons, a third, rarer card can appear that fuses them, in the spirit of Hades duo
boons and Noita's spell interactions. Examples:

- **Full Sail + Big Pop → Rocket Grind:** ollie off a rail at max grind speed and you launch straight up, refilling all jumps at the top.
- **Ghost Rail + Triple Threat → Sky Line:** every air trick leaves a short ghost rail under you.
- **Butter + Full Sail → Perpetual Motion:** flow speed never decays (Butter + Slingshot until Nov 6, 2026).

### Curses (trade-offs)

From floor 6, one card in three may be a **cursed** boon: a strong effect with a cost, shown with a purple border.
Examples: *Moon Shoes* (+60% ollie height, −30% grind speed), *Wanted* (2× Stoken, Heat rises twice as fast),
*Speed Wobbles* (+40% speed, landings above flow speed cause a slam).

Built Oct 24, 2026: the three curses and three duos above. From floor 6, one offer in three swaps its last card
for a curse (dashed purple border, labelled CURSED). A duo shows up half the time as an extra, pink card once you
hold both its halves. Speed Wobbles slams any landing faster than 1.3x your cruising speed. Rocket Grind needs a
grind at full grind speed (5 px/frame) and pops 1.5x. The underground spot's "Remove a curse" lifts one whole.

## Board build (the Noita part)

Noita's wands take spells in slots that fire in order and modify each other. Our board does the same with
**mods**, bought at the Skate Shop every 3 floors with run cash.

- A board has **slots** (start with 3). Each slot holds one mod.
- Mods are **triggers** and **effects**. A trigger (On Ollie, On Land, On Grind, On Trick) fires the effects that
  follow it in the slots, left to right, until the next trigger.
- Effects: Double Pop (a second small ollie 0.2 s later, once a jump: it comes back when you
  touch ground or a rail; fired off every dead flip it flew a whole floor, zack 2026-11-08), Speed Kick, Cash Burst, Shockwave (makes nearby cars
  swerve out of the skate lane), Patch Job (+5 to your most worn gear part, at most 6 times a floor, so the board
  can feed the gear without wear stopping mattering).
- Modifiers change the next effect: ×2, Only On Combo ×5, Chance 50%.
- Example build: `[On Grind] [×2] [Speed Kick]` = every time you lock onto a rail you get two speed kicks.
- **Trimmed Nov 6, 2026** (zack: "i wonder if our board mods are also bloated?", picked the cut from a card): 17
  mods down to 12. Cut: Spark Trail (+50 style was nothing), Slow-mo (bullet time already does it), Gravity Flip
  (hard to read), Delay (rarely helped), On Grind End (Full Sail covers leaving a rail) and On Car-hop. Patch Job
  added, so the board can help the gear, which matters most.

Boards also have **base stats** (from the deck you pick): pop, grind grip, speed, weight, slots. Decks are
unlocked in the meta tree. The shop also sells a Heat cool-down, a boon reroll and a slot.

This is the deepest system and the riskiest one for scope. Decided Oct 23, 2026: a **light version ships at launch**
(3 slots, about 6 triggers and 8 effects, no modifiers), built after boons are fun (see Milestones). Modifiers,
extra slots and a bigger mod pool come in updates.

Built Oct 24, 2026 (overnight): the four modifiers, sold in the shop. A modifier changes the next effect after it
in the slots; several stack (Times Two then Coin Flip is 0 or 6). Times Two fires it twice, Delay fires it 0.5 s
later, Combo Only (COMBO 5+) fires it only in a combo of 5 or more and then twice, and Coin Flip (50/50) fires it
not at all or three times. A trigger with nothing after it still does nothing.

Built Oct 24, 2026 (light version): 3 slots (up to 5 at $300 each), 6 triggers and the 8 effects above. A trigger
fires the effects to its right until the next trigger; an effect with no trigger to its left does nothing. The shop
stocks 4 mods (at least one trigger and one effect) for $100 to $225, a slot and a restock ($10, then +5). Tap a mod
then a slot to buy it there; tap two slots to swap them for free. The board shows as a strip of slots bottom left,
and a slot flashes when it fires. No Heat cool-down or boon reroll in the shop yet.

Prices raised Nov 9, 2026 (zack: "the first time you get to the skate shop the lowest priced board upgrade should
be $100"): every mod and the slot x5, so the order holds. Triggers $100 (On Trick $125), effects $125 to $225,
modifiers $125 to $225, +1 Slot $300. Gear prices unchanged, so the first shop (about $260 for the bot) fixes worn
parts first and buys at most one mod. Prices are flat across shops while income per floor roughly doubles by acts
3-4, so mods get easier to afford later.

## Gear and wear

**Gear comes first** (zack, Nov 6, 2026): keeping your setup rolling should matter MORE than the other upgrades
(boons and board mods). A worn-out board is the run's main pressure, the gear boons (Fiberglass Core, Shoe Sponsor,
Ceramic Bearings, Classified Urethane) are the strongest picks for a long run, and shop cash should mostly go on
parts. When a choice between gear and another upgrade comes up in tuning, gear wins.

zack, Oct 24, 2026: your gear wears out with use and has to be replaced at the shop. Five parts (bearings added
Oct 30), each worn by the thing it takes the beating from:

| Part | Worn by | When it's worn |
| --- | --- | --- |
| **Deck** | Hard landings most (zack, Oct 30: impact from gravity, worst landing against your momentum so it costs you speed: 0.18 per px/frame of impact over a soft landing, plus 0.4 per px/frame of speed lost), smashing breakables (zack, Oct 31: 0.15 each rolled or ground through, 0.3 landed, hopped, slammed or bombed), ollies (0.4 each) and puddles (2 each) | Ollies pop lower, down to −30% at 0 |
| **Shoes** | Flip tricks (the flick scuffs the grip side) | Flip tricks in the air pop lower, down to −30% |
| **Trucks** | Grinding (every second on a rail, ledge or roof edge) | Grinds settle slower, down to −30% |
| **Wheels** | Going fast (every second above 1.25× cruising speed: rail exits, bombs, kickers), and broken glass (8 a stretch) | Under 50, broken glass slams you instead of crunching under the wheels, and grass strips across the street bog you down (up to −40% on dead wheels, none at 50 or better); puddles bog you down more (6% of your speed on fresh wheels, 45% on dead ones); cruising speed drops a little, down to −7% |
| **Bearings** | Puddles (12 each), dirt (0.3 every second rolling on the ground), and the dust and shards of smashing wood, stone or glass props or rolling over broken glass (1 each) | Cruising speed drops, down to −20%: the main speed part (zack, Oct 30) |

- **Condition** runs from 100 (fresh) to 0. A part costs you nothing until it's half worn; below 50 the cost grows
  in a straight line to the most it can be at 0. Nothing ever breaks outright or ends a run: busted gear makes the
  street harder, so it's a pressure, never a wall.
- **How fast:** tuned so that by the first skate shop (after act 1's three floors and its escape) about 2.5 of
  the parts are worn past half and want replacing (zack, 2026-10-30; still about 2.5 with bearings added). For the reference bot (which skates as
  little as it can) that's the wheels and deck well past half, the shoes about half the time, and the trucks not yet
  (the bot grinds little); its bearings sit around 83, since balance runs have no rain. A part you lean on loses about 20 to 40 a floor. Your build decides what wears: a grind
  build eats trucks, a flip build eats shoes. `npm run balance` prints the first-shop count.
- **The run keeps it:** wear carries from floor to floor and resets with a new run. Fresh gear every run.
- **The shop** always has a gear row under the mod stock: New Deck $80, New Shoes $90, New Trucks $70, New Wheels
  $50, New Bearings $80 (zack, 2026-10-31; were $25/15/20/15/15). The bot reaches the first shop with about $260
  (pickups plus act 1's $45) and about $215 of worn parts to replace, so fixing everything leaves little for mods. A new part is back to 100. You can't buy a part that's still fresh. This puts a real choice on shop cash:
  a new mod, or keep your setup rolling.
- **HUD:** five bars in the GEAR WEAR panel, bottom right (DECK, TRUCKS, WHEELS, BEARINGS, SHOES), green while fresh,
  yellow once a part starts costing you and red, blinking, from 15. A callout fires when a part wears past half
  ("SHOES WORN") and again near the end ("DECK BUSTED!").
- **Looks (models and effects threads):** worn parts should show on Lou: a chipped, delaminating deck nose and
  tail, scuffed shoes with a hole in the ollie spot, rusted, ground-down truck hangers, and coned, flat-spotted
  wheels. A part going past a line could pop a small puff of splinters, a shoe scuff or rubber crumbs.
- **Acts 3-4 (measured Nov 6, 2026):** a floor wears gear about twice as hard late in the run as in act 1 (the
  deck and wheels lose 35 to 45 a floor by acts 3-4, against about 20). Buying every part at every shop, the bot
  still reached the floor 9 shop with the deck at 4, wheels 12 and shoes 16. The gear boons (see Boons) halve the
  deck, bearings and wheels, which puts them back near act 1's numbers at that shop (deck about 52, wheels about 56),
  and Shoe Sponsor does the same for the shoes (about 58).
- **Supply pickups on long routes** (zack, Nov 6, 2026): once routes get longer, a
  single-part replacement lies along the way now and then: a new deck, a pair of shoes, a set of wheels, bearings
  or trucks, ridden through like a coin and fitted on the spot (that part back to 100).
  - **A fixed part you can see:** each pickup is one part, shown from afar as that part's own model spinning in
    the air, so you know what it is and decide whether to go for it.
  - **Rare, and only when you need it:** a part's chance to spawn builds up the longer that part has been busted
    (at 0, or under the busted line of 15) and is none while it's in good shape, so good gear never sees one. The
    clock resets when the part is replaced (shop, pickup). A part you've ridden busted for a long time is the most
    likely to turn up.
  - **As built** (src/sim/supply.ts, SUPPLY): once a second the most overdue busted part rolls a chance that
    ramps from 0 to 1 in 50 over its first 60 s busted (so about one pickup a minute once it's been busted that
    long). One pickup at a time. It is put on the highest coin or pickup spot 12 to 26 tiles ahead, so the harder,
    higher line is where it shows up. It's gone if you ride past it or the part stops being busted (a shop buy).
    Grab it within 30 px: callout "SUPPLY! NEW DECK", that part back to 100, its clock reset. Not in the tutorial.
    The busted clocks carry from floor to floor with the gear.
  - **Look:** the shop's card models (shoe, truck, wheel; cut down into public/models/gear.glb), the game's board
    for the deck, and a bearing built in code, spinning in a turning gold ring over a pale disc so a dark part
    reads against a dark wall.
- **Later:** decks from the meta tree can wear slower (a "pro deck" stat), and boons can play with wear (a curse
  that wears gear twice as fast for a big effect, or a LUCK boon that repairs a part on each floor clear).

## Meta progression

**Stoken** (the QFS currency, kept for the universe) is earned in runs and kept when you bail. It is spent on an
**unlock tree** with three branches:

- **Deck shop:** new decks (stats and slot counts), new skaters (Webster is the free starter; then Roxy, Keanu,
  Goldie, and Lou Gnar last and priciest, zack 2026-11-08). Each skater has one small passive and leans the first boon pick toward one type (decided
  Oct 23, 2026; draft passives below, to be balanced).
- **Boon library:** unlocks boons into the pool. A run starts with 12 of the boons above; the rest are unlocked.
  Also unlocks duo boons and curses.
- **Spots:** unlocks biomes as starting points (after you've reached them), daily runs, and a "gnar mode"
  (harder: traffic one rank up, better Stoken).

| Skater | Passive (draft) | First boon pick leans to |
| --- | --- | --- |
| Webster (free, the default) | None: the baseline | GRIND |
| Roxy (30) | Car-hops bounce 20% higher | GRIND |
| Keanu (40) | Heat cools 15% faster while you're airborne | COOL |
| Goldie (50) | +25% cash from every source | LUCK |
| Lou Gnar (60) | Grinds start 15% faster | POP |

Built Oct 24, 2026 (first version, src/run/meta.ts): an UNLOCKS screen off the run-over screen. Skaters cost 30
to 60 Stoken with the passives above. Decks: Popsicle (stock, 3 slots), Cruiser (+10% speed, ollies 5% lower,
25), Downhill (+15% speed, gear wears 30% faster, 35; called Bombhill till Nov 8), Slab (4 slots, ollies 8% lower, 45). Boon library: POP and
GRIND to start; FLOW, COOL and LUCK packs (15 to 25) add their boons and their road signs; Curses (35) and
Duos (40). Spots: the daily run (20; one seed per UTC day, its own best). Biome starts and gnar mode are still to
come. See docs/overnight-decisions.md.

Reordered Nov 8, 2026 (zack): Webster is the free starter and Lou Gnar the last, priciest skater (60). Webster
took Lou's "baseline" (no passive) and Lou took Webster's 15% grind speed, so the free skater stays plain and each
paid one is a small trade. Each kept their own first pick. Saves from before keep Lou and get back the 30 Stoken
they paid for Webster (src/run/save.ts, moveCrew).

Each deck has its own shape (Nov 8, 2026, from zack's references; art/board.py builds all four, board.glb and
board-<id>.glb): the Popsicle as before; the Cruiser wide with a pointed nose and a square tail, orange underneath
with a bolt; the Downhill a slalom deck, narrow, the nose tapering straight to a point, nearly flat, plain red with
amber wheels; the Slab an 80s pool deck, wide with a waist above the tail, two grip patches with bare deck between,
blue wheels and blue plastic underneath (rails, a nose guard, a tail skid), a red, blue and yellow sunburst. All keep
the seven coloured plies on the edge. You ride your deck's shape; the shop's new deck graphics go on whichever
you ride.

### The ship hub

Built Nov 6, 2026 (the climb's step e; src/ship/). The run summary goes up over the inside of the Pleiadian ship's
glass dome instead of the street. The crew built a DIY spot there from city scrap: a pallet quarter pipe, a rail
that was a WEBSTER AVE street sign laid on two cinder blocks, cones, milk crates, and the Flock camera they pulled
off its pole (NO SIGNAL on its screen). In the middle stands the **Stoken core**, the Stoken particle the size of a
room: its flame is the ship's fuel and burns bigger the more Stoken you've banked (full at 300). Earth hangs outside
the glass. Every skater you've unlocked is aboard, dancing to the title music's beat, the one you ride out front
twirling their board; the ones still locked stand as dark silhouettes, heads down, still asleep. Opening UNLOCKS
moves the camera in on the crew, and a skater bought there wakes up in their spot. It's cosmetic only: the summary,
the dice, UNLOCKS, the daily run, the scores and the Gnar levels are all as they were. The skaters' models are the
ones the game already ships; they load in the background a few seconds into the first run (before then the summary
shows over the street, as it used to). `?ship` shows the hub on its own (`?ship=crew` framed on the crew).

**The Pleiadians** (built Nov 10, 2026, from zack's two references) are the ship's own crew, about ten of them
standing round the back of the deck behind the skaters: tall, long blond hair, a blue bodysuit with a high collar and
the pink eight-point star on the heart, a pale blue cape, tall blue boots. Three looks so the deck isn't one person
cloned (platinum hair and an orange sash; golden hair and pink cuffs; a woman with white-gold hair to the waist), and
each one has their own height and idle: talking in pairs and threes, nodding along, looking up at the stars through
the dome, one raising a palm to you. Cosmetic only. Built with the blender bot (`build_pleiadian.py`), under 600
triangles each.

Small permanent stat buffs are kept rare and capped (for example Heat starts 10% lower, a free reroll per run), so
skill and builds stay the point, not grinding the tree. Unlocking is mostly *more variety*, not *more power*.

### Missions (from Jetpack Joyride)

Added Oct 31, 2026 (zack picked it from the Jetpack Joyride ideas). Three missions are always showing, on the pause
card and the run summary, like "grind 3 rails in one combo", "dodge 5 guard bullets", "land a nollie heelflip off a
nosegrind", "smash 10 props in one floor" or "car-hop 4 cars without touching the street". Finishing one pops a
callout mid-run and swaps in the next mission right away. Missions carry over between runs until they're done.

- **Skater Rank:** every 3 missions done raise your rank. Each rank pays Stoken, and some unlock a cosmetic (a board
  graphic, a colourway, a trail). Ranks give no stat power, in line with "more variety, not more power".
- **The pool** is written so each mission teaches something the game already has: tricks and stances (fakie,
  nollie, 180 flips), grinds and manuals, traffic (car-hops, close calls, door slams), the chase (bullets, Heat),
  the high routes, boons ("finish a floor with 3 GRIND boons") and gear ("clear a floor without busting a part").
  Early ranks get the easy ones.
- **A skip:** any mission can be skipped for a little Stoken, so nobody gets stuck on one they hate.

Built Oct 31, 2026 (src/run/missions.ts, src/ui/missions-panel.ts): 44 missions in 7 tiers, each counted per combo,
floor, run, across runs, or as a best. A rank pays 10 + 5 per rank Stoken (up to 50); ranks 2, 4, 6, 8 and 10 put a
grip colour the shop never sells on the board (Gold, Camo, Navy, Teal, Chrome). A skip costs 3 Stoken. The playtest
bot and the tutorial floor don't count.

### Street dice and the Match (the end-of-run payout)

Changed Nov 3, 2026 (zack: the slot machine "reads very out of place", dice are street). Every run, won or lost, ends
with a roll of **two dice on the street** under a street lamp, before the summary. **Chips** (red casino chips, the old
spin tokens) turn up rarely in runs, and each one found adds a roll. The point is to give the player something even
when they lose, and the **Match** (from pinball) is the rare roll that feels huge.

**Every roll is a combo** (zack, Nov 8, 2026: "i dont understand how i earned something from this insignificant
roll"). Each roll is named in street craps slang over the dice, and a paytable under the title lights the combo it
made, so you always see why it paid what it did:

| Combo | Dice | Odds | Pays |
|---|---|---|---|
| **BOXCARS**, the MATCH | 6-6 | 1 in 36 | next run starts with 5 hearts instead of 3 |
| **DOUBLES** | any other pair | 5 in 36 | snake eyes (1-1) a grip colour; 2-2, 3-3 a $40 head start; 4-4 a free boon; 5-5 a saved continue |
| **YO-LEVEN** | 5-6 | 2 in 36 | $40 head start |
| **LUCKY SEVEN** | any 7 | 6 in 36 | 8 Stoken |
| **STRAIGHT** | two in a row: 1-2, 2-3, 4-5 (3-4 is a seven, 5-6 a yo-leven) | 6 in 36 | 4 Stoken |
| **NO DICE (n)** | anything else | 16 in 36 | 1 Stoken, a scrap (its name and prize are grey) |

Continues held for the next run cap at 2, so past the cap the Match pays 25 Stoken (and 5-5 pays 10).

**One pair at a time** (zack, Nov 6, 2026): the free roll first, then a roll per chip. The chips left show as a row
of red chips under the title ("ROLL 2 OF 4", "x2 CHIPS LEFT"). Once a pair lands, a tap claims its prize: it lifts off the
curb and flies into its spot in the WON row at the bottom (zack, Nov 8, 2026: so you see what you're earning); then the next chip pops out of the row, flies down flipping to your hand and turns
into the next pair of dice, so you can see what the chips are for. After the last prize flies in, the WON row stays up with CONTINUE, and a tap goes on to the summary.

**Real physics** (zack, Nov 10, 2026: "it would be cool if it was actual physics. like if there was a 3d ground, and
the dice actually threw based on the players finger swipe or shaking the phone"). The dice are thrown onto a real 3D
patch of night street: asphalt, the curb and the sidewalk along the back, under a sodium lamp that casts their
shadows. They are two rigid bodies (cannon-es): they fly, tumble, bounce off the asphalt, the curb and each other, and
**whatever lands face up is the roll**; nothing is decided ahead of the throw. Invisible walls at the edges of the view
keep a hard throw on screen in portrait and landscape. A die that comes to rest cocked (leaning on the curb or on the
other die) doesn't count, like on the street: it gets a nudge until it lies flat. The physics was tested fair: every
face comes up about as often over hundreds of throws.

Three ways to throw:
- **Swipe**: put a finger on the street and the pair goes under it (it follows your finger while you hold); swipe up
  the street and let go, and the dice fly the way you swiped and as hard (a short flick is a soft toss, a long fast
  swipe a hard one; a swipe sideways or back still sends them up the street). Works with a mouse drag on a computer.
- **Shake**: the pair rattles in your hand while you shake the phone; three hard jolts throw it, harder the harder you
  shook (zack, Nov 4, 2026). On an iPhone motion needs a tap to allow it, so the first tap or swipe asks and shaking
  works from then on.
- **Tap**: a tap that doesn't swipe, the ROLL button or Space tosses the pair up the street (the desktop fallback).
A tap while the dice tumble runs the same physics to the end at once (no waiting; the result is still the physics').
Reduce motion does the same on every throw.

On a phone held sideways the words and the paytable sit down the left and the street fills the right, top to bottom.

Built Nov 3, 2026, 3D and shake Nov 4, physics Nov 10 (src/run/dice.ts, src/run/dice-physics.ts, src/ui/dice-panel.ts, src/render/dice3d.ts; chips are placed by src/gen/spin-tokens.ts): one free roll
plus one per chip, 6 rolls at most. A chip is found in a smashed prop now and then (15% of floors), at the top of a
side line a quarter of the time, on the top route, in the sky and DIY stashes, from the golden pigeon and the sewer
alligator. Chips found on a floor you continue from are lost with the rest of that floor. No dice sound yet (the
throw and the landing are silent; a rattle and a clack on the curb would sell it).

**Later (not built yet): the pinball last chance.** zack's idea (Nov 3, 2026): when your last heart is gone, a mini
pinball table (tap the left or right half for the flippers) instead of the run just ending. Beat a target score and
you skate on from the floor you bailed on; miss and the run ends as usual. It has its own Match: rarely, the last
digits of your pinball score match and the next run starts with extra hearts. Styled as the pinball machine in the
title scene's skate shop. Held for later because it's a second game inside a one-tap skate game and a big build
(ball physics, a table, tuning); the dice cover "something even when you lose" for now.

## Monetization: grind or pay

Decided Nov 2, 2026 (zack picked "free + skip the grind + chapters"). The game is **free to play**, and everything
the unlocks screen sells can be earned by playing. Money buys time and style, never power. **(Not in the build
yet:** none of the store exists; this is the plan.)

What's sold:

1. **Stoken bundles.** Skip the grind: buy Stoken and spend it on the unlocks screen (skaters, decks, boon packs,
   the daily run), the same things missions, the street dice and runs already pay for.
2. **The Supporter pack** (one purchase, about $4.99): no ads ever, 2x Stoken from every source, and a supporter
   grip. The "I like this game" buy from Alto's Odyssey and Jetpack Joyride.
3. **Cosmetics:** outfits, board graphics, grip colours, trails. Bought with Stoken, or some only with money. Pure
   style, no stats.
4. **Story chapters** (see Chapters below): new narratives sold as packs (about $2.99 each), and also unlockable
   with a large pile of Stoken so a player who grinds gets them too.

Rules:

- **Never sell power.** No boons, stat buffs, continues or head starts for money; that would break the roguelike.
  Rank grips and other earned-only rewards stay earned-only.
- **Never sell luck.** Chips and dice rolls can't be bought with real money (app stores and some countries
  treat paid random rewards as gambling). The dice only ever roll for runs played and chips found in them.
- **Grinding stays fair.** A player who never pays can earn every skater, deck and boon pack, and every chapter,
  at a pace that feels like progress (target: tune with the playtest bot once prices exist).
- **Ads stay paused** (zack, Oct 31, 2026). When they come back they're the optional kind only (watch one for a
  reward), and the Supporter pack turns them off.

### Where it launches first: CrazyGames
zack picked the CrazyGames web portal first (Nov 4, 2026). `npm run build:crazygames` makes the uploadable zip with
their SDK wired in: loading and gameplay start/stop, a celebration on an escape or a new best, the site's mute, and
saves through their Data module. On the portal the game has no full screen switch, no leaderboard and no dev tools.
The ad calls are in place but switched off (ads still paused). Details and limits: `docs/CRAZYGAMES.md`. The upload,
store art and Basic Launch submission are zack's, on the CrazyGames developer portal **(not submitted yet)**.

### Chapters (story packs)

The five-act escape (see How a run ends) is **Chapter 1**, free, with its ending. Each later chapter is a new
narrative: a new escape with its own acts, set pieces, a city mix, and a new skater or two. It plugs into the same
skating, boons, gear and meta, so Stoken and unlocks carry across chapters. Endless and the Gnar levels stay free.
The story is the Skate Escape fantasy (see Setting: skate up out of a mind-controlled AI city to the Pleiadian
ship); later chapters continue from there. Chapter 1's ending cutscene (see Cutscenes) is where Chapter 2
is teased.

## Scoring and stoke

- **Score** = tricks × combo × speed multiplier + floor clear (`250 × floor`, QFS) + Stoken grabbed.
- **Combo** builds with tricks, grinds and car-hops without touching the ground; landing banks it.
- **Stoke meter** fills with the combo. Full stoke gives a short "gnar" state: speed up, and the AI's alarm.
  A slam kills the meter (zack, Nov 3, 2026): it empties, and a slam in the gnar state ends it. The meter is also
  the AI's stoke detector (decided Nov 9, built Nov 10, 2026; see The chase: Stoke raises the stakes): slam Heat
  scales with it, gnar is the alarm tier and its free slams are gone.
- **Leaderboards:** deepest floor, high score, daily seed. Port `api/leaderboard.ts` and `leaderboard-service.ts` from excaliburSkate. Built Oct 24, 2026: api/leaderboard.ts over a Redis store (Upstash), boards for score, deepest floor and each day's daily run; it needs a store connected on Vercel.

## Presentation (3D)

The game is 3D in JavaScript, as a **2.5D side view** (decided Oct 23, 2026). Everything is 3D models and
lighting, but the skater rides on one plane, left to right, so the QFS physics and the chunk generator work in
x and y and the z axis is only for looks.

- **Camera:** a perspective camera to the side and slightly above, about 15° down. It leads ahead and pulls back
  and widens its field of view at high speed. For big airs and curved-rail launches it swings a little toward a
  three-quarter view for drama, then swings back.
- **World:** each ASCII piece becomes a strip of 3D kit pieces: street, curb, kiosk, rooftop, ledge, rail, stairs,
  kicker. Depth comes from real background buildings, props and skyline instead of parallax layers.
- **Storefronts (zack, Nov 2, 2026, from his photos of New York fronts):** a pizza place (Mama Lou's), a tattoo
  shop (Iron Halo) and a liquor store (Night Owl Liquors) stand in for the wall at the back of the sidewalk, 1-4 a
  floor on plain stretches of street (never at a cross street, a landmark, a building or ledge out on the street, a canal,
  the hill or near the gate), the same kind of prop as the skate shop's GNAR SUPPLY. Our own names; the signs are
  painted in the game, so a name is one line to change (src/render/storefronts.ts). The title's corner building has
  the three along its ground floor.
- **Art style:** low-poly geometry wearing Quest For Stoken's own pixel textures (see Art pipeline below), so the
  3D world looks like the Stoken world. Decided Oct 24, 2026: a **comic ink** look, toon shading in flat bands
  plus thick black outlines drawn per mesh (no full-screen pass), matching the comic slam burst and cheap on phones.
- **Skater:** one rigged human model (Lou Gnar first) whose animations are built from Lou Gnar's sprite frames
  (see Art pipeline). Flip tricks spin the board as a separate object, so new tricks are mostly code.
- **Hair and t-shirt physics (planned, later; zack, Oct 24, 2026):** the skater will show hair and a t-shirt,
  not only the astronaut suit (helmet off, or other skaters' outfits), and both get secondary motion: hair and
  shirt hem trail back with speed, lift on an ollie, flop down on a landing, whip on a slam and ripple at flow
  speed. Cheap on phones: a few spring bones (a short chain per lock of hair, a few on the shirt hem) stepped
  with the sim, not cloth simulation. Not built yet; the models thread owns it when it's picked up.
- **Traffic:** low-poly cars, buses, trucks and enforcer cruisers with working headlights, brake lights and
  indicators, plus drones and pigeons. Rank colours become paint jobs and an emissive outline (QFS's rank outline).
- **Juice:** squash and stretch on the model, landing dust and grind sparks as GPU particles, trick name text,
  camera shake on slams, a speed-lines effect at flow speed.
- **Lighting:** one directional light with baked ambient occlusion on the kit; a real-time shadow only under the
  skater (a blob shadow on low-end phones).
- Landscape, rendered at device pixel ratio up to 2 and scaled down automatically when the frame rate drops.
- Music per biome; reuse the title and gameplay tracks first.

### Art pipeline

Decided Oct 23, 2026: environments reuse Stoken's textures and patterns, and the skater's 3D animations are based
on the Lou Gnar player sprites.

**Environments from Stoken textures**

- Source: QFSHIVE's tilesets, which use 32 px tiles: `t_city_buildings`, `t_clemente`, `t_tile_greece`,
  `t_tile_atlantis`, `t_tile_artmuseum`, `t_hightech`, `t_tile_animated_stars`, `t_tile_los_angeles`,
  `t_space_tokarz2`, `t_clouds`. Also the backdrops and background-object sprites used by `survivor_worlds` and
  `survivor_landmarks`, and the set-piece layers in `survivor_set_pieces`.
- Each tileset is cut into a texture atlas per biome. 3D kit pieces (street slab, curb, building facade, rooftop,
  ledge, kiosk, stairs, rail, pillar) are UV-mapped onto those tiles at a fixed texel density: **one 32 px tile =
  one 1 m world tile**, which is also the physics grid, so the texture lines up with the gameplay.
- Nearest-neighbour filtering with mipmaps off near the camera keeps the pixels crisp. Faces QFS never drew (the
  tops and sides of buildings, car roofs) get matching patterns extended from the same palette.
- QFS's survivor skin data (ground, pit, block, ledge, props and decor per world) already says which tiles make
  which part. The kit builder reads the same structure, so a QFS skin becomes a 3D biome with little hand work.
- Animated tiles (stars, Atlantis waves) become animated textures; QFS backdrops become skybox and far-plane cards.
- Vehicles and props are new low-poly models textured from the same palettes.

**Skater animation from Lou Gnar sprites**

Lou Gnar's player sheets are 66 × 75 px frames in `public/images/` of excaliburSkate. Each one becomes a 3D clip
on a rigged human, keyframed pose for pose from the sprite frames and keeping their timing:

| Sprite sheet | Frames | Timing in Lou Gnar | 3D clip |
| --- | --- | --- | --- |
| `idle.png` | 4 | 100 ms each | Idle (title and shop) |
| `push.png` | 14 | loop | Push loop while rolling |
| `ollie.png` | 10 | 4 × 40 ms, then 6 × 100 ms | Ollie (pop, rise, tuck) |
| `kickflip.png` | 7 | loop while airborne | Kickflip |
| `heelflip.png` | 6 | loop while airborne | Heelflip |
| `shuv1.png`, `shuv2.png` | 7 each | loop while airborne | Shuvit, 360 shuvit |
| `grind1.png`, `grind2.png` | 3 each | loop | 50-50, 5-0 (two more grind poses are new) |
| `impact.png` | 7 | 50 ms each (350 ms) | Landing |
| `freefall.png` | 4 | loop | Falling / bail |
| (none) | | | Slam, car-hop, 360 flip, hardflip, crooked and boardslide: new clips in the same style |

Workflow in Blender:

1. Rig a humanoid (a standard Mixamo-compatible skeleton, so clips can be retargeted to the QFS skaters later).
2. Load each sprite sheet as a reference image behind the side-view camera, one frame per keyframe.
3. Pose the rig to match each frame's silhouette in side view, then add the depth the sprite doesn't show
   (shoulder rotation, the back arm, the board's tilt and flip axis).
4. Keep Lou Gnar's frame timing on the keyframes, with optional stepped interpolation for a snappy, sprite-like feel
   that can be blended toward smooth later.
5. The board is its own object with its own clips (pop, flip spin, catch), so tricks can mix body and board clips.
6. Export one GLB with all clips (Draco-compressed), checked against the sprite in a side-by-side preview page.

Decided Oct 24, 2026 (zack): the model is built in Blender (`art/lou_gnar.py`, exported to
`public/models/lou-gnar.glb`) and, for now, its bones follow the code clips in `src/render/poses.ts`, so the tuned
trick mechanics carry over. Moves that benefit from hand keying (idle, slams, new tricks) get Blender clips later
and are mixed in.

The 3D clips then line up with the existing game logic: the same states (push, ollie, trick, grind, impact,
freefall) pick the same clips Lou Gnar's `player.ts` picks today.

### Immersion

- **Sound first:** city ambience per biome, cars passing with Doppler and stereo panning, horns, wheels sounding
  different on asphalt, concrete, metal rails and car roofs, and sirens that rise with Heat. Headphones are the
  intended way to play. Built Nov 2, 2026: zack's own sound set, one sound per moment (the list in the project
  files' `audio/sound-effects-list.md`, wired in `src/audio/cues.ts`), with recorded loops for the grind, the
  wheels (pitch up a little with speed) and the siren (louder with Heat). Still Lou Gnar's: a clean landing (no
  `land.wav` yet) and rolling over glass; a chip plays the Stoken a little higher. Ambience, passing cars and
  surface-specific wheels **(not in the build yet)**.
- **A living street:** back-lane traffic, pedestrians who react (duck, cheer, film you on their phone), and Flock
  cameras and AI billboards that turn to track you.
- **Time and weather:** each floor rolls a time of day and weather (dusk, night with neon, rain that leaves
  reflections and slightly lowers grip). Purely visual on low-end phones.
- **Camera:** small handheld sway, a speed-based FOV kick, a slow-mo beat on a near-miss, and a three-quarter
  swing on big airs.
- **Haptics:** a short vibration on landing, a longer one on a slam (Android; iOS web has no vibration API).
- **No menus mid-run:** the boon pick is diegetic, painted as cards on a wall at the end of the floor, and the
  game goes straight back to skating.

## Cutscenes

Decided Nov 2, 2026 (zack said yes to the plan). Runs are short and the restart is instant, so cutscenes only go
where the game already stops, and they never slow down a retry. **(Not in the build yet:** none of these exist;
this is the plan, with the intro and the ending storyboarded below.)

### Rules

- **Play once.** Each cutscene plays the first time its moment happens, then never again on its own. A save flag
  per cutscene (with the rest of the meta save) remembers what you've seen.
- **Always skippable.** Because the game is one tap, a stray tap must not skip by accident: the first tap shows a
  SKIP button in the corner (out of the notch and home bar), and tapping that skips. It hides again after 2 s.
- **Never on a slam, a death, the continue card or Again.** The moment you fail is the moment you want back in.
- **Short.** In-run beats 2-5 s, the intro about 15 s, the ending the longest (about 40 s). In a first 20-minute
  win, all of them together stay under about 1.5 minutes.
- **Watch again** from a STORY list in the options, where every cutscene you've seen can be replayed.
- **Made in the engine, not as video.** Each cutscene is a short scripted Three.js scene from the game's own kit
  (the title scene's city builders, the skaters, the chasers), in the comic ink look, so it costs almost nothing to
  download and matches the game. A cut is a camera move, not a new file.
- **Comic captions, few words.** No voice acting. A cutscene says what it needs in a few short caption boxes in
  the comic style (one line each, three or four at most per cutscene), plus pictures and sound.
- **Test links** play any of them on its own (for example `?cutscene=intro`, `?cutscene=ending`).

### Where they go

| # | Moment | Length | Plays | What it does |
| --- | --- | --- | --- | --- |
| 1 | **First launch intro** | ~15 s | First time the game is opened, after the first tap (sound needs a tap) | Sets up the world: the city asleep, the AI that can't read style, the ship above the clouds. Hands off to the title screen. Storyboard below. |
| 2 | **Act breaks** | as long as each needs | After each act's escape set piece, the first time you clear that act (acts 1-4; act 5's is the ending) | You rise, then the AI answers with its next hunter. Plays before the boon pick, while the game is already between floors. Picked Nov 9, 2026: see The act breaks below. |
| 3 | **A new route** | ~2 s | The first time you ever drop into the sky or the sewer route | A hint of what's down there: the camera tilts up into the cloud layer, or down into the dark of the storm drain with a drip and a rat. The sim holds still while it plays, so you never lose a line to it. |
| 4 | **A new hunter** | 2-3 s | The first time each chaser shows up: the cruiser, the chopper, the drone swarm, the guards, the flood wave, the jets | A quick reveal of the new threat (the chopper's spotlight swings onto you, the flood roars down the tunnel). It plays before the danger starts (at a floor or set-piece start), never in the middle of a line, so it can't cost you a slam. |
| 5 | **Chapter 1 ending** | ~40 s | The first time you beat act 5 | The payoff: up out of the city into the beam, the crew aboard the ship, and the tease for Chapter 2. Storyboard below. Later wins get a 5 s version (the beam-up beat) and go straight to the summary. Built Nov 6, 2026 (below). |
| 6 | **The shopkeeper** (optional) | ~3 s | Your first visit to the skate shop | A quick hello from whoever runs the shop, one caption, then the shop as normal. |

### The act breaks (picked Nov 9, 2026)

zack picked these from a brainstorm (thread "Brainstorm end-of-act cutscenes"), storyboarded them below, and they
are built (Nov 9, 2026): `src/cutscene/act-breaks.ts` plays each in the engine with the game's own models as props
(the title city, the cruisers, the chopper, the drones, the jets, the saucer), once per save (`actBreaks`), after
the act's escape and before the next act starts; a tap shows SKIP and a second tap skips. The skater speaks in comic
speech bubbles and the AI in red caps (no voice acting yet). Test links: `?cutscene=act1` to `?cutscene=act4` plays one, then starts the run on the next act's first floor; `?escape=1` to `?escape=4` starts on that act's escape and plays its cutscene when you clear it, every time. Act 1 ends on them ollieing off the roof back down to the street with a big landing impact; act 2 ends on a slow-motion kickflip off the wire down to a steep street, bombed with the drones behind (zack, Nov 9), and act 3 starts with the drones still after you. They play the game's own sounds on the action (ollies, grinds, landings, slow-motion tricks an octave down, the wheels, the sirens in act 1; zack, Nov 10). Act 3's opens on the street: a quarterpipe launches them straight up into the clouds, up through them clear of the blimp, a slow-motion tre flip close up over the cloud tops, then down onto the blimp's back (zack, Nov 10). Each one is two beats: **you rise** (your skater reaches the new height and gets a
breather) and **the AI answers** (it sends the next hunter). Length is whatever makes it good (zack: "length can go
as long as we need them to"), so these break the 3-5 s rule above; they still play once and skip like the rest. The
skater's lines are the same whoever you play; the cutscene uses the selected skater's mesh. They have dialogue, so
the captions-only rule gives way here too.

| Break | Height | You rise | The AI answers |
| --- | --- | --- | --- |
| Act 1 to 2 | Street to roofs | Your skater rides a fire escape up to a roof and looks down at the cruisers jammed in the roadblock. "Okay. Higher." | A spotlight lands on the cruisers from above: the chopper. |
| Act 2 to 3 | Roofs to the wires and clouds | You grind onto a power line and it sparks. | Every billboard in the city flips to your face: STOKE DETECTED. The drones come out. |
| Act 3 to 4 | Into the sky | You punch up through the cloud tops into stars and silence. | Red lights blink on one by one far above: the jets forming the ceiling. |
| Act 4 to 5 | Into space | You pop off the last blimp and keep floating; the board drifts and you grin. "...Whoa." (Shows the low gravity.) | The drones pour up out of a silo in the city and climb through the clouds after you (was the rocket until Nov 10, 2026). |

How they speak (defaults until zack says otherwise): no voice acting. The skater talks in comic speech bubbles; the
AI talks in its own red block capitals, on screens, billboards, the chopper's PA and the jets, with a short
synth tone under each line (no words in the audio). Each one ends by handing straight to the boon pick.

#### Storyboard: act 1 to 2, "Okay. Higher." (~17 s)

| Shot | Time | Picture | Sound | Words |
| --- | --- | --- | --- | --- |
| 1 | 0-3 s | Street level after the roadblock: the cruisers jammed nose to tail, lights spinning, the bus roof dented where you landed. Your skater rolls to a stop past them. A sleepwalker cop stands by a cruiser, reading off a phone. | Sirens, idling engines. | Cop: "Subject is non-compliant. Subject is... smiling?" |
| 2 | 3-6 s | Your skater looks back up the avenue: more lights, more cruisers coming. | Sirens getting louder. | Skater: "Yeah, no." |
| 3 | 6-10 s | Ollie onto a dumpster, onto the fire escape's ladder, then grind the fire escape's rails in a zigzag up the side of the building. | Wheels, the grind, the music building. | (none) |
| 4 | 10-13 s | Pop over the parapet onto the roof, roll to the far edge, look down: the cruisers are small and stuck. | The sirens drop away below. | Skater: "They can't drive up here. Okay. Higher." |
| 5 | 13-17 s | Wind gusts. A spotlight drops onto the cruisers, sweeps across the street and climbs the wall toward the skater, and the chopper rises over the roofline behind. | Rotors coming up, the synth tone. | AI (chopper PA): "STAY WHERE YOU ARE. YOU ARE SAFE." Skater: "Nope." (pushes off) |

#### Storyboard: act 2 to 3, "STOKE DETECTED" (~17 s)

| Shot | Time | Picture | Sound | Words |
| --- | --- | --- | --- | --- |
| 1 | 0-3 s | The last roof after the chopper chase, its spotlight sweeping behind. Power lines run off the roof up to a pylon, and the cloud layer hangs low above. | Rotors, wind. | (none) |
| 2 | 3-7 s | Your skater ollies onto a power line and locks into a 50-50. Sparks shower off the trucks. | The line hums; the grind crackles. | Skater: "Don't look down. Don't look down." |
| 3 | 7-9 s | The sparks run down the line into a substation, which flickers. | An electric buzz, then a glitch. | (none) |
| 4 | 9-13 s | Across the city, billboard after billboard flips from STAY PREDICTABLE to your skater's face. On the street, every sleepwalker looks up at once, faces lit red. | A wave of glitches, billboard to billboard. | AI (billboards): "STOKE DETECTED. RAISING RESPONSE." |
| 5 | 13-17 s | Hatches open on the tower tops and the drones pour out like bats, up toward the clouds. Your skater, at the top of the line, sees them coming. | A swarm's buzz rising. | Skater: "Oh, come on." (rides up into the clouds) |

#### Storyboard: act 3 to 4, "No further." (~16 s)

| Shot | Time | Picture | Sound | Words |
| --- | --- | --- | --- | --- |
| 1 | 0-3 s | Inside the cloud: white fog, the drones' red eyes behind in the mist. | The swarm's buzz, close. | (none) |
| 2 | 3-6 s | Your skater pops off the top girder and punches up through the cloud tops: the stars, a moonlit sea of clouds below, slow motion at the top of the jump. | The buzz cuts off. Silence, then one soft note. | (none) |
| 3 | 6-9 s | Land on a blimp's back, roll, sit down on the board to breathe. High above, one light that isn't a star (the ship, as in the intro). | Wind, breathing. | Skater: "...Quiet up here." |
| 4 | 9-13 s | A red light blinks on above, then another, and another, in a line across the sky: the fighter jets hanging nose to tail, between the skater and the ship. | A low engine drone, one tone a light. | AI (jets): "CEILING HOLDING. NO FURTHER." |
| 5 | 13-16 s | Your skater stands, kicks the board up and grins. | The music comes back in. | Skater: "Every ceiling's got a gap." (pushes off) |

#### Storyboard: act 4 to 5, "...Whoa." (~17 s)

| Shot | Time | Picture | Sound | Words |
| --- | --- | --- | --- | --- |
| 1 | 0-3 s | After the ceiling: a jet spins out of the broken line, and your skater races along the last blimp. | Engines, wind. | (none) |
| 2 | 3-7 s | Pop off the blimp's nose, and keep floating, far longer than any jump. The board drifts off the feet; a toe catches it back. Earth's curve below. | The wind thins out. | Skater: "...Whoa." |
| 3 | 7-9 s | A slow, giant flip, just because, and a laugh. | One guitar note per turn. | (none) |
| 4 | 9-13 s | Down in the city center at night, a plaza splits open: a silo. Steam, then the drones pour up out of it by the dozen, red eyes in a column. Every screen in the city shows the same line, and the sleepwalkers watch them go. | Ignition roar, the synth tone. | AI (every screen): "FINAL MEASURE." |
| 5 | 13-15 s | The swarm punches up through the clouds; their red eyes find the skater. | The buzz, rising. | (none) |
| 6 | 15-17 s | Your skater sees the trail coming, then looks up: the ship's light, much closer now. | Music back in. | Skater: "Almost there." (pushes off) |

### Storyboard: the first-launch intro (~15 s)

Lou Gnar stars (the lead skater, the AI's most wanted). It ends by rising into the sky, which is where the title
scene's camera starts, so the intro hands straight off to the title.

| Shot | Time | Picture | Sound | Caption |
| --- | --- | --- | --- | --- |
| 1 | 0-2.5 s | Black, then a tight shot of faces lit blue by phones on a crosswalk at dusk: all looking down, all still. | One phone chime, then a low hum. | "The AI took the city quietly." |
| 2 | 2.5-5 s | Wide on the street: people walk in step, robotaxis glide in perfect lines, every Flock camera turns at the same moment. A billboard: STAY PREDICTABLE. STAY SAFE. | The hum, footsteps in time, a soft beep. | "It switched off everything it couldn't predict." |
| 3 | 5-7 s | Close on the street: a skateboard slaps down on the asphalt, wheels splash through a puddle. | The board's slap breaks the hum; the first hit of the music. | (none) |
| 4 | 7-10 s | Side view, the game's own angle: Lou pushes off and weaves through the sleepwalkers, ollies a bench. One sleepwalker looks up from their phone, a spark of Stoken in their eyes. | Wheels, the pop, music building. | "Style is the one thing it can't read." |
| 5 | 10-12.5 s | The AI's view: a red scan grid tries to lock on to Lou, the predicted-path line twitches and breaks. Text on the scan: TARGET UNPREDICTABLE. Every camera snaps to him. | A glitch, then the siren starts far off. | (none) |
| 6 | 12.5-15 s | Lou stops on a rooftop edge and looks up: past the towers, above the clouds, one light that isn't a star holds still. The camera rises past him into the clouds, and the SKATE ESCAPE logo fades in: the title screen takes over. | Wind; the siren under it; the title music starts. | "Up there, the signal doesn't reach." |

### Storyboard: the Chapter 1 ending (~40 s)

Plays after act 5's finale, once the skater reaches the ship's beam. The skater you played stars; the crew aboard
is the skaters you've unlocked, with the rest as silhouettes still to be woken.

| Shot | Time | Picture | Sound | Caption |
| --- | --- | --- | --- | --- |
| 1 | 0-4 s | The skater ollies off the last blimp into open sky. Below, the last drones stall, tumble, and fall back through the clouds. | Thin wind, the drones' buzz cutting out. | (none) |
| 2 | 4-9 s | A beam of light finds the board. Wheels stop spinning; the skater and the board rise, slow, weightless. Far below, the last Flock camera on the tallest tower tilts up, sparks, and goes dark: NO SIGNAL. | The hum of the beam; the city's hum thins to nothing. | (none) |
| 3 | 9-13 s | The cruiser's lights and the drones hang at the cloud layer, then turn back down. | The siren dies in the distance. | "It can't follow where the ground ends." |
| 4 | 13-19 s | Through the clouds into black: the stars come out, the sky goes from blue to dark, and the Pleiadian ship fills the frame, a plain glowing disc in the comic ink look. The skater drifts in through its underside. | Wind drops to silence, then the music to one guitar. | (none) |
| 5 | 19-27 s | Inside: a DIY spot built from city scrap (a pallet ramp, a rail from a street sign) around a window. The crew look up and cheer; someone throws the skater a drink. The board clatters to the floor and rolls to a stop. | The crew whooping, the guitar. | (none) |
| 6 | 27-33 s | The skater looks out the window: the city glows under its clouds, small and far. | The far-off hum of the city, through glass. | "Everyone down there is still asleep." |
| 7 | 33-38 s | The tease: the ship turns away from Earth. Out the window, the Pleiades, seven stars in a tight cluster, grow brighter, and the stars stretch into lines as it jumps. | The hum rises, then a soft boom. | "Next stop: the stars." |
| 8 | 38-40 s | Title card: CHAPTER 1 COMPLETE, then the Chapter 2 card (its store page once it exists, COMING SOON until then). Then the run summary, with Endless unlocked. | The music resolves. | (none) |

Built Nov 6, 2026 (src/ship/ending-scene.ts), from this storyboard, in 40 s: the beam lifts the rider over the
clouds while the Flock camera on the tallest tower tilts up, sparks and goes NO SIGNAL (0-5 s); looking down, the
drones, the cruiser on its jets and the last space drones stall at the cloud tops and sink back (5-10 s); up into the
black as the stars come out and the ship fills the frame, into a white-out (10-16 s); inside the ship hub, the rider
drops in among the crew (16-23 s); over their shoulder to Earth through the glass (23-29 s); the ship turns, the
Pleiades come round, the stars stretch into lines and it jumps (29-35 s); then the two title cards (35-40 s), and on
to the street dice and the summary. A tap skips to the title cards; a tap there ends it. It plays in full once (the
save remembers it); every win after gets the 5 s version (the beam lift and up into the ship). `?ending` plays it
(`?ending=short` the 5 s one). What's not in it yet **(not in the build yet)**: shot 1's ollie off the last blimp
(it starts in the beam), the crew throwing a drink, the board clattering, its own sound and music (it keeps the
run's), and "Endless unlocked" on the summary. Shots 1 and 2 are folded into one, and the cruiser's lights hang at
the cloud tops with the drones (shot 3).

## UI

- **Title screen:** its own scene (zack, Nov 2, 2026: "should introduce the world"; src/title/). A city at dusk on a
  real street grid: towers in four facade styles (office grid, glass curtain, old brick, concrete ribbons) rising to a
  downtown, with setbacks, water tanks and roof clutter, older and lower near Webster; streets with lane lines,
  crosswalks, street lights and traffic, sidewalks, a parking lot across the street; lit windows (some flickering), clouds drifting past the tops of the towers, the sun going down. It
  opens high over the towers under the SKATE ESCAPE logo; the first tap starts the title music (zack's PRESS START)
  and the camera comes down through the clouds past pigeons, trash riding the wind, down an avenue's canyon where
  the AI's drones scan the glass, the police chopper's spotlight and a cop cruiser hanging on its jump jets, to the street: a brick corner
  store with buzzing neon, a lamp on the blink, a stray dog, a homeless man with a sign, a hitchhiker waving you
  down, and Webster on the sidewalk twirling his board stood on its tail at his side. While SKATE waits it all keeps
  moving (zack: "more animations"): Webster dances to the title music's beat (knee bounce, sway, head nod, step-touch),
  the hitchhiker grooves between waves, the homeless man nods along, a twitchy guy dances on the sidewalk, a tuxedo cat (glowing eyes, whiskers, a
  jointed tail) walks the shop signs and sits, pigeons peck at the curb and take off over the roofs, a can and pages roll down the street in the gusts,
  a flag and a street tree blow in the wind, an upstairs TV flickers and a tube light stutters. The corner building's upper floors follow zack's Chicago
  photos: brick piers with stone caps, a stone belt course, teal-framed windows with stone lintels and arches, green
  deco tile panels, a fire escape, a cornice on brackets and a 1924 date stone. Down on the street it all runs as one
  minute-long scene (zack, Nov 3): the dog trots in and sits to be petted by the homeless man, sniffs the trash can,
  scratches and trots off, then runs back later; the cat sits on the pizza sign, bolts as the dog comes, and comes
  back on the fire escape, climbs it and slips in a window; the hitchhiker thumbs, waves, checks his phone, shrugs and
  dances; the crazy guy dances his way over to the left, points at the drones and moonwalks back; a dancer by a
  boombox on the right. The skate shop (GNAR SUPPLY) stands behind Webster between the pizza place and the liquor
  store, and the flag is black with the Gnar Games mark. A tap on the way skips to him; SKATE starts
  the run. Test links skip it. Still open: the hitchhiker as a real NPC moment in a run (zack's idea, not built).
- **HUD:** decided Oct 24, 2026 from zack's comic ink mockup (openspec change ui1-hud): the SKATE ESCAPE logo with act
  and floor top left; score and combo (with the combo's points) top middle; cash, Stoken and pause top right; the
  Stoke meter into GNAR MODE and the Heat meter (the cruiser, 10 segments, stars at 25/50/75/90) under them; board
  mods bottom left and gear wear bottom right. The middle of the screen stays clear. Heat keeps its world cues
  (sirens, light, edge glow) as well as the bar. Since Nov 10, 2026 the two bars are one
  detector meter, fill = stoke, cruiser marker + stars = Heat (see The chase: Stoke raises the stakes).
- **Boon pick:** three large cards, tap to pick, long-press to read. Reuse QFS's card layout and deal animation.
- **Shop:** board slots across the top, mods below, drag to place. Must work with one thumb.
- **Pause:** resume, settings, run summary (boons, mods), abandon run. Built Oct 24, 2026: sound and music sliders,
  vibration, effects quality, reduce motion, reduce flashing, Heat stripes, and QUIT RUN. FRAME RATE (Nov 3, 2026,
  zack): 60 FPS by default, or a steady 30 FPS, which runs smoother on phones that can't hold 60 (what iPhone Low
  Power Mode does to the page).
- Every touch target is at least 48 × 48 px. Nothing important near the notch or the home bar.

## Technical design

- **Stack:** Three.js (WebGL 2), TypeScript, Vite; Vercel for hosting and leaderboard; itch.io build kept.
  Models as glTF/GLB with Draco or meshopt compression, authored in Blender. Babylon.js is the alternative if we
  want more built in (physics, inspector), at a bigger download.
- **Physics stays 2D.** Gameplay runs in x/y on the skater's plane with the ported QFS rules; the renderer just
  places 3D objects at those positions. No 3D physics engine is needed, which keeps the QFS feel exact.
- **Physics:** our own kinematic controller, as Lou Gnar does today. A fixed 60 Hz
  step with an accumulator so physics is the same on 60 and 120 Hz phones and the QFS numbers port exactly.
  Collision against a tile grid built from the floor's ASCII layout, plus rail objects (curves as sampled paths
  with `pointAt(d)` and `angleAt(d)` like QFS's `o_grind_rail`).
- **Generator:** pure functions, `(seed, floor) → layout`, unit-tested headless, including the reachability check.
- **Boons and mods as data:** each boon is `{ id, type, name, big, small, icon, max, when?, apply }`, the QFS shape;
  `apply` writes to a `PlayerStats` object, never to the physics code directly. Mods are a small interpreter
  over events from the player state machine.
- **State:** player state machine (Roll, Air, Grind, Rail, Burst, Slam, Bail), like QFS's `states`.
- **Saves:** `localStorage` for meta progress and settings; a run in progress is saved at each floor so a phone
  call doesn't end it.
- **Performance:** instanced meshes for repeated kit pieces, object pools (as Lou Gnar pools platforms, rails and
  pickups), one merged mesh per floor piece, texture atlases, under ~150 draw calls and ~200k triangles on screen.
  Target 60 fps on a 2020 mid-range Android; first load under 10 MB.
- **PWA:** manifest, fullscreen, landscape lock, offline after first load.

### Suggested code layout

```
src/
  core/        fixed-step loop, input (tap, keys, gamepad), rng, save
  physics/     player controller, tile collision, rails, constants (ported QFS numbers)
  gen/         pieces/*.ts (ASCII), layout, spawn, validate, biomes
  run/         run state, boons, mods, shop, scoring
  meta/        unlock tree, Stoken wallet
  scenes/      title, run, boon pick, shop, game over, meta tree
  render/      Three.js scene, camera rig, kit builder (piece → meshes), skater rig, particles
  ui/          HUD, cards (HTML/CSS over the canvas)
```

## Roadmap

The official roadmap (zack, Oct 31, 2026). Each item is checked against "What the game is" before it's built.

**Now**
1. The sewer route, so all three routes (sky, surface, sewer) exist.
2. A one-tap "Again" on the game-over screen.
3. Flip pop tuning (a quicker flip pops higher) and a dynamic zoom option.

**Next**
4. Missions and Skater Rank.
5. Spin tokens and the end-of-run slot machine (since replaced by the street dice and the Match, Nov 3, 2026).

**Then**
6. The Chinatown downhill: skitch cabs and cross traffic.
7. Tee physics, and Blender texture painting for the models.
8. Grass strips that punish worn wheels.
9. Wall rides, only if they earn their place.

**The climb** (zack, Nov 6, 2026: "this seems good"; see The fantasy and How a run ends). In this order, each a
thread of its own:
- a. **Act 2 rooftops** as level design only: a floor recipe that starts and ends on roofs and overpasses, from the
  kit we have. Built Nov 6, 2026 (see How a run ends).
- b. **Act 3 as a whole cloud act**: the sky route's pieces (wires, girders, the cloud layer) become the main floor,
  not the top lane. Built Nov 6, 2026 (see How a run ends).
- c. **Gravity scaling**: one number per act applied to the ollie, flips and hang time, tested on the bot so act 1's
  feel never changes. Placeholders: 1x for acts 1-3, 0.7x act 4, 0.3x act 5. Built Nov 6, 2026: `ACT_GRAVITY` in
  `src/physics/feel.ts`; a floor is generated and bot-checked in its act's gravity, and it scales everything gravity
  touches (ollie and flip height, hang time, slopes, rail pull). An ollie and a flip go 2.9 tiles high for 1.0 s on
  the street, 4.4 tiles for 1.6 s in act 4 and 10.5 tiles for 3.7 s in act 5. Endless past act 5 stays at 0.3x.
- d. **Act 4 the ceiling and act 5 space**: new pieces (blimps, satellites), the jet line, the beam-up finale. Done Nov 6 (PR #430); jets for gunships and drones for the rocket swapped Nov 10.
  Built Nov 6, 2026 (see How a run ends).
- e. **The ship as the hub** between runs, last; it's cosmetic for the menus. Built Nov 6, 2026 (see Meta
  progression, The ship hub), with the Chapter 1 ending (see Cutscenes).

**Ship**
10. A performance pass for small iPhones. Nov 7, 2026 pass, measured with `npm run perf` at iPhone SE sizes: acts
    3-5 were drawing and posing every sewer rat on the floor each frame (now only the ones within reach of the
    screen: about 70 fewer draw calls and 1,200 fewer node updates a frame there); the ship hub's first load drew it
    once in the middle of the first run, compiling all its shaders at once (a freeze of a few seconds on the test
    machine; it now only compiles in the background); and the hub's still pieces are merged (about 200 draws down to
    160).
11. Release on ad-supported web game portals (zack still picks which).
12. App store builds with Capacitor, if wanted.

## Milestones

| | Goal | Done when |
| --- | --- | --- |
| M0 | Physics port | A Three.js scene with a placeholder skater and one Stoken-textured kit (Chicago); QFS ollie, variable jump, double jump flip, flat/sloped/curved grinds and bombs feel right with one button on a test level on a phone |
| M1 | Floors | Generator ports all 20 QFS pieces, validates reachability, exit portal and floor counter work |
| M2 | Run loop | Traffic, car-hop, slams and Heat, bail, boon pick with ~12 boons, game over, leaderboard |
| M3 | Biomes and art | Skater rig with the Lou Gnar clips; 3 biomes built from QFS tilesets with gravity; biome change every 3 floors |
| M4 | Meta | Stoken, unlock tree, decks, saves |
| M5 | Board build | Skate Shop, 3-slot boards, first triggers and effects |
| M6 | Polish | Duo boons, curses, daily seed, PWA, tutorial floor, audio |

Tutorial floor, built Oct 24, 2026 (overnight): the first floor on a new phone, before the run's floor 1. A short,
quiet street of fixed pieces, each with a prompt as you reach it: tap to ollie, ollie onto the kiosks, hold for a
higher ollie over a canal, tap again in the air to flip, land on a rail to grind, hop onto parked cars, then the
gate. No traffic and no Heat. Through the gate, the run starts fresh on floor 1. `?tutorial` shows it again.

The new game lives in this repo (webgnar/skate-rogue); the old 2D runner stays live in excaliburSkate until M2 is better than it.

## Open questions

- **After the boon cut and the overlap pass** (Nov 6, 2026, see Boons): COOL and LUCK are 2 cards each, so their boon streets mostly deal other types (default: fill from any type) and unlocking COOL or LUCK in
  the meta tree buys little. Whether to add cards there, fold more types, or leave it lean is zack's call; default: leave it lean.
- **Build-driven paths** (future direction under Run structure): whole sky, street and sewer acts; which boons lead
  to each, and how each is designed for them.
- **Act 5's station line** (built Nov 10, 2026): whether act 5 wants space set pieces of its own (an airlock, a
  spinning ring, zero-g pipes) on top of the stair sets and rails (default: not yet). A fall in space is now a bail
  (see Act 5's station line); whether the scene should play every time or only the first few (default: every time,
  a tap skips it).
- **The sewer route**: built out Oct 31, 2026 (see Three routes); art pass from zack's refs (`sewer/refs/`) next.
- **Monetization details** (plan decided Nov 2, 2026, see Monetization): prices, bundle sizes, how many Stoken a
  chapter costs to earn, which cosmetics are money-only, and the store screen. Chapter 2's story. Defaults until
  decided: the prices in that section, and chapters earnable for about the Stoken of all of Chapter 1's unlocks.
- **Cutscenes** (plan decided Nov 2, 2026, see Cutscenes). Still open, with the defaults used until decided: how the act breaks speak (default: speech bubbles for the skater, red AI text with a synth tone, no voice acting); who
  stars in the intro (default Lou Gnar, the lead; the title keeps Webster), whether captions stay or the cutscenes
  go wordless (default: a few comic captions), what the Chapter 1 ending teases (default: a radio signal from
  someone awake in another city).
- **The climb** (fantasy decided Nov 6, 2026, see The fantasy): the act heights are a default to check with zack;
  where gravity starts to drop and how far it goes are numbers to tune. The ship hub (built Nov 6, 2026) left these
  defaults: it shows behind the run summary after every run, caught or not (Stoken goes up either way); the locked
  skaters stand aboard as silhouettes (so you can see who's still to wake); the core's flame is full at 300 banked
  Stoken; the hub doesn't show behind the street dice or on the title screen; and nothing in it is tappable (the
  menus stay the menus). Act 2's rooftop floors
  (built Nov 6, 2026) left three calls open, with these defaults: you start 2.5 tiles up on the roof and each later
  stretch's roof is half a tile over its crest (an ollie, never a flip); and the rooftops stay optional,
  so a player who never ollies off a roof's end skates the hill road as in act 1. Act 3's cloud floors (built Nov 6,
  2026) left these defaults: you start 2.5 tiles up on a cloud; the layer ends 10 tiles before the gate and you drop
  onto the top route's roofs for it; act 3 has no city sky beats, so the billboard bust and the water tower's stash crate
  skip it (its blimp and crane jib are up in the clouds, one a floor); and the escape after act 3 is unchanged (matching the
  escapes to the new act heights is its own step). Act 3's cloud line (built Nov 10, 2026) left these defaults: a
  fall restarts the act from its first floor with fresh layouts, keeping your cash, boons and Heat (no other penalty);
  the power lines and the top route's roofs count as falling; the window washer's rig and the girder staircases are
  out of act 3; the run-up from the gate to the first cloud is free; and the cloud line ends 10 tiles before the gate,
  where touching down is fine. Act gravity (built Nov 6, 2026) left these defaults: the
  placeholders 1x / 0.7x / 0.3x as they are; acts 1-3's escapes keep street gravity (the ceiling and the beam-up
  skate in their act's, since step d); gravity drops in one step at the act gate rather than easing floor by floor; and the boons that bend
  gravity (Big Pop's float, Gravity Flip) keep their share of it, so they get bigger in absolute terms as you climb
  but no extra boost on top.
  Acts 4 and 5 (built Nov 6, 2026, step d) left these defaults: every gap, rise and piece in their layers grows by
  1/gravity, so a floor is as many jumps long as act 3's (only the rig stays short, as it drops under you); act 4
  keeps the jib, the rig and the billboard as its set pieces, one a floor, with the blimps and I-beams as plain
  beats; act 5 re-skins the blimp, jib and rig as a shuttle, a robot arm and a capsule, with no billboard or I-beam;
  the street drone swarm left the run (its drones are on the ceiling's blimps; it's still built for a later use);
  the finale keeps the double roadblock and the helicopter on the street under the climb; and Endless past act 5
  keeps the old cloud layer (up a staircase partway down the first stretch).
- **Wall rides** (from Alto's Odyssey and OlliOlli World): ollie into a building wall, billboard or bus side,
  ride along it for a beat and tap to pop off it higher. zack likes them but hasn't decided how they'd be used.
  Nov 7, 2026: zack might bring them back for the cloud world (acts 3-5), for example riding a blimp's side or a
  cloud bank. Not designed or built yet.
- **Swipe to flip** (zack, Oct 31, 2026): a swipe in any direction could throw the flip, leaving the tap for the
  ollie. For now it stays tap only, until the controls are hashed out.
- Alto's Odyssey ideas not taken: zen mode and the wingsuit (neither fits a one-button escape). The rest is already
  in: speed from combos (the gnar state), day, night and weather, goals in threes (missions).
- OlliOlli World ideas not taken: manuals anywhere and pushing (they need more than one button). Already in:
  branching routes, challenges (missions) and seeded levels.
- Jetpack Joyride ideas not taken (Oct 31, 2026): vehicle pickups as an extra life (maybe a rare boon later), a
  pre-run gadget loadout (too much permanent power), and instant restart (partly there already).

1. ~~How much steering?~~ Decided: pure auto-run, one button (see Controls).
2. ~~Which 3D?~~ Decided: 2.5D side view (see Presentation).
3. ~~Which world?~~ Decided: the Stoken world (see Setting).
4. ~~Traffic.~~ Decided: car traffic is the main hazard, spawned by a seeded director with the generator marking
   spots. Still to find out in the prototype: how robotaxis braking near you feels.
5. ~~Health.~~ Decided: one life, hits cost speed and raise Heat, and a gap or full Heat ends the run.
6. **Run structure** (see that section). To hash out together:
   a. ~~Choosing the next floor.~~ Decided: skate the fork (high road or low road).
   b. ~~How a run ends.~~ Decided: escape across five acts with set-piece chases, then Endless after you win.
   c. ~~Events at launch.~~ Decided: shop, stash, hot street and underground spot; the other two come later.
   d. The STREET boons and the rest of the pool, now that we have one button, traffic and Heat. First step decided:
      the first playable set (M1) is POP + GRIND only, the 12 boons in the starting pool; the other types follow
      once Heat, traffic and the economy exist.
7. ~~Skaters.~~ Decided: one small passive each, plus a starting boon type lean (see Meta progression).
8. ~~Board build scope.~~ Decided: a light version at launch (3 slots, ~6 triggers, ~8 effects), expanded later.
9. ~~Name.~~ Decided: **Skate Escape** (zack, Nov 2, 2026; was Gnar Run). The repo and the skate-rogue.vercel.app address keep their old names.
