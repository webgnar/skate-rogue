# Z-fighting audit

Two surfaces in the same plane (a sewer's end wall flush with the hill's concrete, a garden laid on a pier's top,
a power line across a facade) flicker through each other as the camera moves. `npm run zfight` finds them.

```
npm run zfight -- [--url http://localhost:5173/] [--floors 1,2,3] [--seed 1201] [--shots 8] [--join]
node scripts/zfight/look.mjs --url http://localhost:5173/ --floor 2 --at 56,-5.2,3.7 [--from 5,1,6] --out spot.png
```

- `scripts/zfight/detect.js` runs in the game page. It takes every triangle in the built scene (after batching and
  merging, clipped by the floors' join planes), finds pairs that face the same way, lie within 4 mm of one plane
  and overlap, and groups them into clusters by material pair and place. Pairs of one material are left out (they
  look the same whichever wins), and so are pairs where either side has a polygon offset (that settles it).
- A cluster counts when the game's camera would see it: following a skater on the street over the spot, or on
  the spot's own level, with nothing in between (a ray against every triangle) and the face turned toward it.
- `run.mjs` opens each floor in headless Chromium, prints the clusters by material pair (biggest area first),
  writes `zfight-report/report.json` and a still of the worst few with a ring round each. `--join` waits for the
  next floor to build past the end and checks round the join.

## Fixing one

Nudge geometry a hair (1 cm: a lip proud of the step, a wall past the slab it meets), or give a material a depth
step (`src/render/depth.ts`): `DEPTH.rock` for the dark ground under the sewers, `DEPTH.fill` for the hill's
concrete mass, `DEPTH.mark` for thin things laid on a surface (wires, chevrons, crosswalk paint). Toon copies and
batching keep the step.
