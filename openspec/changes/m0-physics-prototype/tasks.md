# Tasks

## 1. Project setup

- [x] 1.1 Add package.json, tsconfig, vite.config, index.html and src/main.ts; verify `npm run build` succeeds and `npm test` runs
- [x] 1.2 Copy the QFS Chicago tileset, sky and skyline sprites and the Lou Gnar sprite sheets into public/; verify they load in the dev server

## 2. Street generation

- [x] 2.1 Port the QFS Survivor piece library, start and exit pieces, and add skate pieces with flat rails and cars; verify a test that every piece is 16 x 10 and starts and ends on street
- [x] 2.2 Implement seeded layout (tiers, weights, no repeats, floor length) and parse it into surfaces, gaps, rails and cars; verify tests for determinism, floor 1 length and tier limits

## 3. Skate physics

- [x] 3.1 Constants file and fixed-step skater controller: auto-run, ollie with release cut, flip trick, one-way landing, bail; verify tests for hold vs tap height, the double-jump limit, rooftop landing and bail
- [x] 3.2 Flat grinds, curved rails with launch carry, car-hop and slam; verify tests for each spec scenario
- [x] 3.3 Fixed-step accumulator; verify the 60 Hz vs 120 Hz test gives the same position

## 4. Input

- [x] 4.1 One-button input from pointer and keyboard with a 100 ms buffer and no browser gestures; verify the buffering test and a manual long-press check

## 5. Rendering

- [x] 5.1 Three.js scene, camera rig with speed lookahead, lights, sky and skyline cards; verify the skater stays in the left half at base speed in a screenshot
- [x] 5.2 Kit builder for street, water, buildings, ledges, rails and cars with tileset textures; verify crisp textures in a screenshot
- [x] 5.3 Sprite skater with state-driven Lou Gnar animations, and a minimal HUD (floor, trick name, restart prompt); verify animations switch in a recorded run
- [x] 5.4 Adaptive resolution when frames are slow; verify the pixel ratio drops when frame time is forced high

## 6. Integration

- [x] 6.1 Play from floor 1 to the exit and on to floor 2, and restart after a bail, in headless Chromium at a phone landscape viewport; verify with screenshots
- [ ] 6.2 Publish a playable build link for a phone test

## Workflow follow-up

- After zack's phone playtest, tune constants and archive the change.
