# Lou Gnar: Gnarlike — Game Design Document

Oct 23, 2026 · @webgnar · Draft 3 (working title)

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
3. **Biome change** every 3 floors: new 3D kit, gravity and traffic, then the **Skate Shop**
   (the Noita Holy Mountain beat): buy and arrange board mods, cool off Heat, maybe a free boon.
4. **Run over.** Fall into a gap, or let the AI's Heat catch you, and the run ends. Score, deepest floor and Stoken earned are shown and posted.
5. **Between runs**, spend Stoken on the unlock tree, then go again. Restart is one tap.

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
  Jumps refill on landing, on any grind, on a car-hop, and on riding off a curved rail.
- **Jump charge**: jumps are a number, not an integer (Lou Gnar's 1.75). A partial jump gives a partial hop.
  Several boons add or drain fractions.
- **Trick names** pop on screen: ollie, kickflip, heelflip, 360 flip, hardflip, shuvit. Each trick in a combo
  without touching the ground adds to the combo multiplier.
- **Landing**: land with the board under you or take a slam (see Getting hit). Landing on a slope downhill keeps speed.

### Grinding

- Flat, 45° and curved rails, plus grindable ledges and one-way grind rails (QFS's `GRIND_PLATFORM`).
- Landing on a rail from above snaps you on; you keep rolling at least at minimum grind speed.
- Grinding refills jumps, raises the speed cap, and builds **grind meter** (stoke).
- Curved rails follow QFS exactly: gravity along the curve (no player nudge), launch off the end along the
  rail's angle with the speed carried.
- Grind poses (50-50, 5-0, crooked, boardslide) change automatically every rail length, as Lou Gnar's random grind
  animations do. Each change counts as a grind trick for stoke and for boons that trigger on grind tricks.

### Traffic (the main hazard)

Car traffic is the hazard (decided Oct 23, 2026; details still being designed). Because the game is 2.5D, the
street has depth: the skate lane is the plane you ride on, and more lanes run in front of it and behind it. Only
vehicles in the skate lane can hit you; the others are there for life and noise, and for telegraphing.

| Vehicle | Behaviour | What you do |
| --- | --- | --- |
| **Robotaxi** (same direction) | The AI's self-driving cars, slower than you. You catch them from behind. They brake hard when you get close | Ollie onto the trunk, ride the roof, hop off the hood |
| **Oncoming car** | Comes at you in the skate lane; closing speed is very high | Time an ollie over it, or land on the roof for a car-hop |
| **Cross traffic** | At intersections, cars cut across the skate lane from the back lanes | Read the traffic light and headlights, time the gap or ollie over |
| **Parked car** | Static. A door can swing open as you pass | A platform; the door is a hazard and a launch |
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

Open: does traffic follow the level pieces (cars placed by the generator) or run on a timer (a traffic director
spawning by time with guaranteed gaps)? The draft leans toward a director with the generator marking
intersections, bus stops and parking.

### Getting hit and ending a run

There's one life, as in Lou Gnar, and hits don't kill you (decided Oct 23, 2026). Damage costs momentum, not health:

- **Slam:** clipping a car, landing mid-flip, or hitting a wall at speed. The skater wipes out, the board flies, and
  the skater is back on it in about 0.6 s. You drop to half speed, lose your combo and gain **Heat**.
- **Heat** is the AI closing in. It shows as sirens and red-blue light growing from the left edge of the screen,
  plus louder audio. Slams and slow skating raise it; speed, tricks and car-hops lower it. At full Heat an
  enforcer catches you and the run is over.
- **Bail:** falling into a gap or canal ends the run immediately, as in Lou Gnar.
- Clearing a floor resets Heat to zero.

This keeps runs fast and tense: no health bar to manage, just keep moving, but one mistake is never the end.
The exact Heat numbers need prototyping.

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
| `B` | Bus stop: a bus pulls into the skate lane | New |
| `$` | Cash line (a row of pickups that teaches a line) | New |
| `C` | Chest / stash (cash, Stoken, sometimes a boon) | QFS |
| `?` | Event spot: shrine, gap challenge, NPC | New |

All 20 QFS pieces port as tier 1–3 pieces on day one; new skate pieces (kicker gaps, rail gardens, stair sets)
are added per biome.

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

Biomes are QFS's worlds, a new one every 3 floors, each with its own gravity, 3D kit, hazard set and a twist:

| # | Biome | Gravity | Twist |
| --- | --- | --- | --- |
| 1 | Chicago streets | 1.0 | Tutorial-friendly: kiosks, canals, flat rails |
| 2 | Clemente Park | 1.0 | Ledges and long flat grinds; pigeons and drones to car-hop |
| 3 | Ancient Greece | 1.0 | Columns as curved rails; collapsing ruins |
| 4 | Atlantis | 0.8 | Floaty, slow fall; currents push you sideways |
| 5 | Art Museum | 1.0 | Indoor, low ceilings; no high ollies, all grind lines |
| 6 | High-Tech City | 1.0 | Security drones; conveyor rails |
| 7 | Outer Space | 0.6 | Huge air; gaps sized for it |
| 8+ | Mixed worlds | varies | QFS mixed skins at random, same seed = same floor |

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

| Boon | Type | Effect | Max |
| --- | --- | --- | --- |
| Triple Threat | POP | +1 jump (QFS Triple Jump) | 1 |
| Big Pop | POP | +20% ollie height | 3 |
| Floaty Flip | POP | Gravity is halved while a flip trick animates | 1 |
| Late Flip | POP | Air tricks give a full jump, not a smaller hop | 1 |
| Pressure Flip | POP | Holding ollie longer than 0.5 s pops 40% higher but takes 0.2 s to charge | 1 |
| Spare Change | POP | Every grind refills +0.25 jump charge above your max | 3 |
| Rail Magnet | GRIND | Rails pull you in from 48 px further away | 2 |
| Grease | GRIND | +25% grind speed, minimum grind speed doubled | 2 |
| Rail Launch | GRIND | Ollieing off a rail adds your grind speed to the ollie height | 1 |
| Sparky | GRIND | Grinding leaves sparks that stun hazards they touch | 1 |
| Feeble Frenzy | GRIND | Each grind trick on one rail adds +10% speed until you leave it | 1 |
| Ghost Rail | GRIND | Your last grind leaves a 2 s ghost rail behind you in the air | 1 |
| New Wheels | FLOW | +20% base speed and +20% score (QFS New Wheels) | 2 |
| Bomb Hill | FLOW | Flow speed bleeds off half as fast | 1 |
| Butter | FLOW | Landing on flat ground keeps 100% of air speed | 1 |
| Kicker Boost | FLOW | Kickers and ramps launch 30% harder and trigger a bomb | 1 |
| Slingshot | FLOW | Curved-rail launches ×1.5 | 2 |
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

- **Rail Launch + Big Pop → Rocket Grind:** ollie off a rail at max grind speed and you launch straight up, refilling all jumps at the top.
- **Ghost Rail + Triple Threat → Sky Line:** every air trick leaves a short ghost rail under you.
- **Butter + Slingshot → Perpetual Motion:** flow speed never decays.

### Curses (trade-offs)

From floor 6, one card in three may be a **cursed** boon: a strong effect with a cost, shown with a purple border.
Examples: *Moon Shoes* (+60% ollie height, −30% grind speed), *Wanted* (2× Stoken, Heat rises twice as fast),
*Speed Wobbles* (+40% speed, landings above flow speed cause a slam).

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

This is the deepest system and the riskiest one for scope. It ships after boons are fun (see Milestones), and the
first version can be just "3 slots, 6 triggers, 8 effects".

## Meta progression

**Stoken** (the QFS currency, kept for the universe) is earned in runs and kept when you bail. It is spent on an
**unlock tree** with three branches:

- **Deck shop:** new decks (stats and slot counts), new skaters (Webster, Keanu, Roxy, Goldie from QFS; Lou Gnar
  is the default). Skaters are cosmetic plus one passive each, *to be decided*.
- **Boon library:** unlocks boons into the pool. A run starts with 12 of the boons above; the rest are unlocked.
  Also unlocks duo boons and curses.
- **Spots:** unlocks biomes as starting points (after you've reached them), daily runs, and a "gnar mode"
  (harder: traffic one rank up, better Stoken).

Small permanent stat buffs are kept rare and capped (for example Heat starts 10% lower, a free reroll per run), so
skill and builds stay the point, not grinding the tree. Unlocking is mostly *more variety*, not *more power*.

## Scoring and stoke

- **Score** = tricks × combo × speed multiplier + floor clear (`250 × floor`, QFS) + Stoken grabbed.
- **Combo** builds with tricks, grinds and car-hops without touching the ground; landing banks it.
- **Stoke meter** fills with the combo. Full stoke gives a short "gnar" state: speed up, and slams cost no Heat.
- **Leaderboards:** deepest floor, high score, daily seed. Port `api/leaderboard.ts` and `leaderboard-service.ts` from excaliburSkate.

## Presentation (3D)

The game is 3D in JavaScript, as a **2.5D side view** (decided Oct 23, 2026). Everything is 3D models and
lighting, but the skater rides on one plane, left to right, so the QFS physics and the chunk generator work in
x and y and the z axis is only for looks.

- **Camera:** a perspective camera to the side and slightly above, about 15° down. It leads ahead and pulls back
  and widens its field of view at high speed. For big airs and curved-rail launches it swings a little toward a
  three-quarter view for drama, then swings back.
- **World:** each ASCII piece becomes a strip of 3D kit pieces: street, curb, kiosk, rooftop, ledge, rail, stairs,
  kicker. Depth comes from real background buildings, props and skyline instead of parallax layers.
- **Art style:** low-poly with flat, toon-shaded colours, which keeps the pixel-art cheerfulness of both games,
  stays light on phones, and is fast to model. Low-res texture atlases with nearest-neighbour filtering can nod
  to the pixel art.
- **Skater:** one rigged low-poly model (Lou Gnar first), with animations for push, ollie, kickflip, heelflip,
  360 flip, hardflip, shuvit, the four grind poses, landing, slam and bail. Flip tricks spin the board as a
  separate object, so new tricks are mostly code.
- **Traffic:** low-poly cars, buses, trucks and enforcer cruisers with working headlights, brake lights and
  indicators, plus drones and pigeons. Rank colours become paint jobs and an emissive outline (QFS's rank outline).
- **Juice:** squash and stretch on the model, landing dust and grind sparks as GPU particles, trick name text,
  camera shake on slams, a speed-lines effect at flow speed.
- **Lighting:** one directional light with baked ambient occlusion on the kit; a real-time shadow only under the
  skater (a blob shadow on low-end phones).
- Landscape, rendered at device pixel ratio up to 2 and scaled down automatically when the frame rate drops.
- Music per biome; reuse the title and gameplay tracks first.

### Immersion

- **Sound first:** city ambience per biome, cars passing with Doppler and stereo panning, horns, wheels sounding
  different on asphalt, concrete, metal rails and car roofs, and sirens that rise with Heat. Headphones are the
  intended way to play.
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

- **HUD:** kept minimal for immersion. Heat is shown by the world (sirens, light), not a bar; cash and Stoken top right, floor number and biome on the banner, jump pips
  above the skater (Lou Gnar's jump counter), stoke meter along the bottom.
- **Boon pick:** three large cards, tap to pick, long-press to read. Reuse QFS's card layout and deal animation.
- **Shop:** board slots across the top, mods below, drag to place. Must work with one thumb.
- **Pause:** resume, settings, run summary (boons, mods), abandon run.
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

## Milestones

| | Goal | Done when |
| --- | --- | --- |
| M0 | Physics port | A Three.js scene with a placeholder skater; QFS ollie, variable jump, double jump flip, flat/sloped/curved grinds and bombs feel right with one button on a test level on a phone |
| M1 | Floors | Generator ports all 20 QFS pieces, validates reachability, exit portal and floor counter work |
| M2 | Run loop | Traffic, car-hop, slams and Heat, bail, boon pick with ~12 boons, game over, leaderboard |
| M3 | Biomes | 3 biomes with gravity and 3D kits, biome change every 3 floors |
| M4 | Meta | Stoken, unlock tree, decks, saves |
| M5 | Board build | Skate Shop, 3-slot boards, first triggers and effects |
| M6 | Polish | Duo boons, curses, daily seed, PWA, tutorial floor, audio |

The new game lives in this repo (webgnar/skate-rogue); the old 2D runner stays live in excaliburSkate until M2 is better than it.

## Open questions

1. ~~How much steering?~~ Decided: pure auto-run, one button (see Controls).
2. ~~Which 3D?~~ Decided: 2.5D side view (see Presentation).
3. ~~Which world?~~ Decided: the Stoken world (see Setting).
4. **Traffic.** Decided: car traffic is the main hazard. Still open: does a traffic director spawn cars on a
   timer, or does the generator place them? How do cars that brake when you're close actually feel?
5. ~~Health.~~ Decided: one life, hits cost speed and raise Heat, and a gap or full Heat ends the run.
6. **Run length.** Endless floors (QFS Survivor), or a final boss-free "last spot" at floor 21 with endless after?
7. **Skaters.** Cosmetic, or one passive each?
8. **Board build scope.** Is the Noita-style mod system wanted for launch, or after boons prove fun?
9. **Name.** "Lou Gnar: Gnarlike" is a placeholder.
