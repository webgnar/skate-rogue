# Effects roadmap

Shaders and visual effects for Gnar Run. Each item is an OpenSpec change in `openspec/changes/`.

| Change | What | State |
| --- | --- | --- |
| fx1-slam-juice | Slam hit-stop and slow-mo, camera punch, focus lines, sound words, grind sparks, landing dust | Live (#10) |
| fx2-comic-ink | Toon shading and per-mesh ink outlines (zack chose comic ink) | Live (#12) |
| fx3-speed-gnar | Speed lines; gnar glow, sparkle trail, GNAR! word (no freeze, thin glow: #21) | Live (#13, #21) |
| fx4-heat-light | Cruiser light on the street and skater, smooth red-blue sweep, no strobe | Live (#17) |
| fx5-time-weather | Clock through the run (afternoon to neon night), rain per floor | Live (#19) |
| fx6-rain-puddles | Puddles that form in the rain, neon reflections, ripples, splashes, wet surfaces, rain intensity | Live (wet look deferred) |
| fx7-night-city | Lit windows, street lamps, headlight telegraphing, neon signs, AI billboards and Flock cameras that track you | Built (signs, brake trails, visor highlight left) |
| fx8-device-polish | On-iPhone tuning, automatic quality tiers, reduce motion / flashing, perf overlay | Built except the on-device tuning pass |
| fx9-trick-fx | Flip trails by trick, grind sparks by surface, clean vs sketchy landings | Built |
| fx10-boon-looks | A look for each of the 12 boons and the board mod effects | Built |
| fx11-heat-beams | Cruiser searchlight that hunts then locks on, drone scan beam | Built |
| fx12-ui-juice | Card deal and pick pop, shop stamps, gate portals | Built |
| fx13-biome-looks | A colour grade and ambient drift per GDD biome; ?biome= preview | Built (first pass, waits on biome kits) |
| fx14-smash | Smashable props: pieces, chips, dust, words, kick, by material | Built and wired to the sim's smash events; visor glint added |
| kit-merge | Street kit draw calls: split building faces to batch, one merged outline | Built (about 190 to 60 draws on floor 1) |
| grind-flash | Grind/slide entry flash from zack's reference sheet: star in a ring, then dashed ring and streaks (10 frames, art/fx/grind_impact.py, src/render/grind-impact.ts) in `view.withActor`, following the contact point | Live |
| water-death | Canal falls: a blue comic splash (crown, column, ripples, SPLOOSH!) in `view.over`, the skater sinks out of sight with the ghost off, continue card waits 1.7 s (src/render/water-splash.ts) | Live |

Budget rules for all of it: one draw call per effect type, no full-screen passes beyond the brief slam lines,
fake lights (additive meshes) instead of real ones, and nothing that strobes the whole screen.

## Render layering (read before adding an effect)

The frame is drawn in passes (`StreetView.render`, src/render/scene.ts), in this order:

1. **Level** (`view.scene`): the street, kit, traffic, particles in `particles.behind`.
2. **Ghost**: the skater's hidden parts as the dithered ghost, where the level is in front of him (ghost.ts).
3. **Skater** (`view.actor`, plus `view.withActor`): the skater, in depth with the level, camera pulled a little
   toward him so he isn't buried in nearby walls.
4. **Over** (`view.over`): the **depth buffer is cleared first**, so everything here draws on top of everything,
   skater included. Speed lines, impacts, words, focus lines, the particle pool, rain.

Pick the layer by what has to cover what:

- Must draw **over the skater** (screen-space juice, words, sparks in front): `view.over`.
- Must be **covered by the skater or his board** (flip lines): `view.withActor`. Depth offsets on a mesh in
  `view.over` do nothing, because the depth there is already cleared. That is why the first "behind the board"
  fix (#256) did nothing: the lines stayed on top.
- Must be **covered by the level** (sparks behind the skater, street FX): `view.scene` or `particles.behind`.

`withActor` is left out of the ghost pass, so effects there don't turn into the pink/yellow dither.
Check a layering change in a zoomed still before calling it done: the board's edge should cut the line.
