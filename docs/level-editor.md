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
and `hillDials`; `descent.ts` reads the street piece count. A floor with no entry is built exactly as before.
Endless floors past 15 follow the floor whose recipe they reuse.
