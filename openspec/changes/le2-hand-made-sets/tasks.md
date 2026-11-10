## 0. Play from here
- [ ] 0.1 `?levels`: tap a point on the floor, play from it (`?leveldrafts&from=x`); retry in one tap

## 1. Set editor
- [ ] 1.1 Set format (`src/gen/sets/*.json`) and loader; tests: a set becomes the same surfaces, rails and pickups
- [ ] 1.2 `?sets`: grid side view, palette, place, drag, stretch, delete, undo; touch handles and pinch zoom
- [ ] 1.3 Bot line and result on every change; play it on a test floor
- [ ] 1.4 Save on the dev server; elsewhere save copies the set as text to paste to Claude; drafts in the browser

## 2. Sets in floors
- [ ] 2.1 `set` beat for the hill recipe, the cloud line and the station line; tags, weight, cap, joining heights
- [ ] 2.2 `?levels` draws hand-made sets and turns them on and off per floor
- [ ] 2.3 Tests: no sets = same floors; a tagged set appears within its cap; floors still validate

## 4. Hand-made floors
- [ ] 4.1 A floor as a list of sets; generator adds traffic, props, coins and dressing

## 5. Moving pieces and code sets
- [ ] 5.1 Blimp, swinging beam, rig and drone bridge as set pieces
- [ ] 5.2 Code sets (hubba, S-rail, launch, stair set, double set...) as editable sets

## Ship (each phase)
- [ ] docs/level-editor.md, test checklist line, playtest bot green, merge to main
