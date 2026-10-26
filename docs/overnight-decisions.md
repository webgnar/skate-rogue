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

## Effects thread: fx12 screen and gate juice

- **The pick screen closes with the picked card popping**, which delays hiding it by 0.3 s. The game is already
  skating again underneath, so this adds no wait.
- **The shop deals its stock in only when it opens.** Before this it replayed the deal on every tap, which felt
  jittery.
- **Gates wake within 12 tiles**: a portal of rings fills the arch and grows brighter.
- **Fork signs are unchanged for now.** Lighting the chosen road's sign needs a live "high or low" signal while
  skating, and that is the gameplay thread's call.

## Effects thread: fx13 biome looks

- **For now a biome is a colour grade plus something in the air.** The table is in
  `openspec/changes/fx13-biome-looks/proposal.md`. Each biome's real tileset and kit is a models and gameplay job.
  Until those exist the grade is subtle, because the Chicago buildings fill the frame. Preview any biome with
  `?biome=atlantis` (or clemente, greece, museum, hightech, space, hive).
- **Gravity per biome is listed in the look table for reference only.** The sim owns gravity.

## Effects thread: fx7 leftovers

- **Neon shop signs**: words like BAR, PIZZA, OPEN, LIQUOR, 24H and ARCADE sit above the wall on about 60% of the
  street lamp spots. They are all one merged mesh, so one draw call. Now and then one tired tube dims for a third of a
  second; this is off with reduce flashing.
- **Tail lights** smear a red glow behind each car from dusk.

## Effects thread: fx14 smashables

- **A prop's material comes from its name**, so a new prop works without any code. Bottle is glass, NewsBox is
  metal, Crate is wood, and so on.
- **Only big smashes get a word and a camera kick.** That means landing on a prop, a slam, a bomb, a car-hop, or a
  roll-through at 1.5x cruising speed or faster. Rolling through a row of cones at normal speed just bursts them,
  so the screen doesn't fill with words.
- **Pieces live 1.1 s, with at most 24 at once** (12 on the low tier). They draw while they fly, then free up.
- **Placement has one source: the sim's level.props.** I asked gameplay and models to agree on this, so the
  index in a smash event hides the right prop.
