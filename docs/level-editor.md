# Level editor

See the floors the game builds, watch the reference bot skate them, and reshape each floor's hill. No code needed.

```sh
npm run dev
# open http://localhost:5173/?levels          (or ?levels&seed=2026&floor=3)
```

It also works on the deployed site (skate-rogue.vercel.app/?levels) and on a phone; there, saving copies the edits
as text instead of writing the file (see Saving).

## What you see

- **The floor**, to scale, as the game builds it for the seed, floor and road at the top: the hill, its stairways
  and handrails, the street pieces, parked cars, coins and Stoken, where traffic is set off, the fork and the gate.
  Each section is named (`hill ↓7 + rail`, `8 stairs + rail`, `3-tile jump`, `kicker ↑2`, `cable car ↑14`).
  A floor with chases reads HILL, CHASE, HILL 2, and so on along the bottom: each chase is flat street, then a cable car
  (the purple dashed slope) tows you up the next hill. Power lines over a block are thin dashed wires; the L's kicker
  ramp is orange. The top route is sky blue: its power line down each hill, the rooftops over the streets after it, and
  the pigeons sitting on them; the overpass gate at the end stands at the rooftops' height.
- **The sky route** in mint (SKY ROUTE): rooftops, billboards, towers, cranes, scaffolds and I-beams, each named.
  Its moving set pieces are orange and say how they move: the blimp bobs, the window washer's rig drops (dashed, down
  to where it stops), the tower crane's jib swings round its mast, the I-beam swings on its cable; paper billboards
  stand across the gap as a dashed bar.
- **The cloud layer** in white (CLOUD LAYER), way up over a long stretch of hill: the staircase up (`step`, `wisp`),
  clouds, thin clouds (faded, they puff away), drifting clouds, rainbows (pink arcs) and balloons.
- **The sewer** in green under the street chases: the way in (`dig ↓` at a construction spot or `plank ramp ↓` at the
  foot of a hill) and the outlet as yellow-edged holes in the street, the tunnel, its floor and outlet ramp, its pipes
  and runoff, named `SEWER · 30 tiles · 5 down`. Kick-outs are orange (`kick-out ↑` and the grate over them); the set
  piece is named (rats, flood surge, full pipe bowl, subway gap); the alligator and a DIY stash crate are marked; the
  tunnel to the gate says `SEWER ROAD → spot`, and the fork shows where the sewer road leads.
- **show sky / clouds / sewer** at the top hide or show each layer. Each layer's panel has a **show me** button that
  scrolls the view to it.
- **The bot's line**: the floor validator's reference bot (no boons) skating it. White is rolling, yellow is in the
  air, green is grinding, a red ✕ is a slam. Under the view: how long it took, and whether it reaches the gate at
  cruising speed and at gnar speed. A floor has to pass both to ship. If the first roll fails, the game rerolls it,
  and the editor says so.
- **Floors 1–15** at one scale at the bottom, the first roll of each for this seed. Tap one to edit it.

## Shaping a floor

**Recipe.** A floor's hill is built slot by slot, top to bottom. Each slot lights the beats it may be: the seed picks
one (outlined). Tap a beat to light or unlight it, use ↑ ↓ ✕ to move or remove a slot, and **+ add a slot** to add
one before the last. The last slot is the peak: the floor's biggest stairway.

| Beat | What it is |
| --- | --- |
| hill | a block of street to bomb down |
| rail hill | a block with a handrail down the sidewalk |
| stairs | a public stairway with a handrail |
| drop | a retaining wall down onto the next street |
| crest jump | jump the cross street onto the next block |
| kicker | a short climb that throws you into the air |
| chase | the hill ends in a flat street chase, then a cable car takes you up the next hill and the slots after it carry on down that one |

**Dials.** Start height, steepness, block length, the flat at the top of each block, crest jump width, stairway
steps, the last stairway's size, how long each chase is (street pieces), how high each cable car climbs, and how many
street pieces come after the last hill before the fork. For the top route: how far down each hill its power line
starts, the gaps between rooftops, and the chance of pigeons. Each shows the code's value; an
edited dial gets a yellow edge and a reset link. The hill's height is shared out between the beats, so a taller
start makes every block and stairway bigger.

**Sky beats.** Like the recipe, slot by slot, for the sky over each hill (blimp, rig, swing and bust are set pieces,
one a floor).

**Cloud layer.** As the code builds it (from floor 5, on stretches of hill long enough), on for this floor whatever
the floor, or off. Light or unlight the beats it picks from (puff, thin, drift, rainbow, balloon, gap), and dial how
much hill it needs, where the staircase starts, how high it climbs, the step rise and gap, cloud sizes, gaps and the
chance of Stoken and a spin token.

**Sewer.** As the code builds it, on, or off for this floor; and dial the tunnel's length (a short chase still shrinks
it), depth, dig width, outlet ramp, the chance of a plank ramp way in, kick-outs (chance of a first and a second, and
how hard they pop), set pieces (from which floor, how often, rats in a pack, time between subway trains), the
alligator and the DIY stash (chances, from which floor), pipes (how many, how long, how high), runoff, Stoken on pipes, and the clear
street before the drain and after the outlet. The result line counts the floor's sky pieces, clouds and tunnels and
how long the bot spends down in the sewer.

**use code recipe / use code dials** put a floor back to how the code builds it.

## Saving

- **save** (ctrl+s) on the dev server writes every edited floor to `src/gen/level-edits.json`, and open game tabs
  reload to skate it. Commit that file to keep it.
- With no dev server (a phone, the deployed site), save copies the edits as text. **Paste them to Claude** in the
  project and they go into level-edits.json and get merged. **copy edits** does the same any time.
- **play in game** opens the game on this seed and floor with your unsaved edits (`?leveldrafts`).
- Unsaved edits stay in this browser, so a reload doesn't lose them.

## How it fits the generator

`src/gen/level-edits.json` holds only what was changed, per floor (`"3": { "recipe": [...], "top": 30 }`).
`src/gen/hills.ts` reads a floor's edits over its code recipe (`RECIPES`) and dials (`HILLS`) through `floorRecipe`
and `hillDials`; `descent.ts` reads the street piece count. A floor's `clouds` and `sewer` edits
(`{ "on": false }`, `{ "len": [30, 40], "pipes": 3 }`, `{ "mix": ["puff", "rainbow"] }`) overlay the `CLOUDS` and
`SEWER` dials by key while that floor is built (`withDials` in level-edits.ts), so a dial added to either object later
just needs a line in the editor's `CLOUD_DIALS` / `SEWER_DIALS`. A floor with no entry is built exactly as before.
Endless floors past 15 follow the floor whose recipe they reuse.
