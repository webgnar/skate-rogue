# Gnar Run test checklist

Everything merged since the last good Vercel deploy (around PR #48, early on Oct 24, 2026), so zack can play it
through once deploys work again. The gameplay thread keeps this file organised; every thread adds its own items
under its area. Tick a box when it plays right. Write a note under any item that doesn't, and the thread that
owns it will pick it up.

## Fast ways in

| URL flag | What it does |
| --- | --- |
| `?seed=1234` | The same run every time: the same floors, forks, traffic and offers. Good for re-checking one spot |
| `?floor=6` | Starts the run on that floor, with no boons. Floor 4 brings buses and trucks, 5 cross streets, 6 curses |
| `?skater=webster` | Plays as Webster, Keanu, Roxy or Goldie instead of Lou, without unlocking them (the look only: the passive comes from the unlocks screen) |
| `?unlockall` | Opens every unlock for this visit without spending Stoken: all boon types, curses, duos, skaters, decks and the daily run |
| `?daily` | Today's daily run (needs the Daily run unlock, or `?unlockall`) |
| `?biome=greece` | Previews a district's look: `chicago`, `clemente`, `greece`, `atlantis`, `museum`, `hightech`, `space`, `hive` |
| `?calm` | Reduce motion and flashing (no shake, no flashes) |
| `?fx=low` | The low tier for older phones |
| `?gnar=3` | Plays at that Gnar level without winning first (1 to 5) |
| `?tutorial` | Starts on the tutorial floor again (a brand new phone gets it automatically) |
| `?debug` | Shows fps, draws and speed; exposes `window.game` |
| `?editor` | The animation editor: keyframe Lou's clips (see docs/animation-editor.md). `?editor&clip=kickflip` opens a clip |
| `?drafts` | Plays the editor's unsaved clips from this browser |
| `?bot` | The playtest bot skates for you (`?bot=mash` presses at random, `&turbo=3` runs it 3x faster). See docs/playtest-bot.md |
| `?escape=2` | Starts on act 2's escape |
| `?boons=bigPop,bigPop,grease` | Starts holding those boons (repeat one for stacks) |
| `?danger=3` | The first floor's traffic: 1 light to 3 rush hour |

Flags combine, for example `?seed=77&floor=5&skater=roxy`.

## One street: floors flow into each other (no stop, no cut)

- [ ] **Through the gate you keep skating.** The boon pick, shop or underground spot opens as you pass the gate, over the street as it is. When you close it, you carry on from that spot at the same speed. Floors with no menu (cash, stash, escapes) don't pause at all.
- [ ] **The next floor is already there.** As you near the end of the street, the next floor's hilltop appears past it at the same height, and you roll straight on and down the hill. There's no jump back to the top and no restart from zero speed. Quickest check: `?floor=3`, then clear the floor, the escape and the floor after.
- [ ] **Air carries over.** Ollie off the end of the street and you land on the next floor's hilltop with your trick and combo still going.
- [ ] **The light and rain blend** into the next floor's over a few seconds, rather than switching on the spot. The skyline drifts back down behind the city.
- [ ] **The high road:** take the overpass at a fork, and the floor after it (a shop or a hot street, say) is the one waiting past the end.
- [ ] *Perf:* the next floor is generated in the background and its scenery is built a slice per frame, so there should be no stutter mid-floor or at the join. With `?debug`, the "worst" frame time near the end of a floor should look like the middle of one.

## Run shape and roads

- [ ] **Side lines (from floor 2, most floors):** a chain of four floating ledges climbing over the street, with coins along it and a Stoken at the top. An ollie plus a flip from the street gets you onto the first one, and plain ollies take you up the rest. Skipping it costs nothing. *Feel:* too easy to miss, or too easy to reach?

- [ ] *Run length:* the bot's floors take 17 to 28 seconds and escapes 23 to 40, so a winning run is about 12 minutes with menus. The GDD guessed 20. Too short, too long, or right for a phone? (Longer floors are an easy change.)

- [ ] **Underground spot** (a green road sign from floor 3, about 1 fork in 7). Taking it shows three choices: Lay low (the next floor starts at 0 Heat), Swap a boon, Remove a curse. *Check:* the swap only offers boons other than the one you dropped.
- [ ] **Heat carries between floors at half.** Leave a floor with high Heat and the next one starts warmer (see it on the Heat bar).
- [ ] **Boon streets only lead to types you've unlocked:** a new phone sees POP and GRIND signs only; with `?unlockall` you see all six (POP, GRIND, FLOW, COOL, LUCK, STREET).
- [ ] **Each act is its own district:** act 1 Chicago, act 2 Clemente Park, act 3 Greece, Atlantis or the museum (it changes run to run), act 4 High-Tech City, act 5 the Hive. The look switches when an act's first floor starts. Quickest check: `?floor=4`, then `?floor=7`, `?floor=10`, `?floor=13`. A `?biome=` in the link pins one look for the whole run. In Atlantis gravity is 0.8: you float higher and longer on every floor of that act (the floors are built and checked in it). `?biome=atlantis` shows it from floor 1.
- [ ] **Fork signs light up** for the road you're on as you reach the overpass.
- [ ] **Escapes:** act 1's roadblock, act 2's helicopter, and act 4's drone swarm (stomp the drones to car-hop).
- [ ] **Act 3's chase (after floor 9; quickest is `?floor=9`, clear it and take a road):** the district's chaser comes in a few tiles behind you: a tidal wave in Atlantis, a gold chariot in Greece, three guards with a torch in the museum. The callout names it ("THE WAVE IS COMING!"). Each slam lets it surge closer, and the "!" warning shows when it's close. Clean skating slowly opens the gap. Three slams close together and it catches you ("WIPED OUT!", "TRAMPLED!", "COLLARED!"). *Tuning:* too forgiving or too harsh? *Looks:* these are placeholder shapes until the models thread builds real ones.

- [ ] **Wanted posters (floor 2+, about one floor in three):** a red WANTED board at the start of the street, and a callout as you pass it. Reach the gate with Heat at 50 or more and you get "BOUNTY CLAIMED": the floor's Stoken again, at least 3. Below 50 it says "BOUNTY MISSED". *Tuning:* worth the risk?

## Unlocks between runs (meta progression)

Stoken you grab is banked when a run ends. The run-over screen has an **UNLOCKS** button.

- [ ] UNLOCKS opens a screen with four columns: Skaters, Decks, Boon library, Spots. Your bank shows at the top. Tapping it never starts a run behind it.
- [ ] Tapping a locked item you can afford buys it (the bank drops, the tag turns to RIDE or OWNED). One you can't afford is greyed out and says how much more you need.
- [ ] Tapping an owned skater or deck makes it RIDING. BACK reloads the game with your new setup.
- [ ] **Skaters:** Webster (grinds 15% faster, first pick GRIND), Roxy (car-hops 20% higher, first pick STREET), Keanu (Heat cools 15% faster in the air, first pick COOL), Goldie (+25% cash from everything, first pick LUCK). The first floor's sign shows that type, as long as its pack is unlocked; otherwise POP.
- [ ] **Decks:** Cruiser (+10% speed, ollies 5% lower), Bombhill (+15% speed, gear wears 30% faster), Slab (4 board slots from the start, ollies 8% lower). Feel the difference in a run.
- [ ] **Boon library:** a new phone only gets POP and GRIND boons (12 cards). Each pack adds its type to the cards and the road signs. Curses and Duos are their own unlocks.
- [ ] **Daily run:** once unlocked, the run-over screen shows DAILY RUN. It reloads into today's seed (the seed line says "daily"), the run-over screen shows today's daily best, and NORMAL RUN goes back.
- [ ] *Tuning:* prices run from 15 to 60 Stoken (465 for everything). Does a good run earn enough that the first unlock comes after 2 or 3 runs?
- [ ] Your old best score and banked Stoken carry over from before this update.

## Leaderboards

**Setup first (zack, once):** the boards need a Redis store. In the Vercel dashboard, open the skate-rogue project, then Storage, then connect an **Upstash Redis** database (the free plan is plenty). Connecting it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` on the project. Then redeploy. Until a store is connected, the SCORES button stays hidden and nothing else changes.

- [ ] After a run, the run-over screen shows a purple **SCORES** button. The first time, it asks for a tag (3 to 10 letters or digits) and posts that run.
- [ ] Later runs post themselves, and the button shows your rank ("SCORES · #4").
- [ ] Two tabs: TOP SCORES and DEEPEST RUNS (deepest floor first, then score). On a daily run there's a third: TODAY'S DAILY. Your tag is outlined in yellow.
- [ ] Typing the tag on the phone: the keyboard comes up, Enter posts, and taps on the screen never start a run behind it.

## Boons

- [ ] **FLOW** (New Wheels, Bomb Hill, Butter, Kicker Boost, Slingshot) and **COOL** (Low Profile, Bubble Pads, Tuck and Roll, Slam Stoke, Siren Song, Decoy, Ghost Mode): each card does what it says.
- [ ] **LUCK:** Stoken Magnet (picks up from further away), Double Stoken, Hustler (a 4th card on every pick), Lucky Reroll (the first reroll each pick is free).
- [ ] **STREET:** Roof Rider (grind parked car roofs), Slipstream (tuck behind a car about half a second, then a burst of speed), Hood Pop (car-hops bounce higher), Spoofed Plate (robotaxis don't brake), Jaywalker (close calls count from twice as far and score double).
- [ ] **Curses (from floor 6, about one offer in three):** a dashed purple card marked CURSED. Moon Shoes (ollies 60% higher, grinds 30% slower), Wanted (double Stoken, Heat rises twice as fast), Speed Wobbles (40% faster cruising, but landing well over cruising speed, e.g. off a kicker, slams you). *Tuning:* is Speed Wobbles too harsh?
- [ ] **Duos:** pink cards that show up once you hold both halves. Rocket Grind (Rail Launch + Big Pop: ollie off a full-speed grind launches higher and gives every jump back at the top), Sky Line (Ghost Rail + Triple Threat: each flip leaves a rail under you), Perpetual Motion (Butter + Slingshot: extra speed never bleeds off).
- [ ] **Remove a curse** at the underground spot lifts it off whole.
- [ ] **Card look (openspec ui4-boon-look):** every boon card has a picture from the game (board, wheels, cruiser, bus, drone, chopper, rocket...) with a white or yellow glyph over a burst in its type colour. Tell me any picture that doesn't fit its boon.
- [ ] A curse is a dashed purple card; a duo has a pink double edge, says DUO, and names both halves on a line under its name.
- [ ] The underground spot's three cards (Lay Low, Swap a Boon, Remove a Curse) have pictures too.
- [ ] The boons you hold show as small badges with a picture, top left and on the pause card.
- [ ] Phone upright: the pick cards wrap into two rows and are big enough to read. Phone sideways: three in a row fit with REROLL under them.

## Traffic

- [ ] **Cross streets (floor 5+, try `?floor=5`):** the back wall opens onto a side road with a crosswalk and a corner light. The light goes red as a car pulls out.
- [ ] **Cross cars turn onto your road:** the car comes nose-first down the side street, swings round over about half a second, then drives your way slower than you. *Check:* you can car-hop it while it pulls out, while it turns and after it drives off. *Tuning:* should some turn toward you instead?
- [ ] **Buses and box trucks (floor 4+):** you can ride a bus roof. A box truck's dropped tailgate is a kicker that throws you up with a burst of speed.
- [ ] **Close calls:** clearing a roof by a few pixels calls "CLOSE CALL" and cools Heat a little.
- [ ] **Bus stops (floor 4+, most floors have one; try `?floor=7`):** a blue stop sign and a bench at the back of the sidewalk. As you come up, a bus in the back lane blinks amber and pulls into your lane at the stop, about 8 tiles ahead of you. It sits about 5 seconds, then drives off your way. Its roof is too high for a plain ollie: ollie and flip up the back, hop on from a car, or wait behind it. *Check:* you always see it pulling in before you need to jump. *Tuning:* too much warning, or too little?
- [ ] **Car doors (floor 2+, about half the parked cars):** come within about 9 tiles and a door swings open at the back of the car. Rolling into it slams you; landing on its top edge pops you up like a car hop. *Check:* the door is easy to see as it opens. *Open question:* the door sticks out behind the car, not toward you, so it reads side-on; does it look like a car door to you?
- [ ] **Car-hop damage (parked cars, try `?floor=9`):** every hop off a roof squashes the car down on its springs, and springs, dust and seat stuffing burst out of it. The first hop dents it (the roof caves in where you landed, the windscreen cracks, door dings). From half its health it's busted: all the glass cracked, scraped paint, the hood buckled, a front tyre flat, and smoke curling off the hood with a "KRUNCH!".
- [ ] **Totaling a car:** a plain car goes on its 6th hop. It blows apart with "TOTALED!", panels, a wheel and a cloud of springs, and the crushed wreck gets shoved into the back lane, smouldering. It isn't solid any more: you drop to the street and can ride through where it was. It scores +300 on top of the hop.
- [ ] **Different vehicles, different health:** robotaxi 5 hops (wrecking one cools Heat a little, like smashing the AI's stuff), regular and oncoming cars 6, the sheriff cruiser in a roadblock 8, a box truck 9, a bus 12. *Tuning:* too many hops, or too few?
- [ ] **Traffic takes damage too:** bounce on a robotaxi going your way and it dents, busts and smokes as it drives; totaled, it rolls to a stop in the back lane. A car door you hop off counts against its parked car. *Check:* the dented models show up a second or two after the game loads (they load in the background); before that a hopped car still bursts springs and dust.

## Tricks

- [ ] **Trick suite:** 360 flip, hardflip, varials, 180s riding away fakie (callouts say FAKIE), 5-0 and feeble grinds.
- [ ] **Floating ledges** stick out toward the camera like roofs, so Lou rides on top of them, not along the edge.
- [ ] **Manual pads:** the short platforms over water gaps. Land on one and Lou rides it nose up on the back wheels
      (callout MANUAL x2, x3...), the combo keeps counting, and ollying off to the next pad or the street works.
      The new `manual pads` and `pad line` pieces should show up from floor 1. Landing a slam on a pad still slams.

## Physics feel (pf1, PR #65)

Every descent floor has all of these: stair sets with handrails, roof drops, terraces and the odd bank. Floor 1
starts at least 12 tiles up, so it's the quickest place to try them.

**Landings**

- [ ] Small hops and 1-tile drops land soft: a little knee bend, no dust burst.
- [ ] A plain ollie on flat ground lands clean. Lou's knees soak it up and he stands back up in about a third of a second.
- [ ] A drop of about 3 tiles to flat feels heavy: a deep squat, bigger dust, a "BIG DROP" callout, and you lose a bit of the extra speed from rails.
- [ ] Roll off the top roof and fall about 6 tiles or more to flat. It should land sketchy: Lou rocks heel to toe, the
      combo banks at half, and a good chunk of the extra speed goes. You never drop below cruising speed.
- [ ] Landing on the stairs is still a slam.
- [ ] Flip up onto something higher (a bus, a roof) with a late tap. If the board hasn't finished turning when you land,
      it's sketchy. If the flip has barely started, it's a slam. Holding the button for a full-height flip should always land clean.
- [ ] **Tuning question:** do the sketchy landings feel fair? On test runs about 16% of landings come out sketchy, because
      the descents have lots of big drops. One number softens it (`FEEL.huge` in src/physics/feel.ts, 9.5 now).
- [ ] **Tuning question:** is the heavy landing's speed loss noticeable? Is it too much (`FEEL.heavyScrub`)?

**Slopes and banks**

- [ ] **Momentum options (try each, tell me which feels right).** Same floor with `?momentum=real`, `soften`,
      `transfer` and `both` added to the URL. Find a hill floor with crest jumps and kicker banks.
  - [ ] soften: ollie early at speed and land on the face of an up bank. You keep your speed instead of dropping
        to cruise (the climb still slows you).
  - [ ] transfer: ollie off a crest and land high on the next downhill block, in line with it. You come out faster
        than with `real`. Is the difference enough to notice without a call-out?
- [ ] **Lining up in the air.** Drop off a roof onto a bank that falls away: on the way down the board tips nose-down
      to the bank's angle and lands flush, with no snap on touchdown. Fly at an up bank: the nose comes up to meet it.
      Over flat ground or way up high, the board stays level. Ollie onto a stair handrail: the board lines up with the rail.
- [ ] **Bug fix (PR after #69): flying into a bank.** Ollie or fall toward an up bank low, so you meet its face
      rather than dropping onto it from above. You should land on the bank and ride up it. Before the fix you passed through
      and fell to your death. It was broken on the old build too.
- [ ] Rolling up a bank eats speed from rails and kickers, then you're back at cruising speed.
- [ ] An ollie near the top of an up bank launches noticeably higher than an ollie on flat ground.
- [ ] Rolling from a roof onto a bank, the board tips over the lip smoothly (one truck on each) instead of snapping to the angle.
- [ ] In the air the board eases back to level, never snaps.

**Rails**

- [ ] Long flat or arched rails lose a little speed by the end. Big handrails down stair sets still speed you up.
- [ ] Ollie off a handrail before its end: you still carry down the rail's angle (real momentum), not straight up.
      **Tuning question:** does this feel right, or do handrail ollies now feel too weak?
- [ ] Dropping hard onto a rail rocks Lou more than gently landing onto one.
- [ ] Grind sparks match the material: steel throws white sparks (every grind is steel for now).
- [ ] **Open design question:** should ledges be grindable (a concrete 50-50 that bites harder and wobbles less)? It's
      ready in the physics; ledges are only platforms today.

**Collisions (physics round 2)**

- [ ] **The board is the collision (2026-10-25).** Turn on the collision overlay (C, or ?debug=collision).
  - [ ] The body box is as long as the board, nose to tail (30 px).
  - [ ] Roll off the end of a roof: you stay up, level, until the back truck rolls off, then drop.
  - [ ] Drop with only the back truck over a roof's edge: you land on it, the front truck hanging over.
  - [ ] Banks and stairs still need the middle of the board on them.
  - [ ] In a flip or at the top of an ollie, the board rises off the feet. When the board looks clear over a ledge,
        you land on it. When it looks under the edge, you don't. The legs reach down to it as you land, with no pop.
  - [ ] Car sides: you hit them with the whole board's length now. Car hops are a bit easier (you can hop a
        roof with a truck over its end).
- [ ] **No ollie during the impact (2026-10-25, Lou Gnar's rule).** Land from an ollie and mash the button: nothing happens until the landing clip stands back up (350 ms), then the next press pops at once. Grinds and manual pads have no lock. Side lines' ledges are a tile longer so you can still ollie ledge to ledge.

- [ ] Clip the near corner of a roof, ledge, bar or car roof as you come down: you land on it rather than slipping
      past. Drop off the far end of something at speed with your feet still over it: you land on the edge, then roll off.
- [ ] With fast builds (New Wheels, Slingshot, Kicker Boost) you never fall through a roof, bar, bank or car roof.
- [ ] Drop onto a robotaxi's roof just as it starts pulling out of the lane (it slides to the back). You land on it
      and ride or hop off; you never fall through it. Same for a drone bobbing up under you on the act 4 escape.

**Worn gear and gravity**

- [ ] With worn wheels (red on the HUD) a sketchy landing rocks Lou more, and with worn trucks a hard rail landing does too.
- [ ] **District gravity is wired (gameplay #79):** in Atlantis (act 3 some runs, gravity 0.8) and Outer Space (0.6)
      ollies go higher and hang longer, and big drops land softer. Test bot stats: sketchy landings fall from 14% at normal
      gravity to 9% in Atlantis and 6% in space.
- [ ] **Museum ceilings:** ollie under the Art Museum's low ceiling and Lou ducks, knees folding, as he bumps it.
- [ ] No falling through anything in any district: currents, ceilings and conveyor rails are all in the fall-through test now.
- [ ] **Bounces have weight:** landing on a car roof, a bus or an open door squats Lou before he pops back up.
      Rolling up a tailgate loads his knees before it throws him. Flip onto a roof late, and the hop still saves you
      but rocks him.

**Lip pops**

- [ ] Ollie right at the edge of a roof or the top of a stair set: a "lip" pop gives +30 style and counts in the combo.

**Board and body**

- [ ] Lou leans forward a touch when speeding up (rail exits, tailgate bombs) and back when slowing.
- [ ] Nothing jitters at 120 Hz: try it on a fast phone screen if you have one.

## Tutorial floor

- [ ] **A new phone starts on it:** clear site data (or use a private window) and open the game with no URL flags. You start on a short, quiet street instead of floor 1. Any test flag (`?floor`, `?seed`, `?biome`, `?daily`) skips it.
- [ ] **One prompt per move, as you reach it:** TAP TO OLLIE, OLLIE UP ONTO THE KIOSKS, HOLD THE TAP TO OLLIE HIGHER (a canal), TAP AGAIN IN THE AIR TO FLIP, LAND ON THE RAIL TO GRIND, HOP UP ONTO THE CARS, SKATE THROUGH THE GATE!. Do they come early enough to act on?
- [ ] **Quiet:** no traffic, no bus stops or car doors, and the Heat bar never moves.
- [ ] **Through the gate:** "YOU'RE READY. LET'S GO!" and the real run starts on floor 1 with score 0. Reload: it doesn't come back (`?tutorial` brings it back).
- [ ] *Feel:* is it too long, too short, or missing a move you'd want taught (fakie, a car hop for Heat)?

## District twists

Each act's district now changes the street, not just the look. Quickest check: `?biome=atlantis&floor=4` (and `museum`, `hightech`, `clemente`, `greece`).

- [ ] **Clemente Park (act 2):** more rail and ledge pieces than Chicago.
- [ ] **Ancient Greece (act 3, some seeds):** curved rails (arches, downhill rails) come up a lot more.
- [ ] **Atlantis (act 3, some seeds):** stretches of street with bubbles streaming one way and arrows on the ground. Jump in one and the water carries you further (arrows forward) or holds you back (arrows back). It only works in the air.
- [ ] **Art Museum (act 3, some seeds):** a dark ceiling with a light strip over the street. A plain ollie fits under it; a flip bumps your head and you drop. Nothing to collect is ever above it.
- [ ] **Greece's ruins:** most floating ledges in Greece are cracked marble slabs. Land on one and it shakes, then drops about half a second later, taking you with it if you're still on it. Ollie off in time.
- [ ] **High-Tech City (act 4):** some flat rails have glowing chevrons. Cyan ones speed your grind up, orange ones slow it down.
- [ ] *Feel:* are currents strong enough to notice but never unfair? Does the museum ceiling feel like a twist or just a limit?

## Chicago hills, foreground and the L (docs/level-design-chicago.md)

Quickest check: `?seed=5&floor=1`, then `floor=5`, `floor=8`, `floor=11` and `floor=14` to see each act's signature.

- [ ] **Hills:** the descent is a San Francisco hillside, not floating rooftops: steep blocks of street with
      sidewalks following the slope, flat intersections at the crests with a cross street running back, public
      stairways, retaining-wall drops, and painted row houses stepping down the hill behind.
- [ ] **Bombing a hill** builds speed; the last block runs out onto 10 flat tiles before the street.
- [ ] **Each floor peaks on its last stairway** (always with a handrail), and floor 1's stairways always have one.
- [ ] **Acts feel different:** act 2 (floors 4-6) has handrails down most blocks, act 3 (7-9) stairways back to back,
      act 4 (10-12) crest jumps and kickers, act 5 (13-15) everything.
- [ ] **Foreground:** the bottom of the screen is always the near sidewalk, a low wall and rooftops stepping down
      toward you, never sky, on the hill, the street and the escapes. Nothing in front ever hides the lane.
- [ ] **The L:** about 12 tiles into every street, elevated track over the lane. Ollie onto the parked car just
      before it, keep holding through the hop, flip at the top, and you land grinding the rails.
- [ ] **L trains:** two-car trains come round the bend from behind the buildings, run along the stretch your way,
      and bend off at the far end, then another comes about 12 s later. Catch one and hop its roof, or slam into
      its back. A bus fits under the track.
- [ ] *Feel:* is the hill too fast, or not fast enough? Are the crest jumps readable at speed? Too much grey from
      the near sidewalk and rooftops at street level?
- [ ] *Phone:* frame rate on the older iPhone on a hill floor with the L in view.
- [ ] **From the SF photos:** the hill's houses mix painted Victorians with three-sided bay windows, white stucco
      with red tile roofs, cedar shingle and flat modern houses with balconies. Power poles and sagging wires run
      along the back sidewalk, with trees between the poles, cypresses behind and shrubs by the doors. Steep blocks
      have stepped sidewalks, and crests have crosswalk lines.

## Longer floors: hill, street chase, cable car, hill (docs/level-design-chicago.md)

- [ ] Every floor has at least two stretches of hill, and floors 6 and up have three. Each stretch ends on a
      stairway and runs out into a street chase with traffic. At the end of the chase a cable car waits at the
      foot of the next hill.
- [ ] Roll onto the cable car's slot: it tows you up fast, running just ahead of you, and stops at the top. You
      can jump off and land back on the slot to keep climbing.
- [ ] No parked car, L or traffic appears right at the foot of a stretch of hill, where you come down fast.
- [ ] **Power lines:** some blocks have a power line strung low over the lane between two poles. Ollie and flip
      up to grind it (coins run along it), or ride under it.
- [ ] *Feel:* a floor now takes about 35–80 s. Is that too long, or is the street chase too long or short?
- [ ] *Phone:* the first floor still starts quickly (each floor is generated and validated at its start).

## One city: every world's art (docs/level-design-chicago.md)

- [ ] Along the street, past the L, the city passes through quarters: a park, an old town, the waterfront, a
      museum block, a tech block and a space port, with plain Chicago between them. Each quarter shows its own
      wall, some of its buildings, its scenery, its landmark (Light Tower, Temple, Sunken Arch, Giant Bust, Data
      Spire, Rocket) and its smashables (amphoras in old town, shells on the waterfront and so on).
- [ ] Smash something in a quarter: it breaks as what you see (an amphora breaks like pottery).
- [ ] The sky has planets up high, the skyline, and the sculptures in front of it. Rain and the time of day apply
      everywhere, and there's no tint per quarter.
- [ ] Twists: a current shows as gusts of white streaks with chalk arrows, a low ceiling shows as an overpass
      underside with girders and an amber lamp.
- [ ] *Phone:* the street with a quarter and the L in view stays smooth on the older iPhone.

## One world (no biomes)

- [ ] No district button on the run summary and no "new district" line after a win. The world never switches
      look between acts.
- [ ] From floor 4, some floors have a twist: wind gusts (currents), a tunnel ceiling, conveyor rails, crumbling
      ledges, or lots of rails. Floors 1 to 3 never do. Each should look right in the one city.
- [ ] Act 3's escape is always the guards: "GUARDS! RUN!" at the start, "COLLARED!" if they catch you.
- [ ] Gear wears about 10% slower than before (hill floors are longer); half-worn should still take 3 or 4 floors.

## Level editor (?levels, docs/level-editor.md)

- [ ] Open `skate-rogue.vercel.app/?levels` on the phone: floor 1 of seed 2026 is drawn with the bot's line, and
      the line under it says the bot reaches the gate at cruising and gnar speed.
- [ ] Tap a beat in the recipe or drag a dial: the floor redraws within a moment, the panel says "edited", and the
      floors 1–15 strip at the bottom updates.
- [ ] **play in game** skates that floor with your edits; a plain `?floor=1` doesn't have them.
- [ ] **save** on the phone copies the edits; pasting them to Claude gets them merged. On `npm run dev`, save writes
      src/gen/level-edits.json.
- [ ] *Feel:* can you make the floor you want with these knobs? What's missing?

## Gnar levels (harder runs after a win)

- [ ] **Locked until you win:** the run summary has no GNAR button until you've beaten act 5 once (or use `?unlockall`).
- [ ] **Picking a level:** tap GNAR on the run summary to step through GNAR 1, 2 and so on (up to one past the highest you've won), then GNAR OFF. The page reloads and the next run is at that level. The run opens with a callout naming the new rule, and the seed line and pause card show the level and its rules.
- [ ] **The rules stack:** 1 heavier traffic, 2 Heat rises 20% faster, 3 three quarters of your Heat carries to the next floor, 4 one fewer boon card, 5 gear wears 50% faster.
- [ ] **The payoff:** each level adds 15% to score and 20% to Stoken. On the leaderboard a Gnar run shows its level next to the floor (F12 · G3). Winning at a level opens the next. Daily runs are never at a Gnar level.
- [ ] *Feel:* is level 1 noticeably harder? Is 5 brutal but fair?
- [ ] On a Gnar level (Stoken pays 1.2 or more a pickup) the ◆ counter, the callouts and the run-over screen only ever show whole Stoken, never a long decimal like 10.7999999.

## Sound, vibration and settings

- [ ] **Sound starts on your first tap:** with the phone's sound on, the gameplay music (Lou Gnar's track) comes in, plus a quiet rolling sound from the wheels that gets louder as you speed up and stops in the air.
- [ ] **Every move sounds:** an ollie pops, a flip trick swishes, landings thud (a big drop is louder than a small one), a grind scrapes for as long as you're on the rail, a car hop bonks, coins chime, Stoken chimes higher, smashing props crunches and a stomped drone explodes. A slam is a deep crunch.
- [ ] **The siren:** from Heat 25 a far-off police wail comes in, louder and faster as Heat climbs.
- [ ] **Busted and the summary:** busted plays the game-over sting; the run summary switches to the title music. The gate plays a chime.
- [ ] **Pausing silences everything,** and it comes back on resume. Switching apps pauses too.
- [ ] **Vibration (Android):** a tiny buzz on landings, a longer one on slams, three pulses at Heat 90. iPhones can't vibrate from a web page.
- [ ] **Settings on the pause card:** Sound and Music sliders, Vibration, Effects (AUTO, HIGH, LOW), Reduce motion, Reduce flashing and Heat stripes. Each one changes at once and is remembered after a reload.
- [ ] **Quit run:** on the pause card, ends the run and shows the summary (Stoken earned is kept).
- [ ] *Feel:* is the music too loud against the effects? Is the rolling sound annoying? Is the siren too quiet to notice?

## Gear and the shop

- [ ] **Gear wear:** four bars on the HUD (bottom right) for the deck, shoes, trucks and wheels. The deck wears from ollies, the shoes from flip tricks, the trucks from grinding and the wheels from going fast. A part turns yellow below 50 and red and blinking at 15, with a callout at each.
- [ ] **Worn gear costs you:** below half, a worn deck pops lower, worn shoes flip lower, worn trucks grind slower and worn wheels cruise slower. The most it costs is at 0.
- [ ] **The shop sells new parts:** a NEW <PART> card in the hand for each worn part (deck $25, shoes $15, trucks $20, wheels $15). *Tuning:* does gear wear too fast or too slow? About 3 to 5 floors to half is the aim. Wear was cut by about a quarter in the balance pass (the bot now gets a part to half in 4 floors early on, 3 in acts 3 to 5).
- [ ] **Modifiers in the shop:** gold-edged mods marked MOD: Times Two (×2, $45), Delay ($15), Combo Only (COMBO 5+, $30) and Coin Flip (50/50, $25). Each changes the next effect after it in the slots. Try `[On Ollie] [Times Two] [Speed Kick]`: two kicks per ollie. `[On Land] [Delay] [Double Pop]`: the pop comes half a second after you land.
- [ ] **Combo Only and Coin Flip:** `[On Trick] [Combo Only] [Cash Burst]` pays nothing until your combo hits 5, then double. `[On Grind Start] [Coin Flip] [Spark Trail]` sometimes gives nothing, sometimes a big trail. *Tuning:* are the prices right?
- [ ] **The shop is a card game (PR for ui2-card-shop):** the stock is a fanned hand of cards along the bottom (4 mods, `+1 SLOT` while the board has room, and a `NEW <PART>` card for each worn part); YOUR BOARD and YOUR GEAR sit across the top.
- [ ] **Drag to buy:** drag a mod card onto a slot (it replaces what's there), `+1 SLOT` onto your board, a gear card onto your gear. While you drag, the places it can go glow cyan and the one under your thumb swells yellow; the drop stamps in and the price floats off your cash.
- [ ] **Miss and too poor:** let go away from a slot and the card flies back with nothing bought. A card you can't afford is grey with a red price, and shakes instead of lifting.
- [ ] **Rearrange:** drag one board slot onto another to swap them.
- [ ] **Tap to buy:** tapping a mod card buys it into the first empty slot; tapping a gear or +1 SLOT card buys it straight away. With the board full, a tap picks the card and the next slot you tap is the one it replaces.
- [ ] **Thumb feel:** the card under your thumb shrinks so you can see the slot under it. Is it easy to drop where you mean on the phone? Are the cards big enough to read?
- [ ] **No accidental ollie:** nothing you do in the shop makes Lou ollie when you skate on.
- [ ] **Shop look (zack's Oct 25 mockup, ui3-shop-look):** graffiti SKATE SHOP title, cash on a black strip, RESTOCK and SKATE ON top right; YOUR BOARD and YOUR GEAR with yellow tape labels; cards coloured by type (trigger purple, effect blue, modifier yellow, board green, gear orange) standing on a wooden workbench, with the hint painted along it.
- [ ] **Card pictures:** every card shows a picture from the game's own models (board, truck, wheel, car, coin, Stoken gem; the sneaker is drawn) with a glyph for what it does. Do the pictures say what each mod does at a glance? Any you'd swap?
- [ ] **Small phone:** on an iPhone SE all slots (even five) and all four gear tiles fit across; gear tiles there show just the picture and the bar.
- [ ] **Worn looks on Lou:** a chipped deck nose, a scuffed shoe and then a hole, rusty trucks, coned wheels.

## Smashables

- [ ] **Props in the lane break** when you roll through, land near, grind, car-hop, slam or bomb into them. Bottles, cans, cones, crates, news boxes, trash cans, planters and more. They never slow you down.
- [ ] **Loot:** some crates, news boxes and trash cans drop cash. One golden prop a floor drops a Stoken.
- [ ] **The AI's stuff** (kiosks, delivery bots, Flock poles) takes a little Heat off when smashed.
- [ ] **WRECKING BALL!** for 4 smashes inside about 1.2 seconds.

## Effects and look

Quick ways in for these: `?seed=5&floor=12` is a dry night, `?seed=7&floor=12` a rainy night and `?seed=5&floor=6` a
downpour at golden hour. `?biome=hightech` (or `hive`, `atlantis`) gives a district look. `?noflash` and
`?nomotion` are the two halves of `?calm`, and `?heatcue` adds an edge pulse for Heat.

**Smashing**

- [ ] Each prop bursts into pieces, chips and dust where it stood, not off to one side or behind the wall. The
      broken prop disappears and doesn't pop back.
- [ ] Each material reads right: glass glitters, wood splinters with dust, metal sparks (CLANG!), cardboard puffs
      like paper.
- [ ] Only big hits get a comic word and a small camera kick: landing on a prop, a car-hop into one, a slam, or
      rolling through fast. A row of cones at cruising speed just bursts, without filling the screen with words.
- [ ] Hydrants and mailboxes don't break. They ring and spark.
- [ ] **Tuning:** too many words or too few? Is the kick strong enough? Do the pieces last long enough (1.1 s)?

**Landings, grinds and gear**

- [ ] A kiss barely puffs. A heavy landing bursts dust and kicks the camera a little, and a huge drop kicks a bit
      more, but never as much as a slam. A sketchy landing scuffs dust out lopsided.
- [ ] A metal rail throws hot white-yellow sparks. A concrete ledge throws warmer sparks with grit.
- [ ] Land in a rain puddle: a crown of water, and SPLSH! on a big drop.
- [ ] When gear wears past a line, a puff comes from that part: splinters off the deck, a scuff from the shoes,
      sparks off the trucks, rubber crumbs from the wheels. Busted is bigger than worn.
- [ ] **Tuning:** is the heavy-landing kick too much over many landings in a row?

**Night city** (`?floor=12`)

- [ ] Windows light up, lamp cones pool on the sidewalk and roofs, and neon shop signs flicker gently. With
      `?noflash` the signs hold steady.
- [ ] Cars have headlight cones and red tail-light smears.
- [ ] Lou's visor has a soft streak of light. It's pinker and brighter at night, cyan in `hightech`, and amber in
      `hive`. It gleams for a moment on tricks and landings, but not with `?noflash`.
- [ ] Exit gates glow and swell as you roll up to them.

**Rain** (`?seed=7&floor=12`)

- [ ] The street and buildings go darker and wet while the windows still glow. Water drips off roof edges, and
      puddles shine and splash.

**Heat**

- [ ] From about Heat 45 a cop searchlight hunts around you, and by about 85 it holds on you. The drone sweeps a
      red scan beam down the street.
- [ ] Nothing ever flashes the whole screen, at any Heat.

**District backdrops** (`?biome=clemente`, `atlantis`, `museum`, `hightech`, `space`)

- [ ] Each district has its own far backdrop from QFS: Clemente's park wall and trees, Atlantis's wave band with
      the dragon, the museum's night-city photo with sculptures, High-Tech's green skyline, Space's stars and
      planet. Chicago and the Hive keep the pink skyline, and Greece has only its sky.
- [ ] **Tuning:** does any backdrop look too big, too high, or float oddly? Clemente's wall card is the one I'm
      least sure about.

**Boon, curse and duo looks** (each shows only when that boon is held)

- [ ] Hood Pop: a red ring off a car hop. Siren Song: blue notes rising. Kicker Boost: cyan streaks off a tailgate.
      Slingshot: streaks ahead off a rail's end. Butter: a yellow smear on a fast landing.
- [ ] Bubble Pads: the free slam pops into soap bubbles. Tuck and Roll: a blue ring as you bounce out. Slam Stoke:
      pink sparks off a slam.
- [ ] Bomb Hill: a cyan trail while extra speed lasts. Perpetual Motion: a pink trail.
- [ ] Curses are purple. Moon Shoes leaves a slow moon-dust puff on each ollie. Speed Wobbles sheds wisps when
      you're airborne too fast. Wanted sends a bounty pixel up now and then.
- [ ] Duos are pink. Rocket Grind blasts a column off a fast grind. Sky Line draws a pink line under each trick.
- [ ] **Tuning:** is anything too busy once you hold several boons?

**Roadblock** (the act 1 escape)

- [ ] Red and blue pools glow on the street under the parked cruisers, swapping slowly side to side, stronger at
      night. With `?noflash` they hold steady.

**Escape set pieces**

- [ ] Helicopter escape: grit blows out along the street under the chopper, harder when its light is on you. It
      stops under the L tracks.
- [ ] Act 3 chase: the wave throws foam and mist, the chariot kicks dust with sparks from its wheel, and the guards
      kick dust. All of it gets bigger when they surge after you slam.
- [ ] With `?noflash`, the helicopter's light pool holds steady instead of pulsing.
- [ ] Reach the gate hot on a wanted-poster floor: a violet-and-gold fountain comes with BOUNTY CLAIMED.
- [ ] On a wanted-poster floor, push Heat to 50 or more: the exit portal turns violet with a gold rim. Let Heat
      drop below 50 and it fades back to its normal colour.

**People on the street** (`?floor=12`)

- [ ] People filming you hold up a phone with a small screen glow, easiest to see at night.
- [ ] Land a big air near a filmer: a small white photo flash pops at their phone. With `?noflash`, there's no flash.

**Weather by district**

- [ ] Rain comes round less often, about one floor in eight, and never two floors in a row.
- [ ] It never rains in Atlantis, the museum or space (try `?seed=7&floor=12&biome=space`).

**Smashing**

- [ ] Smashing things doesn't shake the screen any more. Slamming into something still does.
- [ ] Whatever you smash vanishes the moment it breaks, with nothing left standing. That includes the second and
      later floors of a run.
- [ ] The debris looks like the thing you hit: a newspaper box breaks into chunks in its own colour, a planter into
      pot and plant, a box into cardboard. The chips match its colours too.

**Cruiser jump jets**

- [ ] Get Heat up near a canal (`?floor=3` has some). As the cop car jumps the water, two thrusters fold out under
      its side and fire flames and smoke. It lands with a dust puff and the thrusters fold away.

**Rail steel**

- [ ] Every rail you can grind looks like polished chrome, with a bright top, a white line through the middle, a
      dark underside and a few dents. That covers flat rails, curved handrails and the L's tracks. The shine slides
      along the rail as you move.
- [ ] At night (`?floor=13`) the rails go a dimmer violet instead of glaring white.

**Chunky pixel look**

- [ ] Pause and drag PIXELS from SHARP to 4X: the game goes blocky and hard-edged straight away, and the HUD stays
      sharp. It's remembered after a reload. `?pixel=3` sets it from the URL.

**Speed lines**

- [ ] They only show at high speed and stay subtle (toned down after your note).

## HUD (PR #63, openspec ui1-hud)

Test on the iPhone in landscape, both ways round (notch on the left, then on the right).

**Fit and readability**
- [ ] Nothing is cut off by the notch, the rounded corners or the home bar, with the notch on either side.
- [ ] You can read every label at arm's length: score, combo, cash, Stoken, STOKE, HEAT, the mod names and the gear names.
- [ ] The middle of the screen stays clear: you can always see Lou, the next gap and oncoming cars.
- [ ] The bottom panels (board mods, gear wear) don't hide a landing or a car you need to see. If they do, say which.
- [ ] The comic look matches the mockup well enough: the Bangers font, the skewed inked panels and the neon edges.
- [ ] Frame rate is no worse than before the HUD (add `?debug` to the URL to see the fps line at the top).

**Top row**
- [ ] The logo shows `ACT 1-1 · FLOOR 1`, then `ACT 1-2 · FLOOR 2` on the next floor. The road chip (POP BOON, SKATE SHOP...) matches the road you took.
- [ ] An escape floor shows `ACT n · ESCAPE`.
- [ ] Score counts up with commas.
- [ ] The COMBO panel appears at x2 and shows `+ points` that climb while you grind. It vanishes when you land or slam.
- [ ] Cash and Stoken update on pickups, after the shop and on an act clear.

**Stoke and GNAR MODE**
- [ ] Stoke fills in 10 steps, yellow to pink, as you bank combos, and drains slowly when you stop.
- [ ] When it's full, the GNAR MODE badge lights up and bobs, the panel glows, and the bar drains with the gnar time.

**Heat**
- [ ] The Heat bar fills as you slam or skate slow, and drops with clean skating.
- [ ] Stars light at 25, 50, 75 and 90 Heat.
- [ ] The cruiser's red and blue lights flash from 50.
- [ ] The bar agrees with the world cues (sirens, edge glow, the cruiser closing in).
- [ ] **Open call:** the GDD said Heat would be shown only by the world, with no bar. The bar is in because your mockup has one. Keep it?

**Board mods (bottom left)**
- [ ] A fresh run shows 3 dashed empty slots, and a 4th or 5th once you buy them.
- [ ] Triggers are purple and read "ON OLLIE"; effects are cyan and read "DO KICK".
- [ ] A slot flashes when it fires.
- [ ] **Open call:** tiles show short names, not icons, and the mockup's pips under each mod are left out because they don't mean anything in the game yet. Want icons, or a meaning for the pips (charges, cooldown)?

**Gear wear (bottom right)**
- [ ] Deck, trucks, wheels and shoes each start with 5 green segments.
- [ ] A part goes yellow below 50 and red, blinking, at 15 or below.
- [ ] Buying a part at the shop refills its bar.
- [ ] **Open call:** colours follow condition (green, yellow, red), not a colour per part as in the mockup.

**Pause**
- [ ] The pause button (top right) freezes everything mid-air, and RESUME carries on with no accidental ollie.
- [ ] Switching apps or locking the phone pauses the game.
- [ ] The pause card lists your boons and the seed (handy for bug reports).
- [ ] You can't pause during the boon pick, the shop or the run-over screen. Those screens already stop the game.

**Other changes**
- [ ] The "TAP / HOLD = OLLIE" hint only shows on floor 1.
- [ ] The fps line is gone unless you add `?debug`.
- [ ] Turning the phone upright still shows "Turn your phone sideways".

## Models and animation

Quickest way in for most of these: `?debug&seed=7` and play floor 1 (it starts up on the roofs, so stairs, rails,
banks and drops come fast). Add `?skater=roxy` to see any item on another skater.

- [ ] Play as Roxy, Webster or Goldie (`?skater=roxy`): the hair streams back while you roll, flicks up as you fall and settles down your back when you stop. Keanu's hoodie strings swing.
- [ ] Pop out of a crooked grind or a nosegrind: Lou does a nollie (riding switch, a fakie ollie). Manual pads alternate MANUAL and NOSE MANUAL; pop out of the nose manual with a nollie.
- [ ] Roll onto a cable car climb: Lou crouches and holds the pole at the back of the car all the way up. Same riding switch (he reaches forward with the other hand).
- [ ] `?boons=firecracker`, roll off the top of a stair set: Lou rides it down on the tail, the tail slapping each step.
- [ ] Nollie kickflip (hold the nose pop): the back foot flicks off the tail and the front foot pops off the nose; a nollie shove-it spins the board the opposite way from a regular one.
- [ ] Hop off a car roof: Lou does a boneless (front foot steps down onto the roof, back hand grabs the deck, the foot comes back on at the top). Riding fakie it's the mirrored switch boneless. Tune it in ?editor as `boneless (car hop)`.

**Animation editor** (`npm run dev`, then http://localhost:5173/?editor)
- [ ] Pick a clip, press space: it plays on Lou at half speed. Scrub the timeline and step frames with the arrow keys.
- [ ] Click the yellow hips dot and drag it down: the knees bend and the feet stay on the board. Drag the cyan front foot along the board, then set its "on board" to 0 and lift it off.
- [ ] Change a slider between two keys: a new key appears there. Drag a key diamond to retime it; ctrl+z undoes.
- [ ] Save (ctrl+s): src/render/clip-edits.json changes and an open game tab reloads and plays the new version. "revert clip" and save puts the code clip back.
- [ ] Drop one of the reference photos on the view and mirror or fade it to key against it; tick "ghost" to see the previous key.

**Lou and the tricks**
- [ ] **Lou's moves come from Blender now** (PR #57): push, ride, ollie, every flip, grind, slam and land. Nothing should pop or snap between moves, including into and out of grinds.
- [ ] **Trick suite** (PR #33): kickflip, heelflip, pop shove-it, frontside shove-it, 360 flip (spins left, like your clip), hardflip, varial kickflip, varial heelflip. *Check:* after any shove-it the feet land where they were, with no crossed legs.
- [ ] **180s into fakie:** a backside or frontside 180 turns Lou round, and he rides away with the other foot forward (the callout says FAKIE). The next 180 turns him back.
- [ ] **Grinds:** 50-50, 5-0, crooked, smith, feeble, boardslide. *Check:* on a smith the nose dips down toward the camera, and on a feeble it dips away.
- [ ] **Manuals** (when the gameplay thread wires them): the nose or tail stays down and the other truck is up.
- [ ] **Visor glint:** a white streak across Lou's visor, faint by day and tinted at night.
- [ ] **Idle under menus:** while a boon pick, the shop or the underground spot is up, Lou stands on the board breathing and looking up and down the street (from his idle sprite), instead of pushing in place.
- [ ] **BUSTED:** when the cruiser catches you, Lou puts his hands up with his head down until the summary.

**Slopes (zack's IK legs, PR #62)**
- [ ] **Roll up and down a bank:** only the board tilts. The knees bend to soak it up and the torso stays upright over the board.
- [ ] **Handrails down stair sets:** the board follows the rail and Lou stays upright, with no leaning over sideways.
- [ ] **Landings:** a big drop sinks the hips (the knees bend) and Lou stands back up. Sketchy landings rock him heel to toe while his feet stay on the board.
- [ ] Riding fakie on a bank still tilts the board the right way.

**The QFS skaters (PR #62)**
- [ ] `?skater=webster`, `?skater=keanu`, `?skater=roxy`, `?skater=goldie`: each one plays every trick, grind, slam and fakie that Lou does.
- [ ] *Look:* Webster is shirtless with long blond hair and red shades. Keanu wears a grey hoodie with the hood up. Roxy has auburn hair, a purple crop top and jeans. Goldie has blonde hair, a lavender crop top, flared light-blue pants, and purple high-tops with orange soles on a board (you OK'd that). No swords or shields.
- [ ] *Open question:* do they read as themselves at game zoom? Is anything about them wrong (hair, skin tones, builds)?

**Worn gear (PR #68)**
- [ ] Play until the gear bars drop (or use the shop to compare against a new part). The deck's nose and tail chip and the graphic rubs through to the wood. The trucks go dull, then rusty. The wheels go grubby and flat-spotted.
- [ ] Lou's front shoe gets a grey scuff on the outside below 65, then a hole below 30. It's easiest to see in flips and grinds, when the foot turns.
- [ ] Buying a new part puts its look back to new.
- [ ] *Open question:* is the wear visible enough at game zoom, or should it be louder?

**Vehicles and props (PRs #43, #46, #51)**
- [ ] **CTA bus and box truck (floor 4 or later, `?floor=4`):** a white bus with the blue stripe, and a box truck with its tailgate down.
- [ ] **Street props** along the back of the sidewalk: hydrants, benches, blue garbage carts, news boxes, mailboxes, meters and sign poles.
- [ ] **Smashables** break into their own chunks (a bottle shatters, a crate splinters), and the pieces fly from where the prop stood.

**Biome kits (the next PR, after #68)**
- [ ] `?biome=clemente`, `greece`, `atlantis`, `museum`, `hightech`, `space` (and `hive`): the street front, the back wall, the buildings under the roofs and the ledges all use that QFS world's tiles. Look for Clemente's trees and signs, Greece's temples, arches and red pillars, the museum's paintings and statue of David, and Atlantis's coral. Chicago looks exactly as before.
- [ ] **Each world has its own smashables:** soda cups, pumpkins and hay bales in Clemente; oil jugs, kraters and amphorae in Greece; shells, coral and treasure chests in Atlantis; mugs, porcelain vases and marble busts in the museum; batteries, glowing holo-cubes and server racks in High-Tech City and the Hive; crystals and fuel cells in space. They stand where Chicago's cones, crates and barrels would, and break into their own pieces (pottery chips like stone, crystal like glass). The AI's kiosks, bots and Flock poles stay in every world. Chicago's hydrants, benches and meters only show in Chicago.
- [ ] *Open question:* the city skyline behind is still Chicago in every biome. Should each world get its own backdrop next (QFS's skies and far layers)?

**The AI helicopter (the PR after #80)**
- [ ] On a helicopter escape, the chopper overhead is a proper model: a dark pod with a tinted canopy, a red eye slit across its nose, red stripes, skids, a searchlight under its chin where the spotlight comes from, and a tail with a fin. Its main rotor's four blades turn under a faint blur and the tail rotor spins. It banks the way it flies, as before.
- [ ] *Open question:* does it read against the night skyline, or should it get lights (a belly strobe) or a lighter hull?

**World landmarks (same PR)**
- [ ] `?biome=greece`: a white temple front with a blue and red frieze stands behind the wall every few screens. `atlantis`: a broken arch with coral and kelp. `clemente`: a ballpark light tower. `museum`: a giant marble bust on a plinth. `hightech`: a black spire with cyan bands and a pink sign. `space`: a rocket beside a red gantry. `hive`: a black tower with a red eye and amber lights. Chicago has none.
- [ ] *Open question:* from the street their tops go out of frame (they're best seen from the roofs). Too tall, or right?

**Act 3's chasers as models (the PR after #82)**
- [ ] Act 3 escape in Atlantis: a big blue curling wave with white foam on its lip chases you, rolling along its length.
- [ ] In Greece: a gold chariot with spoked wheels that roll, a driver in a red cloak and crested helmet with his whip up, and two brown horses whose legs gallop.
- [ ] In the museum: three guards in navy uniforms, peaked caps and gold badges, legs running; the front one's torch beam shines ahead.
- [ ] *Open question:* do they read at game zoom, and is the wave big and scary enough?

**Bus stops and car doors as models (the PR after #84)**
- [ ] A bus stop (floor 2 or later) has a CTA sign on a pole (blue, white band, red route plate) and a slatted bench beside it.
- [ ] A parked car's door that swings open has a window, a mirror and a handle, and it's the same colour as its car.

**Pedestrians (the PR after #85)**
- [ ] On the street part of a floor, people stand at the back of the sidewalk every few tiles, in mixed clothes, skin and hair (short, long, cap). Some stroll back and forth.
- [ ] As you skate up they turn to watch you; some raise a phone to film you.
- [ ] Land a big air near them: they throw their arms up and bounce. Slam near them: they flinch.
- [ ] Nobody stands in a cross street, at a bus stop, on a prop, or in front of the fork's doors.
- [ ] *Open question:* too many or too few people? Should they duck when you fly over?

**Slams and bails (the PR after #89)**
- [ ] Land a trick badly (or down stairs): the board shoots out ahead, Lou sits down hard with his hands behind him, rocks forward, takes a step and hops back on. It reads as a slip-out, not a faceplant.
- [ ] Fall off the map (miss a gap): Lou windmills his arms and runs his legs in the air while the board tumbles.
- [ ] Every other trick still looks the same as before (the clips were re-baked).

**The L and traffic signals as models (same PR)**
- [ ] Act 2's helicopter escape: the L tracks overhead are dark green riveted girders with rusty X-bracing, ties and rails on top, standing on columns in the back lane. You can still hide under them from the spotlight.
- [ ] Floor 5 and later, at a cross street: the signal has a hooded three-lamp head; red or green lights up as the cross traffic changes.

**Coins, gems and the wanted board as models (the PR after #93)**
- [ ] Cash coins are gold with a rim and a raised $ that reads the right way round on both sides as they spin.
- [ ] Stoken gems are faceted purple diamonds, table up.
- [ ] A bounty floor's WANTED poster hangs on a wooden board with posts, a frame and a little roof.
- [ ] *Check:* no frame-rate drop on a floor with lots of coins.

**Ducking pedestrians and the overpass (the PR after #94)**
- [ ] Fly low past people on the sidewalk (an ollie off a kicker or a car near them): they fold over with their arms over their heads. People filming keep filming.
- [ ] The overpass on the low road has concrete pillars with flared caps and a railing with balusters along the back of its deck.

**Pedestrians per world (the PR after #96)**
- [ ] `?biome=greece`: people in tunics with bare legs and sandals, some with laurel wreaths.
- [ ] `?biome=space`: flight suits, most wearing white helmets with dark visors.
- [ ] `?biome=atlantis`, `museum`, `hightech`: sea colours, muted coats, black and neon respectively. Chicago looks as before.

**Fixes: feet on the deck, car colours (the PR after #102)**
- [ ] Lou's shoes sit on top of the grip tape in every clip (ride, push, ollie, flips, grinds), not sunk into the board.
- [ ] Parked cars, cruisers and buses show their windows, lights and trim (a cruiser is black and white with a light bar, not a flat black blob; a bus is red with windows).
- [ ] The roadblock at the end of act 1 shows proper cruisers and buses.

**Grinds by obstacle, FS boardslide, knees toward the camera**
- [ ] On rails and handrails, grinds take turns: BS boardslide, 50-50, FS boardslide, 5-0, smith, crooked, feeble. The callout names each one.
- [ ] On a parked car's roof, Lou never boardslides; he does the other grinds.
- [ ] FS boardslide: board across the rail, Lou's back facing the way he slides, looking back over his shoulder.
- [ ] Knees always bend toward the camera when Lou lands, squashes or rides a slope; never backward or sideways.
- [ ] Pedestrians are mostly Chicago, with a mix of other worlds' looks: laurels, space helmets, techwear, sea colours.

**Airliner, cable car, Chicago sculptures**
- [ ] The airliner crossing the sky is big (about half a screen long), grey with a blue tail and engines, and not hidden behind the HUD.
- [ ] The cable car up the hill is maroon and cream with open bench ends, brass poles, windows and the 60 on its side.
- [ ] Calder's red Flamingo and the Picasso stand behind the street in the plain Chicago stretches between the other worlds' quarters.

**Switch (back to the camera, after a 180)**
- [ ] Pushing switch, the back foot strokes behind you, not ahead.
- [ ] Switch ollies and flips pop off the trailing end of the board, and grinds call out SWITCH.
- [ ] ?editor lists the switch clips (switchPush, switchKickflip...) and keys them apart from the regular ones.

## Top route (power lines and rooftops)

- [ ] On a hill, the power line hangs high from about halfway down: you can't ollie or flip up to it, and there are no launch ramps (how you get up is still being worked out).
- [ ] Off the wire's end you land on a rooftop, and ollies at each rooftop's end carry you on to the next. Miss one and you're back on the street.
- [ ] Up top, the helicopter flies in over you with its light on you and your Heat climbs slowly. Tricks still cool it. Back on the street, the helicopter peels away.
- [ ] Pigeons sit on rooftops and on the wire. Ollie over them and they fly off. Skate into them for "BIRD STRIKE!", a bit less speed and a little Heat.
- [ ] Now and then an airliner crosses the sky behind the city, more often while you're up.
- [ ] Reach the gate still up top and you're on the high road.
- [ ] `?bot=high` plays the top route for you.

## Traffic and the scenery (nothing clips)

- [ ] At the foot of every hill there's a concrete tunnel mouth at the back of the road, and one at the foot of every cable car climb.
- [ ] With some Heat, the cruiser is nowhere while you're up a hill, then swings out of the tunnel mouth behind you as you reach the bottom. It never drives through the side of the hill.
- [ ] Ride up a cable car climb and the cruiser stops at the foot and turns into the tunnel there.
- [ ] Over a canal the cruiser jumps it instead of floating over the water.
- [ ] Cars pulling out of your lane (and wrecks) drive in the back lane in front of the curb, never through the people, lamps, bus stops or the L's columns on the sidewalk.
- [ ] A car heading into a hill turns into the tunnel instead of driving into the hillside.
- [ ] A robotaxi or a turning car that drives into a cone or crate knocks it flying (no points for you).
- [ ] Every floor's street ends with a side street just before the next floor starts. With the cruiser on your tail as you roll into the next floor, it turns up that side street behind you instead of vanishing.
- [ ] The helicopter follows you smoothly (no stepping), and it doesn't bob up and down with every ollie.
- [ ] The helicopter over the top route and the high-Heat drone drop in from the sky and stay above the hill, never down inside it. When you come down off the top route the helicopter climbs away.
- [ ] Traffic, cross street cars, the L trains, the cable car, the chaser, drones and birds all glide as smoothly as the skater (no stepping, best seen on a 120 Hz screen). With `?debug=collision` the player's box and the car boxes stay glued to their sprites.

## Continues

- [ ] The HUD shows three pink hearts beside the floor name at the start of a run.
- [ ] Bail into a gap, or get busted: a DUNZO or BUSTED card says "3 CONTINUES LEFT". Tap CONTINUE and you're back at the start of that floor, with the score, cash and gear you had when you got there, and one heart fewer.
- [ ] END RUN on the card goes straight to the run summary.
- [ ] After the third continue there are no hearts, and the next fall ends the run. The summary says "3 continues used".
- [ ] A new run gives you three hearts again.

## Car doors

- [ ] From floor 2, some cars are parked in the back lane, behind Lou. Skate-lane parked cars never open a door.
- [ ] When you're about 14 tiles away, a big yellow "!" pops up over the back-lane car and bobs.
- [ ] About half a second later, the door flies wide open toward the camera, across your lane, with a little bounce.
- [ ] Rolling into the open door slams you, and landing on its top edge pops you up.
- [ ] Even at full speed, the door is already open before you reach it.
- [ ] No cones or barrels block the view of the door.
- [ ] Land on top of an open door. You pop up, the door slams shut with a bang and a "DOOR SLAM!", and it stays shut.

## Firecracker and Ghost Rail

- [ ] Open `?boons=firecracker` and roll off the top of a stair set without popping. You get "FIRECRACKER!" and Lou rides down in a manual, with sparks and a clack on every step, and no slam.
- [ ] Ollie halfway down the firecracker. Lou pops out of it.
- [ ] Open `?boons=strongLegs`, land, and quickly tap twice. The second tap ollies straight away. A single tap during the landing still does nothing.
- [ ] Open `?boons=ghostRail` and ride off the end of a handrail or a power line. A faint rail carries on about 4 tiles and Lou keeps grinding.

- [ ] Nollie flips: get onto a nose grind or nose manual, ollie out and tap in the air. The callout says NOLLIE (trick) and the board pops off the nose. Riding fakie it says FAKIE.

- [ ] Puddles: on a rainy floor (`?rain`), roll through a puddle once it has formed (after about 10 s). You get a splash, a SPLSH! and a blue flash on the deck icon, and the deck bar drops a little. Ollie over one and nothing happens.

## Performance

- [ ] The street kit draws in about 50 calls instead of 190: check the fps on a phone with `?debug`. A normal floor
      should show roughly 45 to 80 draws. Note the fps and the floor if it stutters.
- [ ] If it stutters, does `?fx=low` fix it? That tier halves the particles, hides the lamp cones and drops the
      street kit's outlines.
- [ ] Buildings keep their black outlines after the draw-call cut, and their windows still light at night.

## Lighting at night and in rain

Test URLs: `?floor=13&rain=rain` (night in rain), `?floor=10&clock=0.62` (dusk), `?clock=1&rain=0` (dry night on any floor).
`?clock=0..1` sets the time of day and `?rain=0|drizzle|rain|downpour` the weather on every floor.

- [ ] At night and in rain Lou reads clearly: a cool key light on his front and a thin pale rim outside the ink
- [ ] Riding through a street lamp's pool tints Lou in that lamp's colour from above, and it fades as he rolls out
- [ ] Street lights come in five kinds: curb post, tall cobra head reaching over the street, twin-globe acorn post,
      wall light on the building fronts, and cobra arms on the hills' power poles
- [ ] At dusk only some lamps are on; the ones about to switch flick on as you roll up to them
- [ ] Pools are wide and land on the road where you skate, tilted with the hill
- [ ] `?calm` or reduce flashing: lamps fade on with no stutter

## Bullet time (src/game/bullet-time.ts)

Slow-mo for huge combos and close calls over cars, gliding in (no jolt), then an 8 s cooldown. `?bullet=0` turns it
off to compare. Reduce motion skips it.

- [ ] **Huge combo:** reaching x12 (then x18, x24, ...) calls "x12 COMBO!" and the game glides down to about 40% speed, holds, then eases back. Bigger combos and more speed go deeper and longer.
- [ ] **Close call over a car:** glides into slow-mo the same way, a little shorter.
- [ ] The slow-mo never feels like running into something: it eases in over about a third of a second.
- [ ] **No slow-mo** on a clutch catch ("CLUTCH!", a flip caught in the last few frames) or a flush bank landing ("FLUSH!"): just the callout with the points.
- [ ] Two within 8 s: only the first slows down. *Tuning:* x12 too high or too low?

## Ink outlines (2026-10-26)
- [ ] With the fisheye on, the ink round Lou is the same thickness as on coins and buildings at the screen's edges.
- [ ] Turning the camera and dolly zoom don't make outlines swell or thin out.
- [ ] No black slabs or streaks along the street edge (hull blow-up) at any lens setting.