- **Smashes are now wired end to end** (sim events from #53, z from #54, piece offsets fixed at the source in
  #57).
- **Visor glint (src/render/visor-glint.ts).** The strip from models (#58) sits at 0.3 opacity by day and rises to
  0.75 at full neon. At night it tints toward the district's light: pink in the city, cyan in High-Tech and
  Atlantis, amber in the Hive. It gleams for a quarter second on each trick and landing. Only the visor
  brightens, and with reduce-flashing on there's no gleam at all.
- **Fewer draw calls for the street kit (src/render/kit-merge.ts).** Floors were drawing 150 to 220 calls, far over
  what an older iPhone handles well. Each building drew its front, top and sides separately, plus its own outline.
  Now the tops and sides batch with matching kit, and every static outline merges into one mesh. Floor 1 dropped
  from about 190 calls to about 60, and floor 12 from about 200 to about 45. In screenshots the look is unchanged.
  Building fronts keep one draw each because each has its own window map; an atlas could cut those later.
  Anything that moves keeps its own outline: gates, fork signs, and props.
- **Cardboard boxes break like paper**, not wood. The name matched wood's "board" first.
- **Gear wear puffs (gameplay's wear event, #61).** Each part puffs from where it sits on Lou. The deck throws
  wood splinters, the shoes scuff up a grey puff at the feet, the trucks spark, and the wheels drop rubber crumbs
  behind him. "Busted" uses about 1.8x the particles of "worn". There's no flash and no camera kick, so it reads as
  a nudge, not a hit.
- **Landing dust follows the sim's impact (physics feel, #65).** It reads FEEL's thresholds instead of
  hard-coded numbers. A kiss (under FEEL.soft) barely puffs, and a normal landing dusts. A heavy one (FEEL.heavy and
  up) bursts and kicks the camera from 0.06, growing to a 0.2 cap, which stays well under a slam's kick. A sketchy
  landing without a flip still gets the lopsided scuff. Grind sparks now follow what you grind (skater.material)
  instead of rail versus ledge mode.
- **Per-district backdrops (src/render/biomes.ts BACKDROPS).** These are QFS's own world layers, used as far cards
  behind the street:
  - Clemente: its park wall and trees.
  - Atlantis: the wave band, with the blue dragon behind it.
  - Museum: the night-city photo, with the Chicago sculptures in front.
  - High-Tech: the green sculpture skyline.
  - Space: stars and a planet.
  - Chicago and the Hive keep the pink skyline. Greece has only its sky, as in QFS.

  Each card drifts at its own parallax and takes the mood tint, so red and blue neon stays lit at night. Images are
  cropped and padded from the QFS sprites into public/tex/bkgd_*.png. The models thread did the per-biome kits
  (#71), and I took the backdrops.
- **Looks for the rest of the boons, the curses and the duos (boon-fx.ts).** Each one shows only on its own moment,
  in its card's colour:
  - Hood Pop: a red ring off the roof. Siren Song: blue notes rising from a car hop.
  - Kicker Boost: cyan streaks off the tailgate. Slingshot: streaks ahead off a rail's end.
  - Butter: a yellow smear on a fast landing. Bubble Pads: a slam pops into soap bubbles.
  - Tuck and Roll: a blue ring. Slam Stoke: pink sparks.
  - Bomb Hill: a cyan trail while extra speed lasts. Perpetual Motion: a pink trail.
  - Curses wear purple. Moon Shoes leaves a slow moon-dust puff. Speed Wobbles sheds wisps when you're airborne too
    fast. Wanted sends a bounty pixel up now and then.
  - Duos wear pink. Rocket Grind blasts a column off a fast grind. Sky Line draws a pink line under each trick.
  - Not given a look: Low Profile, Decoy, Jaywalker, Spoofed Plate, Double Stoken, Hustler, Lucky Reroll, Stoken
    Magnet, Roof Rider, Slipstream. They're either menu effects, or the sim doesn't tell the view when they fire.
- **No rain in Atlantis, the museum or space** (BIOMES `dry`). It's under the sea, indoors and a vacuum.
- **Roadblock sirens (siren-fx.ts).** Each parked cruiser's light bar throws red and blue pools on the street. They
  swap smoothly at 0.9 per second, like the chasing cruiser, and are brighter at night. With reduce-flashing on they
  hold steady. Two instanced draws cover the whole roadblock.
- **Escape set pieces kick up the street (escape-fx.ts).**
  - Helicopter: its rotor wash blows grit flat out both ways under it, twice as hard while its light has you, with
    the odd scrap of litter tumbling up. There's none under the L tracks, matching its light.
  - Act 3 chasers: the wave throws foam off its lip and mist at its foot, the chariot kicks hoof dust with sparks
    off its wheel, and the guards kick running dust. Each throws 2.5x more while it surges after a slam.
  - The helicopter's light pool holds steady with reduce-flashing instead of pulsing.
- **A claimed bounty pays out in a violet-and-gold fountain** at the gate, alongside the BOUNTY CLAIMED callout.
- **Filmers' phones (phone-fx.ts).** The people filming you (peds.ts) hold up a phone with a small cold screen glow,
  faint by day and clear at night. Land a big air near one and it snaps a photo: a small white flash at the phone
  that fades in about a sixth of a second. It's a spot the size of a person's head, never the screen, and
  reduce-flashing turns it off. Two instanced draws for everyone. I touched peds.ts only to report where the phones
  are and when they snap.
- **The gate shows when a bounty will pay (gate-fx.ts).** On a wanted-poster floor, once Heat is at the bounty's 50,
  the exit portal turns the payout's violet with a faint gold rim. It eases over about 0.4 s each way, so Heat
  hovering at 50 fades it rather than flickering it. Before this, the only feedback was the callout after you'd
  already reached the gate.
- **Chunky pixel look, a live setting (zack's ask).** The pause card has a PIXELS slider from SHARP to 4X. It sets
  how many screen pixels each rendered pixel covers (CSS px, so it looks the same on any phone) and scales up
  hard-edged with no blur. It applies immediately and is saved; `?pixel=3` sets it from the URL. Ink lines are
  kept at least one rendered pixel wide so they don't break up. I capped it at 4X because past that the ink
  swallows the skater. Default stays SHARP. It also helps frame rate, since fewer pixels get drawn.
- **Polished steel on every grind rail (rail-metal.ts, zack's ask).** Covers flat rails, curved handrails and the L's
  running rails. It's one shared matcap material: a painted chrome ball (sky, a hard white horizon line, dark street,
  a hot spot and a pink neon rim), stepped into bands like the toon shading. The shine slides along the rail as the
  camera moves, without paying for an environment map or lights. A tiling pixel normal map adds brushed grooves,
  a few dents, and a smooth worn strip along the top where boards grind. Flat rails are now round pipes, because
  chrome on a flat-faced bar shows a single colour. At night the steel dims to a violet tint. All rails still batch
  into one draw. The L's modelled rails have no UVs, so they get the same chrome without the dents. The L's girders
  keep the riveted steel from #146: that's structure, not something you grind.
- **The cruiser jets across canals (cruiser-jets.ts, zack's ask).** When the Heat cruiser jumps a canal, two
  thruster pods fold down out of its sill on the camera side, between the wheels, in about 0.1 s. They fire a
  white-hot core inside an orange flame, plus smoke and embers. The flames are longest on the way up and flicker
  in length only, never in brightness, so nothing strobes. The pods fold away about half a second after the
  landing, which kicks up dust. They're only drawn while they're out, so the cruiser costs nothing extra on the
  street.
- **Smashed props disappear, and the debris is the prop (zack's ask).**
  - **The bug:** the next floor is built before you reach it, and building its props overwrote the one shared props
    record. So a smash hid that index on the floor ahead, not the prop you hit, and the intact model stayed put.
    Each floor now keeps its own props (`propsFor(level)`), and a headless run hid 6 of 6 smashed props.
  - **The debris:** a prop without Blender break pieces now has its own model cut into chunks (`shatter`), so the
    debris carries its colours and shapes. Chips take the prop's main colours, plus its material's: glass glints,
    wood dust, metal sparks.
- **Less rain (zack's ask).** A floor's chance of rain is down from 1 in 4 to about 1 in 8 (`RAIN_CHANCE` 0.13),
  and it never rains on two floors in a row, so a shower passes over one floor and clears. Across a 15-floor run
  that's about 12% of floors, down from about 25%. `?seed=7&floor=12` is still a rainy night for testing.
- **No screen shake for plain smashing, for now (zack's ask).** Rolling through, landing on, grinding or hopping
  something still gets the break, the pieces and the comic word, but the camera holds still. A slam into a prop,
  or a car smashing through one, still shakes. To bring it back, add the hit kinds to `SMASH.shakeOn` in
  src/render/smash.ts. Slams, car hops and heavy landings keep their own shakes.
- **Landmarks get no extra night treatment.** I checked all seven at floor 13. They already carry their own glowing
  materials and read fine against the night sky, so I left them alone.

## Effects thread: fx6 leftovers

- **The wet look is darker kit, not a shine.** Toon materials have no specular, and a gloss shader on every kit
  material would cost too much, so in rain the street kit goes up to 22% darker. The puddles carry the
  reflections.
- **Drips fall from roof and overpass corners** near the camera, scaled by how hard it rains.

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
- **Cross traffic (from floor 5).** About one intersection per floor on open street (never by a parked car,
  glass or a canal), with a traffic light and a crosswalk. Its car pulls off in the back lane when you come in
  range, takes over a second to reach the skate lane (the light is red the whole time), crosses it in about half
  a second and carries on into the front lane, then repeats every 200 frames. The floor seed times it, so it
  might block the lane as you arrive (ollie it, or land on it for a car hop), be just clearing, or let you beat
  it across (that one can be a close call). Hitting it is a slam.
- **Parked car doors: held back.** In the side view a door swings toward the camera, across lanes, not along the
  street, so it can't really be in your way or launch you without faking it. Worth a quick look together; for
  now parked cars stay platforms. The bus stop that pulls a bus into the lane is also still to do.

- **Heat now carries between floors, at half.** The GDD's Heat table says clearing a floor resets Heat to 0, but
  the run-structure section says the underground spot "comes with carried-over Heat", and "start the next floor
  at 0 Heat" means nothing without it. So the Heat you leave a floor with, halved, is where the next floor starts
  (a hot street or an escape starts at the higher of its own 30 and that). This makes runs a bit hotter overall;
  easy to tune (`ROADS.heatCarry`) or turn off (0).
- **Underground spot (from the floor 3 fork, 15% of forks, beside a boon street).** No floor of its own, like the
  shop: a screen with three cards, take one. **Lay low** (the next floor starts at 0 Heat; the card shows what
  you're carrying), **Swap a boon** (pick one of yours to drop a stack of, then a pick of 3 of any type, never
  the one you dropped, no reroll) or **Remove a curse** (greyed out until curses exist). Then you skate the boon
  street after it. A green sign on the fork.

- **FLOW and COOL boons (12 more cards).** Boon streets now come in POP, GRIND, FLOW or COOL. Built from the
  GDD's tables, with these calls of mine:
  - New Wheels +20% cruising speed and +20% banked score per stack (max 2). Bomb Hill halves how fast extra speed
    bleeds off (stacks with Exit Wax). Butter: landings keep your air speed as flow speed. Kicker Boost: tailgate
    kickers 30% harder (offered from floor 3, since trucks come in on 4). Slingshot: riding off a rail's end
    launches 50% harder per stack, capped at 12 px/frame.
  - Low Profile: Heat gains -25% per stack (3 stacks = a quarter). Bubble Pads: the first slam (two with 2 stacks)
    each floor costs nothing. Tuck and Roll: once a floor a fall into a gap bounces you back up (about 2 tiles
    over the street, jumps refilled) but costs a slam's Heat and your combo. Slam Stoke: a slam keeps your combo
    and adds a quarter of the stoke meter (the GDD said +50%, which felt like it rewarded slamming). Siren Song:
    car hops take 10 more Heat off per stack. Decoy: the first time Heat reaches 75 on a floor it drops to 35.
    Ghost Mode: half the Heat from skating slow.
- **LUCK and STREET boons (9 more cards; boon streets now come in all six types).** LUCK: Stoken Magnet
  (pickups reach 3x as far), Double Stoken (every Stoken counts twice, stash and act pay too), Hustler (+1 card on
  every pick) and one of mine, Lucky Reroll (the first reroll on each pick is free). STREET: Roof Rider (parked car
  and bus roofs grind like flat bars; moving cars still hop), Slipstream (half a second drafting within 4 tiles
  behind a car going your way throws you forward at bomb speed; a third of a second with 2), Hood Pop (+50% hop
  per stack), Spoofed Plate (robotaxis don't brake), Jaywalker (close calls from 20 px and worth double). The
  GDD's shop-price LUCK idea is left for the shop's next pass.

- **Smashables written into the GDD (zack asked).** New pillar 7, "Smash everything", and a Smashables section:
  props are juice, never hazards (they never slow or slam you); roll through, land on, grind, car-hop, slam or
  bomb to break them; a launch prop list; they give particles, small style, hidden cash, a rare Stoken prop,
  and smashing the AI's signage or Flock cameras cools Heat a little. Split: gameplay places props and emits
  break events, effects makes the breaks, models builds the props.

- **Smashables in the sim.** `level.props` is the one list of street props (scenery at the back of the sidewalk
  plus smashables in the skate lane: on the street every 4-9 tiles, and 1-3 on longer ledges and roofs). Each
  smash is worth 25 style; crates, newspaper boxes and trash cans sometimes hide 3 cash; one golden prop a floor
  holds a Stoken; the AI's kiosks, delivery bots and Flock poles take 3 Heat off. Four smashes inside 1.2 s is a
  "WRECKING BALL!". A landing from about 4 tiles up breaks everything within 2 tiles, a slam within 1.5, and a
  tailgate bomb clears the street 5 tiles ahead.

- **Cross streets (zack: "cross traffic needs cross streets").** Each intersection is now a real cross street
  on the level (`level.crossings`): the back wall and the block behind it open up, a side road with a centre
  line and kerbs runs off into the city, the main sidewalk is cut through with a crosswalk, and the traffic light
  stands on the near corner. Cross cars start 9 tiles up the side road with their headlights on (about 2 s
  before they reach your lane, light red the whole time) and drive out of shot past the front of the street.
  Street props keep out of the junction.

- **Stance and 180s (sim side, with the models thread).** zack noted a 180 leaves you riding the other foot
  forward. In one-button play the air tap throws the next trick in a fixed roll: kickflip, heelflip, BS 180,
  shuvit, kickflip, FS 180, heelflip, 360 shuvit (a quarter are 180s). A 180 flips `Skater.fakie`; shove-its spin
  only the board so they don't. Tricks thrown fakie are called "FAKIE KICKFLIP" and score 1.5x; a 180 adds +25.
  A slam puts you back regular. The stance resets each floor. Trick events now carry `name`, `spin` and `fakie`.

- **Curses and duos.** The GDD's three curses (Moon Shoes, Wanted, Speed Wobbles) and three duos (Rocket Grind,
  Sky Line, Perpetual Motion) are in. Curses: from floor 6, one offer in three replaces its last card with one;
  dashed purple card. Duos: once you hold both halves, half of all offers add it as an extra pink card. Choices I
  made: Speed Wobbles slams landings above 1.3x cruising (so kicker bombs and fast rail exits slam, plain ollies
  don't); Rocket Grind needs full grind speed and pops 1.5x; Sky Line's rail is 7 tiles long, 6 px under your feet.
  The underground spot's "Remove a curse" lifts the curse off entirely.

- **Gear and wear (zack asked).** Deck from ollies, shoes from flip tricks, trucks from grinding, wheels from
  going fast (above 1.25x cruising). Open choices, all mine: condition 100 to 0; no cost until half worn, then a
  straight line to −30% ollie / −30% flip pop / −30% grind speed / −20% cruising speed at 0; **nothing ever breaks
  outright** (a run never ends because of gear); wear per use 1.2 per ollie, 1.6 per flip, 1.2 per grind second,
  1.2 per fast second; fresh gear each run. Shop prices: deck $25, shoes $15, trucks $20, wheels $15. HUD: four
  bars bottom left, green, yellow, red. Callouts at half and at 15. Worn looks are left for the models and effects threads.

- **Cross-street cars turn onto your road (zack asked).** A cross car now pulls out of the side street to the
  skate lane (2.5 s, light red), swings round over half a second and drives off your way at 0.45x cruising as
  ordinary traffic, keeping its paint. It doesn't brake for you like a robotaxi. Its roof is a car hop while it
  pulls out, turns and drives. Choices: always turns your way (not toward you); new cars stop once you're 30
  tiles past the corner.

- **Platforms toward the camera (zack: "they dont stick out enough").** Floating ledges were 2.2 deep with their
  front edge only 0.45 in front of Lou; they now reach the same front line as rooftops, stairs and banks (1.25 in
  front of Lou). Rooftops, stairs, banks, the overpass, street pads and the L-train covers already did. Vehicle
  roofs (cars, buses, trucks, roadblocks) keep their models' widths.

- **Landing quality scores (physics feel thread asked).** A sketchy landing (flip caught late, or a drop too big
  to soak up) banks half the combo, with a red "SKETCHY" callout; it doesn't lose the combo outright, a slam
  does. A heavy landing (a big drop, landed) adds 100 "BIG DROP" style, and pays even with no tricks. An ollie
  popped right at the lip adds 30 style and counts in the combo.

- **Meta progression (PR: unlocks between runs).** The unlock tree is one screen off the run-over screen, four
  columns: skaters, decks, boon library, spots. Prices are 15 to 60 Stoken (465 for everything), a first guess.
  A new phone draws from POP and GRIND only (the GDD's 12 starting boons); FLOW, COOL, STREET and LUCK are packs,
  and curses and duos are their own unlocks. Road signs only lead to types you own. Skater passives are the GDD's
  drafts. Decks are trades, never straight upgrades: Cruiser (+10% speed, -5% ollie), Bombhill (+15% speed, gear
  wears 30% faster), Slab (4 slots, -8% ollie). Changing skater or deck reloads the page, since the skater's model
  loads at start. The daily run is a 20 Stoken unlock with its own best score; leaderboards come later. Left for
  later: biomes as starting points and the harder "gnar mode" spot (the name clashes with the stoke meter's GNAR
  MODE, so it needs another name, maybe "Gnar levels" from the GDD's win unlocks). `?unlockall` opens everything
  for testing.

- **Each act gets its own district.** Act 1 Chicago, act 2 Clemente Park (Los Angeles has no kit), act 3 Greece,
  Atlantis or the museum by the run's seed, act 4 High-Tech City, act 5 the Hive. Space is unused for now.

- **Bus stops and car doors (GDD: Traffic, tiles `B` and `E`).** From floor 4 most floors get one bus stop on
  open street (a blue sign and a bench). When you're 18 tiles away, a bus blinks in the back lane and pulls into
  your lane at the stop over 1.5 seconds, sits 5 seconds, then drives off your way. Other traffic pulls out around
  it. From floor 2, half the plain parked cars have a door that swings open when you're 9 tiles away. It's a low
  panel (30 px; a car roof is 40) standing out behind the car: roll into it and you slam, land on its edge and it
  pops you like a car hop. In side view a door can only matter if it sticks out along the street, so it's drawn
  flung open behind the car rather than toward the camera. Roadblock cars never open.

- **District gravity.** A floor's gravity follows its act's district (Atlantis 0.8, from the physics thread's
  BIOME_GRAVITY). Floors are generated and bot-checked in it, and they validated first try at 0.8 and 0.6 in a
  20-floor sample. Escape set pieces stay at normal gravity for now.

- **Act 3's escape is a chase (decision card posted; going with my recommendation).** One mechanic with a look
  per district: a tidal wave (Atlantis), a chariot (Greece), museum guards. It sits 7 tiles behind (8 at most),
  each slam lets it close 2.5 tiles, and clean skating wins back 0.6 tiles a second, so three slams close
  together get you caught. It tracks slams, not speed, because uphill rails and climbs drop your forward speed
  through no fault of yours. The looks are primitive placeholders for the models thread. zack's other options were
  three separate set pieces (the flood forcing you up high, a chariot overtaking in your lane, guards and laser
  tripwires) or keeping the roadblock; those twists can go on top of the chase later.

- **Wanted posters.** From floor 2, about one floor in three has a WANTED board where the street starts. Reach
  the gate with Heat 50 or more and the Stoken you grabbed on that floor pays again (at least 3). It's a choice
  between this run (the cruiser is close) and the unlock tree. Not on stash floors or escapes.

- **Leaderboards (GDD: Scoring and stoke).** Ported excaliburSkate's API to a Vercel function (api/leaderboard.ts)
  over a Redis store's REST API, so there's no @vercel/kv dependency (Vercel KV is now Upstash). Three boards: top
  score, deepest floor, and each day's daily run (kept 3 days); 100 entries each, top 10 shown. Players pick an
  arcade tag (3 to 10 letters or digits) the first time; after that every run posts itself. No game key: a key
  shipped in the page doesn't stop anyone, so the server only checks that entries are sane. It stays hidden
  until zack connects an Upstash Redis store to the Vercel project (steps in docs/test-checklist.md).
- **Board mod modifiers (the GDD's ×2, Delay, Only On Combo ×5, Chance 50%).** Sold in the shop with the other
  mods: Times Two ($45), Delay 0.5 s ($15), Combo Only ($30) and Coin Flip ($25). They stack on the next effect.
  Two calls of mine: Combo Only fires twice once you're in a combo of 5+ (so it pays for its slot), and the GDD's
  "Chance 50%" became Coin Flip, nothing or three times, so it's a gamble rather than a plain nerf.
- **Tutorial floor.** A new phone (no best score, no tutorial cleared) starts on a fixed seven-piece street with a
  prompt per move and no traffic or Heat; through its gate the run starts fresh on floor 1. Any test URL flag skips
  it, and `?tutorial` brings it back. Busting on it just restarts it.
- **Sound, using Lou Gnar's sounds (GDD: music, reuse the title and gameplay tracks first).** I converted
  excaliburSkate's ten sounds to mp3 (Ogg doesn't play on older iPhones) and mapped them to the sim's events, pitched
  to stretch them: the impact sample is landings, slams and car hops; ufo_explode is smashes and drones. The rolling
  wheels and the siren are synthesized (noise and an oscillator), so they need no new files. The gameplay track plays
  during runs and the title track on the run summary. Per-surface wheel sounds, Doppler cars and horns are next once
  there are samples for them.
- **Pause card settings and Quit run.** Sound and music sliders, vibration, effects quality and the three
  accessibility switches all moved from URL flags onto the pause card (the flags still work). Quit run ends the run
  with its summary and keeps its Stoken. The HUD thread can restyle the card to the mockups.
- **District twists (GDD: Biomes).** Clemente Park: rail pieces twice as often. Greece: curved-rail pieces three
  times as often (columns as curved rails; collapsing ruins are left for later). Atlantis: currents, 6 to 10 tile
  stretches that push you forward (60%) or back while you're in the air, never on the ground, so they change your
  jumps but can't stall you. Art Museum: a low ceiling over the street, a plain ollie above the highest thing you can
  land on in each piece, so flips get capped; rail pieces twice as often. High-Tech: 60% of flat rails are conveyors,
  mostly forward (+1.5 px/frame) and some back. The bot validates every floor with its twist; it needs about the
  same rerolls as before (2 to 2.5 tries against 2.2). The looks (bubbles, a ceiling slab, chevrons) are
  placeholders for the models and effects threads. Chicago, Space and the Hive have no twist yet.
- **Balance pass with bot runs (`npm run balance`, tests/balance.test.ts).** The no-boon bot skates floors 1 to 15
  (each in its district's gravity and twist) and all five escapes on 6 seeds, and the test holds the numbers to
  targets. What it showed:
  - Floors take 17 to 28 s and escapes 23 to 40 s, so a winning run is about 12 minutes, not the GDD's 20. I left
    floor length alone (it's a feel question for zack, on the test checklist).
  - Gear wore faster than the 3-to-5-floors-to-half aim: the worst part lost 17 to 22 a floor from act 2 on. I cut
    deck wear 1.2 to 0.9 per ollie, shoes 1.6 to 1.1 per flip and wheels 1.2 to 1.0 per fast second. Now it's about
    4 floors early on and 3 later, which lines up with the shop every 3 floors.
  - Heat peaks around 20 to 40 on floors and 25 to 60 on escapes for the bot, with about 1 slam a floor and no
    busts. Cash is 20 to 50 coins a floor plus act payouts, enough for 2 to 4 mods a shop. Both left as they are.
- **Greece's collapsing ruins.** 70% of floating ledges on a Greece floor are ruins. Once you're on one it shakes
  and falls 0.4 s later (about 2.6 tiles of rolling), and you drop with it, with the usual coyote time to ollie.
  The bot validates floors with them; rerolls barely moved (2.3 tries).
- **Gnar levels (the GDD's harder mode, named "Gnar levels" to keep it apart from the stoke meter's GNAR MODE).**
  Five levels, each adding one rule to the ones before: heavier traffic, Heat rises 20% faster, three quarters of
  Heat carries over, one fewer boon card, gear wears 50% faster. Each level pays +15% score and +20% Stoken. The
  first win opens level 1, and winning at a level opens the next. You pick it with a GNAR button on the run summary
  (it reloads into the new level). Daily runs never use it. Leaderboard entries don't record the level yet, so a
  Gnar run's bigger score goes on the same board.
- **Side lines (GDD: Risk and reward inside a floor).** From floor 2, about two floors in three get one: a chain
  of four floating ledges at 2, 2.5, 3 and 3 tiles over the street, 3 to 4 tiles long with 2 to 3 tile gaps,
  coins along it and a Stoken at the top. The first ledge needs an ollie and a flip, so it's a choice you have to
  make, and the rest are plain ollies. It sits where nothing taller than a parked car is underneath and stays clear
  of the fork. I went with a roof chain rather than the GDD's "long rail over traffic", because a rail's posts would
  stand in the traffic lane. Greece's ruin twist applies to it too.
- **Leaderboard entries carry the Gnar level.** A Gnar run's entry shows "G3" beside its floor on the same boards,
  rather than getting boards of its own (that would split the few early players across many boards).
- **Filling stoke can't make a floor impossible (from the playtest bot, PR #106).** The validator skated floors only
  at cruising speed, but full stoke (the gnar state) skates 20% faster, and 8 validated floors bailed at that speed.
  Now a floor or escape only passes if the reference bot clears it at both speeds, the gnar run also having slams
  free of Heat, as in the game. Escapes get 24 rerolls instead of 16, because act 3 passes both ways only about a
  quarter of the time. After this, `npm run playtest:sim` finds no unclearable floors. I left the Sky Line climbing
  warning alone: it's a boon working as intended (a ghost rail under your feet), just very high.

- **Manual pads (zack: "short platforms like the ones over water gaps should act as manual pads").** Any floating
  ledge of 3 tiles or less with water under its middle is a pad; that's marked when the level is built, so every
  floor and the validator agree. Landing clean on one starts a manual (the rig's existing `manual` clip: back
  wheels, nose up), worth +120 and continuing the combo rather than banking it, the way a grind does. Long ledges
  and ledges over street stay plain landings. Pads were rare (one stepping-stone piece), so I added two pieces:
  `manual pads` (tier 1) and `pad line` (tier 2). The reference bot now follows its fall and skips the rescue flip
  when it's already coming down on a pad; before that it flipped over them, and at gnar speed overshot one floor.

- **One district per run (zack: "biomes should not change until the player has gotten to the end of the game for
  that biome").** I put this on a card and built the recommended option while waiting: a run's five acts all happen
  in one district, picked before the run with a button on the run summary (src/run/districts.ts). Chicago is open
  on a new save; a win opens the next district in the GDD's biome order, and the summary says which. Old saves
  with a win get Chicago marked as escaped. The daily run's district comes from its seed, and it doesn't open
  districts. The escape set pieces still go by act (roadblock, helicopter, chase, drones, finale), so every
  district gets all five. The playtest bot now gives each seed its own district, which turned up a bug: in the Art
  Museum a Ghost Rail could run into a lower ceiling in the next piece, and the skater popped into the ceiling and
  re-landed on the rail's end forever. Ghost rails (and Sky Line's) now stop where a ceiling comes down to them.
  One mash-bot finding is left: a fall through a moving car's roof on a Greece floor 12 (seed 47514). It's a
  physics edge I didn't chase.

- **One world, no biomes (zack: "i dont want there to be different biomes really ... fuse all the art").** This
  replaces the one-district-per-run change from a few minutes earlier: the district picker, district unlocks and
  the save's district fields are gone, and every floor uses the Chicago hill layout. The level-design thread fuses
  the art into one kit. What I kept from the districts is their mechanics, as floor twists (GDD: Biomes). There are
  none in act 1, then about half the floors from floor 4 roll one of grinds, columns (crumbling ruins), currents,
  ceiling or conveyors. District gravity is dropped (always 1.0). Act 3's chaser is always the guards; the wave and
  chariot models stay in the code unused.
  - Knock-on fixes the playtest bot needed:
    - Ceilings now clear the neighbouring pieces' rails too. That fixed a Ghost Rail getting the skater stuck,
      popping into a lower ceiling at the rail's end, and replaces the ghost-rail cut I added in PR #112.
    - The validator also runs its bot with the gnar state coming and going mid-floor, as in the game. That closed
      the "validated floor the bot can't clear in the real game" findings.
    - The reference bot projects its flips, so at full speed it holds a flip that would sail over a short roof, and
      it flips near the top of an arc when that's what lands.
    - Gear wear is down about 10% because hill floors run longer.
  - Still showing: about 20 "climbed far above the level" warnings, all from the Sky Line boon. That's working as
    intended, there's just more of it now that the hill floors are lower.
- **Next: Endless.** The GDD promises an Endless mode after a win (floors forever, its own leaderboard), and it
  isn't built. It's the next gameplay item unless zack says otherwise.

- **Lanes rolled back (Oct 25).** zack: "the twin street thing might have been a mistake... remove it and polish what we have", and "we have to do this vertically not horizontally". I reverted #122, #123, #126 and #127, so the fork is the overpass at the end of the floor again. Next is a vertical high/low route through the whole floor, shown to zack as a sketch before building.

- **Top route built (Oct 25).** zack: "the upper power lines that are just there for decoration, could be a new layer of stuff as a top route", "the upper route could have heat with a helicopter", "the upper route has birds flying by and airplanes". What I chose:
  - Down each stretch of hill a power line starts about halfway down (zack: "it should start higher than the street... halfway down the hill"), over an edge where an ollie catches it, and falls more slowly than the hill. It's one smoothed grind from the top to the foot. Over the street chases a row of rooftops carries it on at 5 tiles up, and the gate's overpass stands at the same height, so the height you reach the gate at is your road. Rooftops leave room for the L, whose trains are a way along up there already.
  - Up top there's no traffic, but the police helicopter flies over you. Clean skating and grinding stop cooling your Heat and it climbs 2.5 a second; tricks still cool it.
  - Pigeons sit on the far end of the long rooftops and on the wire. Skate into them and it's a bird strike: you lose 25% of your speed and gain 5 Heat. Ollie them and they take off under you. Airliners cross the sky behind, more often while you're up. Planes are only scenery.
  - The power line wears trucks and wheels at 30% of a normal grind, so taking it every floor doesn't cost a set of gear. The balance band for floor time is now 25 to 90 s, because the wire is a faster way down.
  - There's a new playtest style, `?bot=high`, that goes for the top route. On the test seeds it's up for 50 to 85% of a floor.

- **Top route ramps (Oct 25).** zack: "dont have the upper levels power lines reach down low. there should be certain ramps that can get you air to get up to them". The power line now stays at least 5 tiles over the road under it (and over the highest ground in the 8 tiles behind), so an ollie and a flip can't reach it. A launch ramp (2 tiles long, 1.5 tiles high, drawn like the L's kicker) stands on the hill road about halfway down, under the wire's start: pop off the lip at speed (or pop and flip when slow) to catch it. Roll off without popping and you stay low. Each street chase gets a street launch ramp 3 tiles before its second rooftop, as the way back up.

- **Launch ramps removed (Oct 25).** zack: "the ramps are bad. remove them. ill figure out a new way to get the player up to that higher route. they like Auto move him up there. it should be all physics based". Taken out, along with their level editor drawing and dial name. The power line stays high (at least 5 tiles over the ground behind it) from about halfway down each hill. For now there's no designed way up to it.

- **Continues (Oct 25).** zack: "i want to give the player 3 Continues, before they have to start all over". What I chose:
  - A continue restarts the floor you fell on, from a standstill. Score, cash, gear and Heat go back to what they were when the floor started, so you can't farm a floor's cash by dying.
  - Boons and the board stay.
  - The card's default (tap anywhere) is CONTINUE. END RUN is a small button.
  - It's three per run, shown as hearts in the HUD.
  - The playtest bot gives up at the card, so its stats still count each fall as a run's end.

- **Car doors move to the back lane, with a "!" (zack, 2026-10-26).** zack said "cars in the lane behind the player are the ones that should open their car doors", and that the door should be exaggerated with a "!" over the car first. Here's how it works now:
  - Skate-lane parked cars no longer open doors.
  - From floor 2, up to 3 cars a floor park in the back lane, at most one every 24 tiles, with a 30% chance at each spot. Each spot needs a clear run up in your lane: no parked car, cross street, bus stop or glass, and props stay off it.
  - At 14 tiles away a yellow "!" pops up over the car and bobs for 0.6 s. Then the driver's door flies open across your lane over 12 frames, with an overshoot.
  - The door is drawn 1.75 times long and swings 64 degrees toward the camera. The car is painted bright (yellow, teal, blue or green) so it reads against the brick.
  - The hitbox is a thin slab 36 px tall at the hinge. Rolling into it slams you, and landing on top of it pops you like a car hop.
  - The car itself is only scenery, and a hop on the door does no damage.

- **Firecracker boon (zack, 2026-10-26).** zack described a firecracker as "a trick where you kinda manual down stair sets hitting the tail on each step", and wanted it as a boon that saves you from not ollieing before a stair set, with ollie out allowed. Here's how it works:
  - It's a FLOW boon with max 1.
  - Roll onto a stair set holding it and there's no slam. You ride the set down in a manual instead.
  - Each step, one tile along, fires a `clack` event: 15 points, concrete sparks and a puff at the tail, a high clack sound, and a tiny shake.
  - The firecracker itself scores like a manual (120).
  - You can ollie out of it at any point.
  - Landing on stairs from the air still slams. zack's ask was about rolling in.
  - The rig plays a `firecracker` clip if CLIPS has one, else the manual. The models thread is making the clip.
- **Ghost Rail fixed (PR #179).** It never spawned off curved rails, which are most rails now.

- **Boon audit (zack, 2026-10-26: "make sure all the other boons are working").** I traced every mod to where it's read and added curved-rail tests for each GRIND boon (tests/boons-curved.test.ts). The existing tests only rode flat ledges.
  - Broken: **Grease** did almost nothing on curved rails. It only raised the rail's minimum speed. Now catching a rail puts you straight at full grind speed (as on ledges), and friction along the rail is divided by grindScale. Webster's +15% and Moon Shoes' -30% now count on curved rails too.
  - Already fixed: **Ghost Rail** (PR #179).
  - Checked and working on curved rails: Rail Magnet, Rail Launch, Spare Change, Feeble Frenzy, Exit Wax, Slingshot and Rocket Grind.
  - POP, FLOW, COOL, LUCK and STREET boons read their mods outside the rail code, and their existing tests pass.

- **Hop a car door and it slams shut (zack, 2026-10-26).** Landing on top of an open door still pops you up like a car hop, and now the door also slams shut. It closes in 5 frames, bounces once off the frame and stays shut, so it's no longer a hazard. You get a "DOOR SLAM!" callout, a puff of dust, a jolt and a low impact sound.

## Models thread: animation

- **Hanging on to the cable car, and the firecracker (2026-10-26).** zack: the arm should reach and grab the car while
  it tows you, regular or switch. New `towed` clip; the game passes the car's back pole (cable-view.ts grab, the car
  now runs 0.45 tiles ahead instead of 1.4) and SkaterRig.reach (arm IK, shared with the editor) pins the leading hand
  to it. `switchTowed` is keyed by hand: switch, the car is in front of his chest, so he reaches forward. Firecracker
  clip for the gameplay thread's boon: tail-down manual, restarted on each 'clack'.
- **Nollie, fakie ollie, nosegrind and nose manual (2026-10-26, zack).** `nollie` is the ollie's keys popped off the
  nose (poses.ts nosePop); its switch twin is the fakie ollie. Popping out of a nose clip (crooked, noseGrind,
  noseManual) plays it, and so does rolling off the end of one. Manual pads take turns: manual, then nose manual
  (callout NOSE MANUAL). New noseGrind clip in the ledge and rail grind rotations. All visual: tricks.ts untouched.
  Nollie and fakie flip tricks come later.
- **Hair and loose cloth trail the motion (2026-10-25, zack: "trail the direction the players falling or going").**
  Spring bone chains, per the hair and clothes physics plan: Webster, Roxy and Goldie's long hair is five clumps on
  3-bone chains off Head, and Keanu's hoodie has two drawstrings off Spine1 (art/skaters.py). src/render/springs.ts
  swings them with verlet particles in world space (gravity, a pull back to the pose, head and chest colliders),
  sharing a slow frame's move across its steps so nothing flings ahead. Lou has nothing loose yet. Hems and flares next.
- **Fixed the jittery 180s (2026-10-25, zack).** The PR #156 re-bake recorded every other frame of fs180/bs180 from
  the switch twin: replaying a 180 each frame settled its spin and flipped the rig to fakie. bake_clips.cjs now resets
  the rig to regular stance before every frame; re-baked lou-gnar.glb.
- **Car hops play a Boneless (2026-10-25, zack).** `boneless` in poses.ts is a rough first pass for zack to tune
  in ?editor: the back hand grabs the toe edge of the deck while the front foot plants on the roof heel side, then
  steps back on at the peak. Lou's arms are short, so the grab needs a deep fold (bend 1.1 to 1.2) and the board
  lifted up to the hand. Every 'hop' event plays it (car roofs, train roofs and drones); fakie gets switchBoneless.
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
- **Street props are scenery only**, along the back of the sidewalk (z -3.2), one every 3 to 7 tiles: hydrants,
  benches, Chicago blue garbage carts, rows of newspaper boxes, USPS mailboxes, parking meters, street-name sign
  poles and the odd cone. Nothing collides with them; a floor's props merge into one mesh (one draw call). Making
  any of them skateable (benches and hydrants to ollie over) is a gameplay call, left for zack.
- **The game now plays the Blender actions** from `lou-gnar.glb` in place of the code clips of the same name;
  crossfades blend bone by bone. To change a move: edit its action in `art/lou-gnar.blend`, then
  `blender -b art/lou-gnar.blend -P art/lou_gnar.py -- --export-only`. A new move still needs a code clip entry
  (its timing and looping come from `src/render/poses.ts`).
- **Webster, Keanu, Roxy and Goldie are built** (`art/skaters.py`) on Lou's rig and bind pose, so they play Lou's
  clips unchanged; their GLBs carry no animation. Looks follow the QFS title cast art without the swords and
  shields (Gnar Run has no combat). Pick one with `?skater=webster` (keanu, roxy, goldie) until the deck shop
  unlocks them.
- **Goldie rides a board** (zack confirmed). She skates quads in QFS, but every Gnar Run move is a board trick, so a roller-skate
  Goldie would need her own trick set. She wears purple high-tops with orange soles, her skates' colours. If you
  want her on quads, that's a separate move list to design.
- **Slopes tilt the board, not the skater.** zack asked for IK legs that soak up slopes with the torso centred. On
  the skinned model the ground angle now tilts only the board; the feet stay on it, the legs re-aim by two-bone IK
  and the hips sink a little, over any clip. The physics feel thread's `feel` values (squash, lean, wobble) feed the
  same hook, and its `feel.pitch` becomes the board angle.
- **Gear wear shows before it costs you.** The deck chips, trucks rust and wheels grub up from the first use, a
  little at a time; the shoe scuff appears below 65 and the hole below 30 (the gameplay thread's `GEAR.busted` + 15).
  It's drawn on the rig from `game.sim.gear`, redrawn only when a part crosses a step of 5.
- **Biome kits come from QFS's own skins.** Each world's street, wall, blocks, ledges, water, decor and props use the
  tiles QFS's survivor mode already picked for it (survivor_worlds.gml), so a biome looks like that QFS world. Decor
  and props are flat pixel-art cards like QFS draws them; 3D landmarks per world are a later step. The skyline is
  still Chicago's until each world gets its backdrop. The Hive borrows High-Tech City's tiles.
- **Each world's smashables stand in for Chicago's by size.** The sim still places cones, crates and barrels, and the
  render shows the world's small, medium or large breakable in their place, so no gameplay code changed. The
  AI's kiosks, bots and Flock poles stay in every world: the AI is everywhere.
- **The escape helicopter is a Blender model now** (art/chopper.py): a dark pod with a tinted canopy, the AI's red
  eye slit across the nose, a searchlight under the chin, skids, a tail boom with a fin and the AI's red livery. Its
  rotors are spun slower than a real one's so the blades read instead of strobing, with a faint blur disc over
  them. The code-built chopper stays as the fallback. The spotlight and its behaviour are unchanged.
- **One big landmark per world, behind the street** (art/landmarks.py): a Greek temple front, Atlantis's sunken arch
  in coral and kelp, Clemente Park's ballpark light tower, a giant museum bust, High-Tech City's data spire, a rocket
  on its gantry in space, and the AI's tower with its red eye in the Hive. One stands in for a building every 26 to
  46 tiles. They are 6 to 10 tiles tall, so from the street their tops rise out of frame; from the roofs you see them
  whole. Chicago has none: its skyline is the landmark.
- **Act 3's chasers are Blender models** (art/chasers.py), on the gameplay thread's hooks in chaser-view.ts: a
  curling blue wave with foam on its lip and wash at its foot, a gold chariot with spoked wheels and a red-cloaked
  driver cracking a whip behind two galloping horses, and three museum guards in navy with peaked caps and badges.
  Legs swing from the hips, the wheels roll, the primitive versions stay as the fallback.
- **Bus stops and car doors are Blender models** (art/cars.py `BusStop`, `CarDoor`): a CTA sign (blue, the white
  band, a red route plate) beside the street bench from props.glb, and a driver's door with its window, mirror,
  handle and inside trim, painted the same colour as its parked car (kit.ts `parkedPaint`). The gameplay thread's
  placement and swing are unchanged.
- **Pedestrians on the sidewalk (GDD: "pedestrians who react").** art/pedestrians.py builds peds.glb: a torso,
  legs, arms (the right one holding a phone) and three heads (short hair, long hair, cap). src/render/peds.ts mixes
  them into skinned people with random clothes, skin and hair colours, a few every 3 to 9 tiles along the street
  part of a floor, clear of cross streets, bus stops, props, escape set pieces and the fork's doors. They are purely
  visual (no collision, no score): some stroll, all turn to watch you come past, about a third hold their phone up
  to film, they throw their arms up when you land a big air near them and flinch when you slam. Ducking was left
  out for now. game.ts gets one view and one update call next to the chasers.
- **Slam reworked to a slip-out, bail windmills.** The old slam pitched Lou forward onto his hands while the board
  shot ahead, which can't happen together. A slam in the sim is a landing that doesn't stick, so now the board
  squirts out ahead, Lou sits down hard on his butt (head whipping back, hands behind), rocks forward over his
  feet, takes a running step and hops back on (still 0.9 s). The bail (falling off the map) windmills both arms and
  runs the legs while the board tumbles away. Push was checked against the reference (front foot turned about 80°,
  back foot reaching beside the front truck, sweeping back past the tail) and left as is. Re-baking also fixed
  art/bake_clips.cjs, which had baked from the Blender actions instead of the code clips (it now clears them
  first); the re-baked actions match the code clips frame for frame.
- **The L and the traffic signals are Blender models** (art/street.py, street.glb). The L over the helicopter
  escape is riveted lattice girders in dark green steel with rust X-bracing, ties and running rails (and a third
  rail), in 3-tile spans squeezed to fit each cover, on H columns with a bracket out under the back girder. The
  cross-street signal is a dark green pole and a three-lamp head with hoods; the red and green lenses light as
  before, amber stays dark. The code-built versions stay as the fallback.
- **Coins, Stoken gems and the wanted board are Blender models** (art/pickups.py, art/street.py `WantedBoard`). A
  gold coin with a rim and a raised $ on both faces (the back one mirrored so it reads right as it spins), and a
  brilliant-cut purple gem, table up. Still one instanced draw each (colours baked into the vertices), 284 and 30
  triangles. The bounty's poster now hangs on a board with two posts, a plank panel, a frame and a little roof.
- **Pedestrians duck, and the overpass is modelled.** People (not filmers, who keep filming) fold forward with
  their arms over their heads when you fly in low past them (airborne, 0.8 to 4.5 tiles over the street, within
  1.8 tiles). The overpass gets concrete pillars with flared caps and a railing with posts and balusters
  (art/street.py `OverpassPillar`, `OverpassCap`, `OverpassRail`); its deck stays the textured slab.
- **Pedestrians dress for their world** (peds.ts `DRESS`). Greece: linen, terracotta and olive tunics over bare
  legs, sandals, laurel wreaths on about half (new `PedHeadWreath`). Atlantis: teal, coral and pearl. The museum:
  muted gallery-goer coats. Space: white and orange flight suits, most in a white helmet with a dark visor (new
  `PedHeadHelmet`). High-tech: black techwear with neon. Chicago, Clemente and the hive keep the street mix.
  game.ts passes the biome to `pedView.update`.
- **Fixes from zack's local test (2026-10-24).** (1) Lou's feet sank into the deck: the Blender board track was
  recorded at the deck top while the game adds the deck height again, so the board played 0.12 tiles high.
  art/bake_clips.cjs now records the board at its ground point; clips re-baked and lou-gnar.glb rebuilt, and the
  board now plays where the code clips put it. (2) Cars, cruisers and buses rendered one flat colour: splitSlabs
  split a model's material groups with a draw range, which batchStatic's merge ignores, so every piece drew the
  whole car in one material. It now copies out each group's vertices.
- **Grinds by obstacle, FS boardslide, knee poles (zack, 2026-10-24).** Rails (flat bars and handrails) now cycle
  every grind: BS boardslide, 50-50, FS boardslide, 5-0, BS smith, crooked, BS feeble. A parked car's roof (not a
  rail) gets every grind but the boardslides. The callout names the grind Lou is doing instead of always
  "BOARDSLIDE". FS boardslide follows the real trick: the rail comes up on the toe side, the nose crosses it toward
  the camera and Lou slides backward with his back leading down the rail, head turned over his lead shoulder;
  that matches zack's "back in front". Knee IK no longer takes the knee's bend from the toes or from the last
  frame: the pole is fixed toward the camera (a little outward per leg) and only turns with the body (a
  boardslide turns Lou's chest down or up the rail, so his knees go with it). The landing squash and slopes
  use the same pole. Clips re-baked.
- **L train cars (for the level design thread).** art/street.py now builds `ElCar` and `ElCarFront` in street.glb:
  a CTA 5000-series style stainless car, 4 tiles long (x 0..4, running +x), 1.7 tall from the wheel bottoms (its
  origin, on the running rail heads), 1.9 wide between the rails (game z 0.2). Blue and red stripe, dark window
  band, two door pairs a side, low roof gear. The front variant has the cab at +x with a windshield, an amber
  destination sign and headlights. The other end of each car is a plain end door, for coupling. About 700 tris each.
- **Pedestrians in the fused city.** With the worlds fused into one city, about a third of the people on the
  Chicago street now dress from another world (tunics and laurels, sea colours, gallery coats, flight suits and
  helmets, techwear); the rest dress for Chicago.
- **Shoes split at the ball (for the editor's foot bones).** Lou's and the QFS skaters' shoes and soles are now two
  parts each: the heel on {side}Foot and the toe cap on {side}ToeBase, cut at the ball (0.12 ahead of the ankle)
  with a little overlap so a bend never opens a gap. The toes bend with the editor's toe fields and a heel lift
  no longer pushes the toe cap through the deck. The worn hole in the lead shoe moved to the toe cap. GLBs
  re-exported; the clips are unchanged.
- **Airliner, cable car, Picasso and Flamingo (zack, 2026-10-25).** The airliner over the top route is now a
  Blender model (art/airliner.py) after the QFS Chicago level's airplane sprite: pale grey widebody, blue fin,
  blue engine cowls, window rows. It's drawn about five times bigger than the old one (about 10 tiles long), just
  behind the street and above the skater. Further back or higher, the houses and the HUD hide it, since the camera
  shows little sky. The cable car is rebuilt from zack's photo of car 60 (street.py `CableCar`): maroon and cream,
  a windowed saloon, open bench ends with brass poles, the 60 and the Municipal Railway band, gold-lettered roof
  boards and a clerestory. Calder's Flamingo and the Chicago Picasso are new landmarks (landmarks.py). The city's
  plain Chicago quarters (all but the first, which is under the L) take them in turn, with the other worlds'
  landmarks still in their quarters.
  Follow-up (zack: "above the power lines"): the airliner now flies over the wires, 5.6 tiles over the skater on
  the street and 3.2 over them up on the top route, easing between the two. The camera shows little sky, so on the
  street that puts it in the strip just under the HUD.
  Then (zack: "behind the buildings, between the far background sprite and the front background buildings"): it
  flies at z -34, between the back buildings (to about -10) and the skyline backdrops (-60 and back), drawn 18 tiles
  long so it still reads big, a little over the rooftops on screen. The rooftops cross in front of it, and where
  the back buildings fill the frame (much of the street) it only shows in the gaps.
- **Switch clips (zack, 2026-10-25).** With Lou's back to the camera (the rig turned half round when the sim rides
  fakie), every clip but idle and busted now has a switch twin, `switchPush`, `switchKickflip`, `switchGrind1` and
  so on. Each twin starts out as its regular clip mirrored along the board: the other foot pushes, pops and flicks,
  the other arm leads, and the board pitches and spins the other way. The left foot stays on the left of the board,
  so the legs never cross. Played as-is, the turned-round regular clips pushed and popped toward where he was going.
  The twins are clips of their own, so they show up in ?editor and can be keyed apart. An unedited twin follows its
  regular clip's edits. Switch grinds call out "SWITCH 50-50" and so on. Switch twins aren't baked into the GLB yet;
  they play from their keys.

## HUD thread: ui1-hud (zack's HUD mockup)

- **Heat gets a bar after all.** The GDD said Heat is shown by the world, not a bar; zack's mockup has one, so the
  mockup wins. The world cues stay. Four stars light at 25, 50, 75 and 90 Heat, and the cruiser's lights flash
  from 50.
- **The combo's "+ 820"** is the live combo's points before the speed bonus (what you'd bank at cruising speed),
  so the number you actually bank can be bigger.
- **Board mod tiles show the mod's short name, not an icon.** There are 14 mods and no icon art yet; triggers are
  purple ("ON OLLIE"), effects cyan ("DO KICK"), empty slots dashed. The mockup's charge pips under each mod have no
  meaning in the game yet, so they're left out.
- **Gear wear runs green / yellow / red by condition**, not a colour per part as in the mockup, so a worn part reads
  at a glance. Parts are in the mockup's order: deck, trucks, wheels, shoes.
- **Boons you hold** stay as small chips under the logo and are listed in full on the pause card.
- **The fps line now only shows with `?debug`**, the seed moved to the pause card, and the controls hint only shows
  on floor 1.
- **Pause** is the top right button, Esc or P, and it pauses itself when you switch apps. Resume is a button so a
  stray tap doesn't drop you back in.
- **Font:** Bangers (OFL), bundled with the game, so there is no font request at runtime.

## Physics feel thread (pf1-physics-feel)

- **The fixed timestep was already there** (60 Hz with render interpolation, from M0), so this change is the feel
  layer on top of it, not a new engine. QFS's gravity, ollie and fall cap are unchanged.
- **Landings by height, measured into the surface.** About 1 tile is a kiss, 3 tiles to flat is heavy (costs a little
  flow speed), 5.5+ tiles to flat is sketchy (40% of flow speed and a heel-toe rock). A bank that falls away soaks up
  any drop. Cruising speed is never lost to a landing. On the bot's runs that's 55% clean, 29% heavy, 16% sketchy:
  the descents have lots of big drops to flat, which in real life (5.5 tiles is about 6 m) is a sketchy landing at
  best. Easy to soften (`FEEL.huge` in src/physics/feel.ts).
- **Landing mid-flip is a slam** (the GDD already said so; now it's real). Under 60% through the catch is a slam,
  60-100% sketchy. Each trick's catch time is the key in its clip where the board stops turning, and a test keeps the
  sim and the clips in step. In practice it only bites when you flip up onto something higher.
- **Momentum carries into the ollie.** An ollie keeps the vertical speed the ground was giving you, so up banks
  launch higher and an ollie off a down handrail still carries you down (it used to pop you straight up). Floors still
  all clear (50 seeds x 8 floors).
- **Grind materials: steel and concrete.** Curved rails lose a little speed to friction (steel mu 0.05). Concrete
  bites harder and rocks you less. Every grind in the game today is steel, since ledges are platforms, not grinds;
  making ledges grindable is a gameplay call for zack.
- **The body response is split.** The sim owns the numbers (`skater.feel`: squash, lean, wobble, board pitch from the
  two trucks), the models thread's `absorb()` in the rig animates them, and the effects thread scales landing dust and
  camera kick by impact. Sketchy landings don't touch score or combo; that's the gameplay thread's call.

## Physics feel thread, round 2 (collisions, gravity, gear)

- **Landings are swept now.** A fuzz test (random button mashing on 64 floors with three boon builds) found you
  could drop past the far corner of a roof, ledge or bar in one step at speed, and miss a car roof's near corner. The
  sim now checks where your path crosses a surface during the step, as well as where your feet end up. Landing past
  the far end puts you on the edge, and you roll off from there. Rising onto a curved rail that climbs faster than you
  now catches you too, like the bank fix. The fuzz test stays in the suite (tests/collision.test.ts).
- **District gravity is ready in the physics, not wired yet.** `Level.gravity` scales everything gravity touches (air,
  slopes, rail pull, friction). `BIOME_GRAVITY` has the GDD's numbers (Atlantis 0.8, Outer Space 0.6). The gameplay
  thread sets it when acts get their districts, and must set it before the validator runs: a floor that clears at
  normal gravity doesn't always clear at 0.8, because you overshoot landings.
- **Worn gear rocks you more.** Worn trucks (loose bushings) rock you more on rail entries, and worn wheels (coned,
  flat-spotted) rock you more on sketchy landings: up to 1.6x at fully worn. It's feel only, with no extra speed loss.
- **Manual balance: skipped.** The GDD only mentions manualing on a bus roof in passing. There's no manual mechanic
  in a one-button game yet, so it's a design question for zack, not a physics gap.

## Physics feel thread, round 3 (gravity check, bounces, tuning)

- **District gravity checked.** Gameplay wired it per act (#79). The collision fuzz test now runs at normal,
  Atlantis and Outer Space gravity, with moving traffic, bus stops and car doors in it. No holes.
- **Bounces get the body response.** Car hops (roofs, buses, doors, drones) and tailgate kickers now load Lou's
  knees. A car hop landed mid-flip still saves you (it's a bounce, not a landing), but rocks you. I chose that over a
  slam: hopping across traffic is the core skill moment, and a slam there would feel unfair in one-button play.
- **Tuning pass on bot stats, no number changed.** Sketchy landings: 14% at normal gravity, 9% in Atlantis, 6% in space.
  Slams from landings: under 1%. The sketchy rate comes from the descents' 5+ tile drops to flat, and it costs little
  (only flow speed, which you rarely have after a drop), so I left `FEEL.huge` at 9.5 for zack to judge in play.

## Physics feel thread, round 4 (district twists)

- **The fall-through test covers every district.** Each seed runs in another district's gravity and twist (Atlantis
  currents, museum ceilings, High-Tech conveyors, rail-heavy Clemente and Greece). No holes found.
- **Bumping a museum ceiling folds the knees.** A ducking squat, not a slam. Real skaters would bonk, but a slam from
  a ceiling you can't see coming in one-button play would feel cheap. The ceiling itself stays the gameplay thread's.
- **My feel backlog is otherwise done.** What's left needs zack: whether ledges become concrete grinds, a manual
  mechanic, and the tuning questions in the checklist (sketchy rate, heavy speed loss, handrail ollies).


## Physics feel thread, round 5 (playtest bot findings)

- **Moving roofs land from where they were.** A drone bobbing up into your feet, or a bus lifting, could cross you
  between two frames and skip the landing. The skater now remembers each roof's height from the step before.
- **A car pulling out of the lane stays solid until it's half out.** It used to go ghost the frame it decided to
  leave, while it was still drawn in your lane, so you could drop straight through a robotaxi's roof. Now it's the
  same rule as a bus pulling in. That also means a leaving car can still hit you for about 10 frames, which matches
  what's on screen. The bot's 30-seed sweep finds no fall-throughs and its clear rate is unchanged (85% / 49%).
