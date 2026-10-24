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
| `?skater=webster` | Plays as Webster, Keanu, Roxy or Goldie instead of Lou |
| `?biome=greece` | Previews a district's look: `chicago`, `clemente`, `greece`, `atlantis`, `museum`, `hightech`, `space`, `hive` |
| `?calm` | Reduce motion and flashing (no shake, no flashes) |
| `?fx=low` | The low tier for older phones |
| `?debug` | Shows fps, draws and speed; exposes `window.game` |

Flags combine, for example `?seed=77&floor=5&skater=roxy`.

## Run shape and roads

- [ ] **Underground spot** (a green road sign from floor 3, about 1 fork in 7). Taking it shows three choices: Lay low (the next floor starts at 0 Heat), Swap a boon, Remove a curse. *Check:* the swap only offers boons other than the one you dropped.
- [ ] **Heat carries between floors at half.** Leave a floor with high Heat and the next one starts warmer (see it on the Heat bar).
- [ ] **Boon streets come in all six types:** POP, GRIND, FLOW, COOL, LUCK and STREET signs at the forks.
- [ ] **Fork signs light up** for the road you're on as you reach the overpass.
- [ ] **Escapes:** the act 1 to 3 escapes, and act 4's drone swarm (stomp the drones to car-hop).

## Boons

- [ ] **FLOW** (New Wheels, Bomb Hill, Butter, Kicker Boost, Slingshot) and **COOL** (Low Profile, Bubble Pads, Tuck and Roll, Slam Stoke, Siren Song, Decoy, Ghost Mode): each card does what it says.
- [ ] **LUCK:** Stoken Magnet (picks up from further away), Double Stoken, Hustler (a 4th card on every pick), Lucky Reroll (the first reroll each pick is free).
- [ ] **STREET:** Roof Rider (grind parked car roofs), Slipstream (tuck behind a car about half a second, then a burst of speed), Hood Pop (car-hops bounce higher), Spoofed Plate (robotaxis don't brake), Jaywalker (close calls count from twice as far and score double).
- [ ] **Curses (from floor 6, about one offer in three):** a dashed purple card marked CURSED. Moon Shoes (ollies 60% higher, grinds 30% slower), Wanted (double Stoken, Heat rises twice as fast), Speed Wobbles (40% faster cruising, but landing well over cruising speed, e.g. off a kicker, slams you). *Tuning:* is Speed Wobbles too harsh?
- [ ] **Duos:** pink cards that show up once you hold both halves. Rocket Grind (Rail Launch + Big Pop: ollie off a full-speed grind launches higher and gives every jump back at the top), Sky Line (Ghost Rail + Triple Threat: each flip leaves a rail under you), Perpetual Motion (Butter + Slingshot: extra speed never bleeds off).
- [ ] **Remove a curse** at the underground spot lifts it off whole.

## Traffic

- [ ] **Cross streets (floor 5+, try `?floor=5`):** the back wall opens onto a side road with a crosswalk and a corner light. The light goes red as a car pulls out.
- [ ] **Cross cars turn onto your road:** the car comes nose-first down the side street, swings round over about half a second, then drives your way slower than you. *Check:* you can car-hop it while it pulls out, while it turns and after it drives off. *Tuning:* should some turn toward you instead?
- [ ] **Buses and box trucks (floor 4+):** you can ride a bus roof. A box truck's dropped tailgate is a kicker that throws you up with a burst of speed.
- [ ] **Close calls:** clearing a roof by a few pixels calls "CLOSE CALL" and cools Heat a little.

## Tricks

- [ ] **Trick suite:** 360 flip, hardflip, varials, 180s riding away fakie (callouts say FAKIE), 5-0 and feeble grinds.
- [ ] **Floating ledges** stick out toward the camera like roofs, so Lou rides on top of them, not along the edge.

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

**Lip pops**

- [ ] Ollie right at the edge of a roof or the top of a stair set: a "lip" pop gives +30 style and counts in the combo.

**Board and body**

- [ ] Lou leans forward a touch when speeding up (rail exits, tailgate bombs) and back when slowing.
- [ ] Nothing jitters at 120 Hz: try it on a fast phone screen if you have one.

## Gear and the shop

- [ ] **Gear wear:** four bars on the HUD (bottom right) for the deck, shoes, trucks and wheels. The deck wears from ollies, the shoes from flip tricks, the trucks from grinding and the wheels from going fast. A part turns yellow below 50 and red and blinking at 15, with a callout at each.
- [ ] **Worn gear costs you:** below half, a worn deck pops lower, worn shoes flip lower, worn trucks grind slower and worn wheels cruise slower. The most it costs is at 0.
- [ ] **The shop sells new parts:** a gear row under the mod stock (deck $25, shoes $15, trucks $20, wheels $15). *Tuning:* does gear wear too fast or too slow? About 3 to 5 floors to half is the aim.
- [ ] **Worn looks on Lou:** a chipped deck nose, a scuffed shoe and then a hole, rusty trucks, coned wheels.

## Smashables

- [ ] **Props in the lane break** when you roll through, land near, grind, car-hop, slam or bomb into them. Bottles, cans, cones, crates, news boxes, trash cans, planters and more. They never slow you down.
- [ ] **Loot:** some crates, news boxes and trash cans drop cash. One golden prop a floor drops a Stoken.
- [ ] **The AI's stuff** (kiosks, delivery bots, Flock poles) takes a little Heat off when smashed.
- [ ] **WRECKING BALL!** for 4 smashes inside about 1.2 seconds.

## Effects and look

- [ ] Neon shop signs and tail light smears at night; rain darkens the street and drips off roof edges.
- [ ] Smash pieces fly from the prop's depth; chips and dust match the material.
- [ ] Landing dust scales with the impact; grind sparks change with the surface; a puff when gear wears past a line.
- [ ] The visor glint follows the neon.

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

- [ ] Lou plays his Blender actions; props break into their own pieces.
- [ ] **Other skaters:** `?skater=webster`, `keanu`, `roxy`, `goldie` (Goldie rides a board too).
- [ ] Legs soak up slopes; only the board tilts.

## Performance

- [ ] The street kit draws in about 50 calls instead of 190: check the fps on a phone with `?debug`.
