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

Budget rules for all of it: one draw call per effect type, no full-screen passes beyond the brief slam lines,
fake lights (additive meshes) instead of real ones, and nothing that strobes the whole screen.
