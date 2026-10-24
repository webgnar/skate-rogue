# Tasks

- [ ] 1.1 Tuning pass on zack's iPhone (values into constants with notes)
- [x] 1.2 Tier manager and per-effect low tier (`FX.tier`, `StreetView.adapt` / `setTier`, `?fx=low|high`)
- [x] 1.3 Reduce motion, reduce flashing, non-colour Heat cue; saved settings (`src/render/fx-settings.ts`,
      `?calm`, `?nomotion`, `?noflash`, `?heatcue`; a pause menu toggle belongs with the gameplay UI)
- [x] 1.4 Debug performance line behind `?debug`: fps, worst frame, draw calls over both passes, triangles,
      resolution, tier (a frame-time graph is left out)
- [x] 1.5 Batch the street kit by look (`src/render/batch.ts`): a night floor's kit went from 354 meshes to 60
