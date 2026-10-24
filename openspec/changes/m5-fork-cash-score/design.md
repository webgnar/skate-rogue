# Design

## Fork geometry

`buildFloor(..., { fork })` adds a plain runway piece before the exit piece. The overpass starts 6 tiles into the
runway, 64 px up (a full ollie peaks at 50 px, ollie + flip at about 100 px), and runs 4 tiles past the gate, so
there are about 20 tiles to land on it. It is a one-way surface, so the low road rolls underneath. At the gate the
skater is on the high road if they are at or above the overpass.

## Roads

`rollFork(runSeed, floor)` uses the run seed, not the validator's re-roll seed, so the signs don't change when a
floor is re-rolled. The two roads always differ and at least one is a boon street. Danger scales traffic density
(x0.7, x1, x1.5); danger 3 also brings oncoming cars before floor 3.

## Pickups

Pickups roll on their own RNG stream so adding them never changes the floor's shape. Collection is a 26 px circle
around the skater's middle (24 px above the feet).

## Score

`RunScore` is pure and stepped with the floor events (see the constants in `SCORE`). The game sets
`skater.boost` and `heat.slamFree` from the gnar state before each step.
