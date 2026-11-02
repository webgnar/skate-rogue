# Gnar Run — Game Design Document

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

Lou Gnar is the lead skater: one run is one session out on the AI's streets, skating as far as you can before
the enforcers shut you down. The QFS skaters (Webster, Keanu, Roxy, Goldie) are unlockable.

The world tells this story while you skate, without cutscenes: robotaxis everywhere, AI propaganda billboards
about social credit, cameras that turn to follow you, and sirens that grow louder when you slow down.

## What the game is

Settled Oct 31, 2026 (zack, after looking at Jetpack Joyride, Alto's Odyssey and OlliOlli World). Gnar Run is a
**one-touch phone skate runner where style is speed**:

- Clean timing and combos keep you fast and alive. Sloppy skating slows you down, and slow gets you caught.
- The city is a playground of lines to read: rails, ledges, wires, cars, rooftops.
- Every floor has three routes stacked on top of each other: **sky, surface and sewer** (see Three routes).
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
                                  └── every 3 floors: SKATE SHOP (spend run cash on board mods) ┘
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
| **Boon street** | A normal floor; the reward is a boon pick of a shown type (POP, GRIND, FLOW, LUCK, COOL or STREET) |
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
that boon street. The underground spot comes with carried-over Heat. Built overnight Oct 24, 2026: Heat
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

- **NO GROUND.** Chain sky pieces (the wire, rooftops, decks, booms, a blimp's back) without touching the ground below
  and the coins up there multiply: x1.5 at two pieces, up to x4 (Stoken by the whole part). Air between pieces keeps
  the line; touching the ground below banks it ("SKY LINE x5!"); a bail loses it. It's the reason to stay up there.
- **Set pieces, one a floor at most, from floor 5:** an **ad blimp** moored over the hill, its long back a calm
  cruise; a **window washer's rig** that drops under you once you land, so you pop off it quick onto the roof
  ahead; a **tower crane** whose jib slews out of the lane and back (land early, or it swings away under you); and a
  **paper billboard** across the gap between two decks that you burst through for cash.
- **Finds:** a **stash crate** on a floor's first water tower (a spin token, or a fresh gear part that replaces your
  most worn one); now and then a **golden pigeon** on a deck (clear it from just above for a spin token; skate into
  it and it's a bird strike); and on Chinatown's stretch, **clotheslines** strung between the tenements, short
  sagging wires with the washing on them, to chain.

All of it is physics and tap-only: nothing lifts you up there (zack owns the way up). Code: `src/gen/sky-beats.ts`
(placement and the SKY dials), `src/sim/sky.ts` (the moving decks, busts, golden pigeon, NO GROUND's multiplier),
`src/render/sky-pieces-view.ts` and `src/render/sky-kit.ts` (drawing); the level editor lists the new beats.

**The cloud layer** (zack, Oct 31, 2026: "i want sky route to go really tall. we could use the clouds and the rainbow...
if we can put as much love into the sky as we did the ground"). From floor 5, way over the hill, far above the
rooftops and cranes with nothing reaching down to the city: big puffy clouds to land on, drifting clouds that wander
there and back, thin clouds that puff away a moment after you land (0.66 s: time to take the landing's knock and pop
off), rainbows to grind up and over (one a floor may hide a spin token at the top), and hot air balloons whose
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

**The NO GROUND meter** (zack: "i need that to be visualy clear what its doing"). While a line is going, a panel under
the combo shows NO GROUND, the live coin multiplier (it pops as it steps up), seven pips that turn gold at the x4 cap,
and the bonus the line has added so far. Touch the ground and it reads BANKED +$N; the callout says SKY LINE x3! +$N.

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
| **Sky** | Power lines and rooftops high over the hills and chases | Speed, a big ollie and a flip at the top (cab skitch into a kicker in Chinatown) | The helicopter: Heat doesn't cool from clean skating; pigeons; a fall is a long drop | Long grinds, no traffic, NO GROUND's coin multiplier, set pieces, stashes and spin tokens | Yes |
| **Surface** | The street and the hill road | The default: keep rolling | Traffic, cops on foot and the cruiser | Cash, car hops, the most lines | Yes |
| **Sewer** | One route under the floor: storm drains under the street, the deep under the hills and canals | Roll into a construction spot instead of ollieing it (at the foot of a hill, roll down its plank ramp) | A 5-tile drop in, a low roof (a quick double tap bonks your head), kick-outs that throw you back up to the street, a stair set with a handrail to grind, rats, the flood surge, the subway's gap, the alligator | No traffic, no helicopter, no bullets: the Heat cools fast; DOWNSTREAM: the runoff pushes you faster than the street and chained pieces multiply the coins; the alligator's and the DIY stash's spin tokens; the sewer road to the underground spot | Yes |

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
  adds to the line and multiplies the coins, as NO GROUND does up top; the same meter reads DOWNSTREAM. Coming back up
  banks it (FLOW LINE xN); a trip, a slam or the surge loses it.
- **Kick-outs** (zack: "a quarterpipe up against a wall that shoots the player straight up through a one way platform to
  the street again. players will accidentally get shot back up, maybe try to go deeper next time"): a concrete
  quarterpipe under a grate in the street. Roll into it and it throws you up through the grate onto the street (KICKED
  OUT!); ollie over it to stay down. Up to two a tunnel.
- **One set piece a tunnel** (from floor 2): a **rat pack** that runs at you (ollie it, RAT HOP; roll into it and you
  wobble and lose speed), the **flood surge** (the storm gate behind you bursts and a wall of water chases you down the
  tunnel a little faster than cruising: the current or a grind outruns it, else WASHED OUT, a slam and a soaked deck),
  a **full pipe** bowl the floor dips through and carves you out of, or a **subway crossing** (zack: "subway train cars
  that act as cross traffic"): a gap onto the tracks where trains cross under the tunnel; hop off a train's roof or
  ollie the gap, drop in with no train and you bail.
- **Finds:** the **sewer alligator** (now and then; its jaws open as you come up; ollie it for a spin token, roll into it
  and it bites) and a **DIY stash** crate on the floor (a spin token or a fresh gear part, like the sky's).
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

### 2. How a run ends: escape the city

Decided Oct 23, 2026. A run is an **escape across five acts**, about 20 minutes when you win:

| Act | District (biome) | Floors | Escape set piece |
| --- | --- | --- | --- |
| 1 | Chicago streets | 3 + escape | **Roadblock:** cruisers block the street; clear it over bus and car roofs |
| 2 | Clemente Park or Los Angeles (the route picks) | 3 + escape | **Helicopter:** a spotlight sweeps the street; staying in it adds Heat fast |
| 3 | Ancient Greece, Atlantis or the Art Museum | 3 + escape | **The flood / the chariot race / the guards:** one set piece per biome |
| 4 | High-Tech City | 3 + escape | **Drone swarm:** drones dive in patterns; car-hop them to stay ahead |
| 5 | The Hive (the AI's stronghold, QFS's finale) | 3 + finale | **The Hive core:** grind the tower's rails to the top and hit it with Stoken |

- Escape set pieces are the bosses, with no combat: hand-built, short (about 45 s), scripted chases you survive
  by skating. They use the same traffic and Heat rules.
- Beating Act 5 wins the run. It unlocks **Endless** (QFS Survivor style: floors forever, mixed worlds, its own
  leaderboard) and harder **Gnar levels** (like Hades' Heat or Slay the Spire's Ascension: each level adds one
  rule, such as faster traffic or Heat that never fully resets).
- **One world** (zack, Oct 24, 2026: "i dont want there to be different biomes really ... i would rather fuse all the
  art from the different biomes together to make it more visually rich"). There are no districts: every floor of
  every act is the same fused city, with the art of all the QFS worlds mixed into one kit. The District column in
  the table above is superseded. The worlds' mechanics live on as floor twists that can turn up on any floor from
  act 2 (see Biomes). Act 3's chase is always the guards.
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

The boon pool gets a sixth type, **STREET** (red), for traffic and the chase, and keeps the other five. New cards:

| Boon | Type | Effect | Max |
| --- | --- | --- | --- |
| Roof Rider | STREET | Car and bus roofs grind like rails | 1 |
| Slipstream | STREET | Rolling right behind a car for 1 s gives a speed burst | 2 |
| Hood Pop | STREET | Car-hops bounce 50% higher | 2 |
| Spoofed Plate | STREET | Robotaxis don't brake for you | 1 |
| Jaywalker | STREET | Near-miss window doubled, near-miss stoke doubled | 1 |
| Siren Song | COOL | Each car-hop takes an extra 10 Heat off | 2 |
| Decoy | COOL | The first time Heat reaches 75 on a floor, a decoy board pulls the cruiser back to 35 | 1 |
| Ghost Mode | COOL | Flock cameras don't see you: Heat from slow skating is halved | 1 |

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
| Slam | +35 |
| Each second below base speed (recovering from a slam) | +10 |
| Landed trick | −3 |
| Grind, per second | −4 |
| Car-hop | −8 |
| Near-miss | −5 |
| Clean skating, per second (no slam in the last 3 s) | −6 |
| Clear the floor | reset to 0 |

  So **three slams close together end the run**, two are a scare you can skate out of, and one is forgiven after
  about 8 seconds of clean skating (less with tricks and grinds).
- **Escalation, not surprise.** At 50 the siren layer comes in and the cruiser's lights reach the screen. At 75 a
  drone drops in front and the music thins out. At 90 the screen edge pulses and the phone vibrates. Every
  step is readable at a glance.
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

District gravity (Atlantis 0.8, Space 0.6) is dropped: every floor is 1.0.

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
| **STREET** | Red | Traffic: car-hops, roofs, near-misses (see Run structure) |

### Starting boon pool (draft)

The first playable set (M1) is the six POP and six GRIND boons below; FLOW, LUCK, COOL and STREET come later.

| Boon | Type | Effect | Max |
| --- | --- | --- | --- |
| Triple Threat | POP | +1 jump (QFS Triple Jump) | 1 |
| Big Pop | POP | +20% ollie height | 3 |
| Boostin | POP | Gravity is halved while a flip trick animates | 1 |
| Late Flip | POP | Air tricks give a full jump, not a smaller hop | 1 |
| Mad Pop | POP | Keep holding after an ollie and gravity drops 30% after 0.25 s, so you float | 1 |
| Spare Change | POP | Every grind refills +0.25 jump charge above your max | 3 |
| Strong Legs | POP | Normally a press during the landing's impact (350 ms) is lost. With this, a second tap during it ollies at once | 1 |
| Rail Magnet | GRIND | Rails pull you in from 48 px further away | 2 |
| Ledge Butter | GRIND | +25% grind speed, minimum grind speed doubled | 2 |
| Full Sail | GRIND | Ollieing off a rail adds your grind speed to the ollie height | 1 |
| Sparky | GRIND | Grinding leaves sparks that make cars swerve out of the skate lane | 1 |
| More Wax | GRIND | +10% grind speed every 0.5 s on one flat ledge, rail or power line, until you leave it. It doesn't build down handrails | 1 |
| Ghost Rail | GRIND | Your last grind leaves a 2 s ghost rail behind you in the air | 1 |
| New Wheels | FLOW | +20% base speed and +20% score (QFS New Wheels) | 2 |
| Bomb Hill | FLOW | Flow speed bleeds off half as fast | 1 |
| Butter | FLOW | Landing on flat ground keeps 100% of air speed | 1 |
| Kicker Boost | FLOW | Kickers and ramps launch 30% harder and trigger a bomb | 1 |
| Slingshot | FLOW | Curved-rail launches ×1.5 | 2 |
| Firecracker | FLOW | Roll into a stair set without popping and you ride it down in a manual, the tail clacking on each step, instead of slamming. Ollie out any time | 1 |
| Stoken Magnet | LUCK | Pickups fly to you (QFS) | 1 |
| Double Stoken | LUCK | 2× Stoken (QFS) | 1 |
| Hustler | LUCK | +1 card on every boon pick | 1 |
| Low Profile | COOL | Heat rises 25% slower (QFS Tough Skin) | 3 |
| Bubble Pads | COOL | The first slam each floor costs no speed and no Heat (QFS Bubble Shield) | 2 |
| Tuck and Roll | COOL | Falling into a gap bounces you back up once per floor instead of ending the run | 1 |
| Slam Stoke | COOL | A slam gives +50% stoke instead of losing your combo | 1 |

### Combos (duo boons)

When you hold two specific boons, a third, rarer card can appear that fuses them, in the spirit of Hades duo
boons and Noita's spell interactions. Examples:

- **Full Sail + Big Pop → Rocket Grind:** ollie off a rail at max grind speed and you launch straight up, refilling all jumps at the top.
- **Ghost Rail + Triple Threat → Sky Line:** every air trick leaves a short ghost rail under you.
- **Butter + Slingshot → Perpetual Motion:** flow speed never decays.

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
- Mods are **triggers** and **effects**. A trigger (On Ollie, On Land, On Grind Start, On Grind End, On Trick,
  On Car-hop) fires the effects that follow it in the slots, left to right, until the next trigger.
- Effects: Spark Trail, Double Pop (a second small ollie 0.2 s later), Speed Kick, Jump Refill (+0.5),
  Cash Burst, Slow-mo (0.5 s), Gravity Flip (0.3 s), Shockwave (makes nearby cars swerve out of the skate lane).
- Modifiers change the next effect: ×2, Delay 0.5 s, Only On Combo ×5, Chance 50%.
- Example build: `[On Grind End] [×2] [Speed Kick]` = every time you leave a rail you get two speed kicks.

Boards also have **base stats** (from the deck you pick): pop, grind grip, speed, weight, slots. Decks are
unlocked in the meta tree. The shop also sells a Heat cool-down, a boon reroll and a slot.

This is the deepest system and the riskiest one for scope. Decided Oct 23, 2026: a **light version ships at launch**
(3 slots, about 6 triggers and 8 effects, no modifiers), built after boons are fun (see Milestones). Modifiers,
extra slots and a bigger mod pool come in updates.

Built Oct 24, 2026 (overnight): the four modifiers, sold in the shop. A modifier changes the next effect after it
in the slots; several stack (Times Two then Coin Flip is 0 or 6). Times Two fires it twice, Delay fires it 0.5 s
later, Combo Only (COMBO 5+) fires it only in a combo of 5 or more and then twice, and Coin Flip (50/50) fires it
not at all or three times. A trigger with nothing after it still does nothing.

Built Oct 24, 2026 (light version): 3 slots (up to 5 at $60 each), 6 triggers and the 8 effects above. A trigger
fires the effects to its right until the next trigger; an effect with no trigger to its left does nothing. The shop
stocks 4 mods (at least one trigger and one effect) for $15 to $45, a slot and a restock ($10, then +5). Tap a mod
then a slot to buy it there; tap two slots to swap them for free. The board shows as a strip of slots bottom left,
and a slot flashes when it fires. No Heat cool-down or boon reroll in the shop yet.

## Gear and wear

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
- **Later:** decks from the meta tree can wear slower (a "pro deck" stat), and boons can play with wear (a curse
  that wears gear twice as fast for a big effect, or a LUCK boon that repairs a part on each floor clear).

## Meta progression

**Stoken** (the QFS currency, kept for the universe) is earned in runs and kept when you bail. It is spent on an
**unlock tree** with three branches:

- **Deck shop:** new decks (stats and slot counts), new skaters (Webster, Keanu, Roxy, Goldie from QFS; Lou Gnar
  is the default). Each skater has one small passive and leans the first boon pick toward one type (decided
  Oct 23, 2026; draft passives below, to be balanced).
- **Boon library:** unlocks boons into the pool. A run starts with 12 of the boons above; the rest are unlocked.
  Also unlocks duo boons and curses.
- **Spots:** unlocks biomes as starting points (after you've reached them), daily runs, and a "gnar mode"
  (harder: traffic one rank up, better Stoken).

| Skater | Passive (draft) | First boon pick leans to |
| --- | --- | --- |
| Lou Gnar (default) | None: the baseline | Any |
| Webster | Grinds start 15% faster | GRIND |
| Keanu | Heat cools 15% faster while you're airborne | COOL |
| Roxy | Car-hops bounce 20% higher | STREET |
| Goldie | +25% cash from every source | LUCK |

Built Oct 24, 2026 (first version, src/run/meta.ts): an UNLOCKS screen off the run-over screen. Skaters cost 30
to 60 Stoken with the passives above. Decks: Popsicle (stock, 3 slots), Cruiser (+10% speed, ollies 5% lower,
25), Bombhill (+15% speed, gear wears 30% faster, 35), Slab (4 slots, ollies 8% lower, 45). Boon library: POP and
GRIND to start; FLOW, COOL, STREET and LUCK packs (15 to 25) add their boons and their road signs; Curses (35) and
Duos (40). Spots: the daily run (20; one seed per UTC day, its own best). Biome starts and gnar mode are still to
come. See docs/overnight-decisions.md.

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

### Spin tokens and the end-of-run payout (from Jetpack Joyride)

Added Oct 31, 2026 (zack). **Spin tokens** turn up rarely: in a smashed prop now and then, at the end of a side line,
and on the top route. When the run ends, before the summary, each token pulls a three-reel slot machine once. It pays:

- Stoken (most pulls, small amounts),
- a head start for the next run (cash, a fresh deck, or a free boon pick),
- a free continue held for the next run,
- now and then a cosmetic.

Three of a kind pays big. Runs that end badly still pay something, so losing stings less, and smashing props and
taking the risky lines are worth more. The machine skips with a tap and plays every pull at once when you have many.

Built Oct 31, 2026 (src/gen/spin-tokens.ts, src/run/slots.ts, src/ui/slots-panel.ts): a token is a red casino chip
with a gold star. A floor has a 15% chance of one prop hiding a token, the side line's prize is a token a quarter of
the time, and one of the top route's Stoken can be a token. A plain pull pays 2 to 5 Stoken; three ◆ pay 25 Stoken,
three $ a $40 head start, three ⚡ a free boon at the next run's start, three ♥ a saved continue (2 held at most), and
three ★ a grip colour. A tap stops the reels, the next goes on to the summary. Tokens found on a floor you continue
from are lost with the rest of that floor.

## Scoring and stoke

- **Score** = tricks × combo × speed multiplier + floor clear (`250 × floor`, QFS) + Stoken grabbed.
- **Combo** builds with tricks, grinds and car-hops without touching the ground; landing banks it.
- **Stoke meter** fills with the combo. Full stoke gives a short "gnar" state: speed up, and slams cost no Heat.
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
  `land.wav` yet) and rolling over glass; a spin token plays the Stoken a little higher. Ambience, passing cars and
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

## UI

- **HUD:** decided Oct 24, 2026 from zack's comic ink mockup (openspec change ui1-hud): the GNAR RUN logo with act
  and floor top left; score and combo (with the combo's points) top middle; cash, Stoken and pause top right; the
  Stoke meter into GNAR MODE and the Heat meter (the cruiser, 10 segments, stars at 25/50/75/90) under them; board
  mods bottom left and gear wear bottom right. The middle of the screen stays clear. Heat keeps its world cues
  (sirens, light, edge glow) as well as the bar.
- **Boon pick:** three large cards, tap to pick, long-press to read. Reuse QFS's card layout and deal animation.
- **Shop:** board slots across the top, mods below, drag to place. Must work with one thumb.
- **Pause:** resume, settings, run summary (boons, mods), abandon run. Built Oct 24, 2026: sound and music sliders,
  vibration, effects quality, reduce motion, reduce flashing, Heat stripes, and QUIT RUN.
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
5. Spin tokens and the end-of-run slot machine.

**Then**
6. The Chinatown downhill: skitch cabs and cross traffic.
7. Tee physics, and Blender texture painting for the models.
8. Grass strips that punish worn wheels.
9. Wall rides, only if they earn their place.

**Ship**
10. A performance pass for small iPhones.
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

- **Build-driven paths** (future direction under Run structure): whole sky, street and sewer acts; which boons lead
  to each, and how each is designed for them.
- **The sewer route**: built out Oct 31, 2026 (see Three routes); art pass from zack's refs (`sewer/refs/`) next.
- **Wall rides** (from Alto's Odyssey and OlliOlli World): ollie into a building wall, billboard or bus side,
  ride along it for a beat and tap to pop off it higher. zack likes them but hasn't decided how they'd be used.
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
9. ~~Name.~~ Decided: **Gnar Run**.
